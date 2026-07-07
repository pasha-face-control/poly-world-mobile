// Central theme derived from design_guidelines.json (Tactile / Playful LIGHT).
export const C = {
  surface: "#F8F6F0",
  onSurface: "#1C1C1C",
  surfaceSecondary: "#EBE6D8",
  onSurfaceSecondary: "#2C2C2C",
  surfaceTertiary: "#DED7C5",
  surfaceInverse: "#292724",
  onSurfaceInverse: "#F8F6F0",
  brand: "#4F772D",
  brandSecondary: "#90A955",
  brandTertiary: "#ECF39E",
  success: "#3A7D44",
  warning: "#E5A93A",
  error: "#BC4749",
  info: "#006D77",
  border: "#DED7C5",
  borderStrong: "#A39F93",

  terrain_grass: "#A3B18A",
  terrain_forest: "#344E41",
  terrain_mountain: "#7F7F7F",
  terrain_water: "#2A9D8F",
  terrain_grass_light: "#B7C39C",

  tribe_nature: "#4F772D",
  tribe_desert: "#E5A93A",
  tribe_volcanic: "#BC4749",
  tribe_snow: "#8B93A6",
};

export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const R = { sm: 6, md: 12, lg: 20, pill: 999 };

export const FONT = {
  display: undefined as string | undefined, // system; playful via weights
  text: undefined as string | undefined,
};

export const shadow = (elevation = 4) => ({
  shadowColor: "#000",
  shadowOffset: { width: 0, height: elevation / 2 },
  shadowOpacity: 0.18,
  shadowRadius: elevation,
  elevation,
});
