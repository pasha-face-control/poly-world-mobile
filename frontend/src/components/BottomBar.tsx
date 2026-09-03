import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, R, shadow } from "@/src/theme";

interface Props {
  bottomInset: number;
  busy: boolean;
  onTech: () => void;
  onNextUnit: () => void;
  onMenu: () => void;
  onEndTurn: () => void;
}

function Action({ icon, label, onPress, primary, testID }: { icon: string; label: string; onPress: () => void; primary?: boolean; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.action, primary && styles.primary, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
      <MaterialCommunityIcons name={icon as any} size={24} color={primary ? "#fff" : C.onSurface} />
      <Text style={[styles.label, primary && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

export default function BottomBar({ bottomInset, busy, onTech, onNextUnit, onMenu, onEndTurn }: Props) {
  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset + 8 }]} pointerEvents="box-none">
      <BlurView intensity={40} tint="light" style={styles.bar} testID="bottom-bar">
        <Action icon="file-tree" label="Tech" onPress={onTech} testID="action-tech" />
        <Action icon="crosshairs-gps" label="Next" onPress={onNextUnit} testID="action-next-unit" />
        <Action icon="menu" label="Menu" onPress={onMenu} testID="action-menu" />
        {busy ? (
          <View style={[styles.action, styles.primary]}>
            <ActivityIndicator color="#fff" />
            <Text style={[styles.label, { color: "#fff" }]}>AI…</Text>
          </View>
        ) : (
          <Action icon="flag-checkered" label="End Turn" onPress={onEndTurn} primary testID="action-end-turn" />
        )}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: R.lg,
    overflow: "hidden",
    backgroundColor: "rgba(248,246,240,0.8)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    ...shadow(6),
  },
  action: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: R.md,
    gap: 2,
  },
  primary: { backgroundColor: C.brand },
  label: { fontSize: 12, fontWeight: "800", color: C.onSurface },
});
