// Per-player tribe-colour shading. When two or more players pick the SAME tribe,
// each gets a distinct shade of that tribe's base colour so they stay visually
// distinguishable on the map, labels and leaderboard.

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) { const v = l * 255; return [v, v, v]; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
}

// Generate `count` visibly-distinct shades of a base hex colour.
// index 0 stays closest to the base; the rest fan out in lightness (+ a slight
// hue rotation) so neighbours differ by a clear margin.
export function shadeVariants(baseHex: string, count: number): string[] {
  if (count <= 1) return [baseHex];
  const [r, g, b] = hexToRgb(baseHex);
  let [h, s, l] = rgbToHsl(r, g, b);
  const out: string[] = [];
  // Spread lightness across a wide band centred on the base lightness.
  const span = 0.42; // total lightness range used
  const step = span / (count - 1);
  const start = l - span / 2;
  for (let i = 0; i < count; i++) {
    const nl = Math.max(0.24, Math.min(0.80, start + step * i));
    // small hue rotation (±8°) + a touch more saturation on darker shades for separation
    const nh = (h + (i - (count - 1) / 2) * (10 / 360) + 1) % 1;
    const ns = Math.max(0.3, Math.min(1, s + (nl < l ? 0.08 : -0.04)));
    const [nr, ng, nb] = hslToRgb(nh, ns, nl);
    out.push(rgbToHex(nr, ng, nb));
  }
  return out;
}
