#!/usr/bin/env python3
"""Generate small, bundled sound effects for HexTribes (offline, no downloads)."""
import numpy as np
import wave
import struct
import os

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "sounds")
os.makedirs(OUT, exist_ok=True)


def env(n, attack=0.005, release=0.15):
    """Simple attack/exp-decay amplitude envelope."""
    e = np.ones(n)
    a = int(SR * attack)
    if a > 0:
        e[:a] = np.linspace(0, 1, a)
    t = np.linspace(0, 1, n)
    e *= np.exp(-t / release)
    return e


def tone(freq, dur, kind="sine", vol=0.6, attack=0.005, release=0.15):
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    if kind == "sine":
        w = np.sin(2 * np.pi * freq * t)
    elif kind == "square":
        w = np.sign(np.sin(2 * np.pi * freq * t))
    elif kind == "tri":
        w = 2 * np.abs(2 * (t * freq - np.floor(t * freq + 0.5))) - 1
    elif kind == "noise":
        w = np.random.uniform(-1, 1, n)
    else:
        w = np.sin(2 * np.pi * freq * t)
    return w * env(n, attack, release) * vol


def save(name, data):
    data = np.clip(data, -1, 1)
    pcm = (data * 32767).astype(np.int16)
    path = os.path.join(OUT, name)
    with wave.open(path, "w") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(pcm.tobytes())
    print("wrote", path, len(pcm), "samples")


def mix(*clips):
    n = max(len(c) for c in clips)
    out = np.zeros(n)
    for c in clips:
        out[: len(c)] += c
    return out


def pad(a, dur):
    n = int(SR * dur)
    if len(a) < n:
        return np.concatenate([a, np.zeros(n - len(a))])
    return a[:n]


def at(clip, dur, start):
    """Place clip starting at `start` seconds within a buffer of length dur."""
    buf = np.zeros(int(SR * dur))
    s = int(SR * start)
    e = min(len(buf), s + len(clip))
    buf[s:e] += clip[: e - s]
    return buf


# --- TAP: soft short UI click (two quick blips) ---
tap = mix(tone(880, 0.05, "sine", 0.5, 0.002, 0.04), tone(1320, 0.04, "sine", 0.25, 0.002, 0.03))
save("tap.wav", pad(tap, 0.09))

# --- BATTLE: metallic clash = noise burst + low thud + ringing ---
noise = tone(0, 0.12, "noise", 0.5, 0.001, 0.05)
thud = tone(120, 0.18, "sine", 0.7, 0.002, 0.12)
ring = mix(tone(600, 0.22, "square", 0.15, 0.001, 0.18), tone(900, 0.2, "tri", 0.12, 0.001, 0.16))
battle = pad(noise, 0.3) + pad(thud, 0.3) + at(ring, 0.3, 0.02)
save("battle.wav", battle)

# --- TRADE: light two-note wooden/marimba (goods exchanged) ---
trade = at(tone(659, 0.12, "tri", 0.5, 0.002, 0.1), 0.26, 0.0) + \
        at(tone(988, 0.14, "tri", 0.45, 0.002, 0.12), 0.26, 0.09)
save("trade.wav", trade)

# --- COIN: bright cash/ka-ching for city purchase & sale ---
coin = at(tone(1046, 0.09, "square", 0.35, 0.001, 0.07), 0.32, 0.0) + \
       at(tone(1568, 0.18, "square", 0.35, 0.001, 0.16), 0.32, 0.06) + \
       at(tone(2093, 0.16, "sine", 0.18, 0.001, 0.14), 0.32, 0.06)
save("coin.wav", coin)

print("done")
