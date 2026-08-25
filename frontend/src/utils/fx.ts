// Sound effects + haptics manager for HexTribes.
// - Bundled offline SFX (tap / battle / trade / coin) via expo-audio.
// - Sound + vibration toggles persisted in storage and exposed via a tiny
//   subscribe store so settings UI can react.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { storage } from "@/src/utils/storage";

export type SfxName = "tap" | "battle" | "trade" | "coin";

const SOURCES: Record<SfxName, number> = {
  tap: require("../../assets/sounds/tap.wav"),
  battle: require("../../assets/sounds/battle.wav"),
  trade: require("../../assets/sounds/trade.wav"),
  coin: require("../../assets/sounds/coin.wav"),
};

const VOLUME: Record<SfxName, number> = { tap: 0.5, battle: 0.9, trade: 0.7, coin: 0.8 };

const SOUND_KEY = "hextribes_sound_on_v1";
const HAPTIC_KEY = "hextribes_haptics_on_v1";

let soundOn = true;
let hapticsOn = true;
const players: Partial<Record<SfxName, AudioPlayer>> = {};
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Load persisted prefs and prime the audio players. Call once at app start. */
export async function initFx() {
  soundOn = (await storage.getItem<boolean>(SOUND_KEY, true)) ?? true;
  hapticsOn = (await storage.getItem<boolean>(HAPTIC_KEY, true)) ?? true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
    (Object.keys(SOURCES) as SfxName[]).forEach((name) => {
      const p = createAudioPlayer(SOURCES[name]);
      p.volume = VOLUME[name];
      players[name] = p;
    });
  } catch (e) {
    console.warn("[fx] audio init failed", e);
  }
  emit();
}

/** Play a sound effect from the start (no-op if sound is muted). */
export function playSfx(name: SfxName) {
  if (!soundOn) return;
  const p = players[name];
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch (e) {
    // ignore playback races
  }
}

// --- Haptics wrappers (respect the vibration toggle) ---
export const haptic = {
  select() {
    if (hapticsOn) Haptics.selectionAsync();
  },
  impact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) {
    if (hapticsOn) Haptics.impactAsync(style);
  },
  notify(type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) {
    if (hapticsOn) Haptics.notificationAsync(type);
  },
};

// --- Settings store ---
export function getSoundOn() {
  return soundOn;
}
export function getHapticsOn() {
  return hapticsOn;
}
export function setSoundOn(v: boolean) {
  soundOn = v;
  storage.setItem(SOUND_KEY, v);
  if (v) playSfx("tap");
  emit();
}
export function setHapticsOn(v: boolean) {
  hapticsOn = v;
  storage.setItem(HAPTIC_KEY, v);
  if (v) Haptics.selectionAsync();
  emit();
}
export function subscribeFx(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
