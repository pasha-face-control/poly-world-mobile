import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { C, R, SP, shadow } from "@/src/theme";

const SECTIONS: { icon: string; title: string; body: string }[] = [
  { icon: "hexagon-multiple", title: "Goal", body: "Conquer every rival tribe by capturing all their cities. Lose all of yours and it's game over." },
  { icon: "gesture-tap", title: "Move & Attack", body: "Tap a unit to select it. Yellow tiles are moves, red tiles are attacks. Melee units chase; archers strike from 2 tiles away." },
  { icon: "home-city", title: "Cities", body: "Tap your city to train units and harvest nearby resources. Harvesting grows population — full cities level up for more stars." },
  { icon: "star-four-points", title: "Stars", body: "Each turn every city gives stars equal to its level. Spend stars on units, tech, and harvesting." },
  { icon: "file-tree", title: "Technology", body: "Open the Tech tree to unlock new units (Rider, Archer, Swordsman), traverse mountains & water, and harvest more resources." },
  { icon: "flag-variant", title: "Villages", body: "Move a unit onto a neutral village to found a new city and expand your empire." },
];

export default function HowToPlay() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="how-screen">
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable testID="how-back" onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={C.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>How to Play</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: SP.lg, gap: SP.md, paddingBottom: insets.bottom + 24 }}>
        {SECTIONS.map((s) => (
          <View key={s.title} style={[styles.card, shadow(2)]}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name={s.icon as any} size={24} color={C.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: SP.md, paddingVertical: SP.sm, gap: 6 },
  back: { padding: 4, backgroundColor: C.surfaceSecondary, borderRadius: R.pill },
  headerTitle: { fontSize: 22, fontWeight: "900", color: C.onSurface },
  card: { flexDirection: "row", gap: SP.md, backgroundColor: C.surface, borderRadius: R.lg, padding: SP.lg, borderWidth: 1, borderColor: C.border },
  iconBox: { width: 44, height: 44, borderRadius: R.md, backgroundColor: C.brandTertiary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "900", color: C.onSurface },
  body: { fontSize: 14, color: C.onSurfaceSecondary, marginTop: 3, lineHeight: 20 },
});
