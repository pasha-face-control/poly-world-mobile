import React from "react";
import { Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// Custom illustrated icons keyed by an "img:" sentinel used in game data.
const IMG: Record<string, ReturnType<typeof require>> = {
  "img:ingot": require("../../assets/images/iron_ingot.png"),
  "img:mine": require("../../assets/images/iron_mine_icon.png"),
};

interface Props {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}

// Renders a bundled PNG for "img:*" icon keys, otherwise a MaterialCommunityIcons glyph.
export default function GameIcon({ name, size = 20, color, style }: Props) {
  const src = IMG[name];
  if (src) return <Image source={src} style={[{ width: size, height: size, resizeMode: "contain" }, style]} />;
  return <MaterialCommunityIcons name={name as any} size={size} color={color} style={style} />;
}
