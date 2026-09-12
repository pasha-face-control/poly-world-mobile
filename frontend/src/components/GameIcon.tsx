import React from "react";
import { Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// Custom illustrated icons keyed by an "img:" sentinel used in game data.
// `tint: true` entries are monochrome line-art that respect the passed color
// (so they recolor per state like a vector glyph).
const IMG: Record<string, { src: ReturnType<typeof require>; tint: boolean }> = {
  "img:ingot": { src: require("../../assets/images/iron_ingot.png"), tint: false },
  "img:mine": { src: require("../../assets/images/iron_mine_icon.png"), tint: false },
  "img:ingot_line": { src: require("../../assets/images/iron_ingot_line.png"), tint: true },
  "img:coal_ore": { src: require("../../assets/images/coal_ore.png"), tint: false },
  "img:coal_mine": { src: require("../../assets/images/coal_mine.png"), tint: false },
  "img:coal_mine_line": { src: require("../../assets/images/coal_mine_line.png"), tint: true },
};

interface Props {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}

// Renders a bundled PNG for "img:*" icon keys, otherwise a MaterialCommunityIcons glyph.
export default function GameIcon({ name, size = 20, color, style }: Props) {
  const entry = IMG[name];
  if (entry) {
    return (
      <Image
        source={entry.src}
        style={[{ width: size, height: size, resizeMode: "contain" }, entry.tint && color ? { tintColor: color } : null, style]}
      />
    );
  }
  return <MaterialCommunityIcons name={name as any} size={size} color={color} style={style} />;
}
