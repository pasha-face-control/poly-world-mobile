import React from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { C, R, shadow } from "@/src/theme";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  icon?: string;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
  small?: boolean;
}

export default function Button({ label, onPress, variant = "primary", icon, disabled, style, testID, small }: Props) {
  const bg = variant === "primary" ? C.brand : variant === "secondary" ? C.surfaceSecondary : "transparent";
  const fg = variant === "primary" ? "#fff" : C.onSurface;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        small && styles.small,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        variant !== "ghost" && shadow(3),
        variant === "ghost" && styles.ghost,
        style,
      ]}
    >
      {icon ? <MaterialCommunityIcons name={icon as any} size={small ? 18 : 22} color={fg} style={{ marginRight: 8 }} /> : null}
      <Text style={[styles.label, small && { fontSize: 14 }, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: R.lg,
  },
  small: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: R.md },
  ghost: { borderWidth: 2, borderColor: C.borderStrong },
  label: { fontSize: 17, fontWeight: "800", letterSpacing: 0.3 },
});
