import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useGame } from "@/src/game/store";
import { C, R, SP, shadow } from "@/src/theme";

function StatCard({ icon, value, label, color }: { icon: string; value: number | string; label: string; color: string }) {
  return (
    <View style={[styles.card, shadow(2)]}>
      <View style={[styles.iconBox, { backgroundColor: color }]}>
        <MaterialCommunityIcons name={icon as any} size={26} color="#fff" />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { stats } = useGame();
  const winRate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="stats-screen">
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable testID="stats-back" onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={C.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Statistics</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: SP.lg, gap: SP.md }}>
        <View style={styles.grid}>
          <StatCard icon="gamepad-variant" value={stats.played} label="Games Played" color={C.info} />
          <StatCard icon="trophy" value={stats.wins} label="Victories" color={C.warning} />
          <StatCard icon="skull" value={stats.losses} label="Defeats" color={C.error} />
          <StatCard icon="handshake-outline" value={stats.draws} label="Draws" color={C.onSurfaceSecondary} />
          <StatCard icon="percent" value={`${winRate}%`} label="Win Rate" color={C.brand} />
        </View>
        <View style={[styles.banner, shadow(2)]}>
          <MaterialCommunityIcons name="hexagon-multiple" size={28} color={C.brand} />
          <Text style={styles.bannerText}>
            {stats.played === 0 ? "No battles yet — start a game to build your legend!" : "Keep conquering to raise your win rate."}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: SP.md, paddingVertical: SP.sm, gap: 6 },
  back: { padding: 4, backgroundColor: C.surfaceSecondary, borderRadius: R.pill },
  headerTitle: { fontSize: 22, fontWeight: "900", color: C.onSurface },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SP.md },
  card: { width: "47%", backgroundColor: C.surface, borderRadius: R.lg, padding: SP.lg, borderWidth: 1, borderColor: C.border, alignItems: "flex-start" },
  iconBox: { width: 48, height: 48, borderRadius: R.md, alignItems: "center", justifyContent: "center", marginBottom: SP.sm },
  value: { fontSize: 30, fontWeight: "900", color: C.onSurface },
  label: { fontSize: 13, fontWeight: "700", color: C.onSurfaceSecondary },
  banner: { flexDirection: "row", alignItems: "center", gap: SP.md, backgroundColor: C.brandTertiary, borderRadius: R.lg, padding: SP.lg },
  bannerText: { flex: 1, fontSize: 14, fontWeight: "700", color: C.onSurface },
});
