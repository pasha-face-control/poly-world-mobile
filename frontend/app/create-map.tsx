import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Button from "@/src/components/Button";
import { DIFFICULTIES, MAP_SIZES, MAP_TYPES } from "@/src/game/data";
import { Difficulty, MapType } from "@/src/game/types";
import { C, R, SP } from "@/src/theme";

export default function CreateMap() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mapSize, setMapSize] = useState(24);
  const [mapType, setMapType] = useState<MapType>("continents");
  const [players, setPlayers] = useState(2);
  const [bots, setBots] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [diffMode, setDiffMode] = useState<"all" | "each">("all");
  const [botDiffs, setBotDiffs] = useState<Difficulty[]>(["normal", "normal", "normal"]);
  const [closed, setClosed] = useState(false);

  const setBotDiff = (i: number, d: Difficulty) =>
    setBotDiffs((prev) => prev.map((x, idx) => (idx === i ? d : x)));

  const next = () => {
    const botDifficulties: Difficulty[] =
      diffMode === "all"
        ? Array(bots).fill(difficulty)
        : Array.from({ length: bots }, (_, i) => botDiffs[i] ?? "normal");
    router.push({
      pathname: "/choose-tribe",
      params: {
        players: String(players),
        bots: String(bots),
        difficulty: botDifficulties[0] ?? difficulty,
        botDiffs: botDifficulties.join(","),
        mapSize: String(mapSize),
        mapType,
        closed: closed ? "1" : "",
        index: "0",
        chosen: "",
      },
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="create-map-screen">
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable testID="createmap-back" onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={C.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Create Map</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 24 }}>
        <Text style={styles.label}>Players</Text>
        <View style={styles.pillRow}>
          {[2, 3, 4].map((n) => (
            <Pressable key={n} testID={`players-${n}`} onPress={() => setPlayers(n)} style={[styles.pill, players === n && styles.pillActive]}>
              <Text style={[styles.pillText, players === n && styles.pillTextActive]}>{n}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Bots</Text>
        <View style={styles.pillRow}>
          {[0, 1, 2, 3].map((n) => (
            <Pressable key={n} testID={`bots-${n}`} onPress={() => setBots(n)} style={[styles.pill, bots === n && styles.pillActive]}>
              <Text style={[styles.pillText, bots === n && styles.pillTextActive]}>{n}</Text>
            </Pressable>
          ))}
        </View>

        {bots > 0 && (
          <>
            <Text style={styles.label}>Bot Difficulty</Text>
            <View style={styles.pillRow}>
              <Pressable testID="diffmode-all" onPress={() => setDiffMode("all")} style={[styles.kind, diffMode === "all" && styles.pillActive]}>
                <MaterialCommunityIcons name="account-group" size={20} color={diffMode === "all" ? "#fff" : C.brand} />
                <Text style={[styles.pillText, diffMode === "all" && styles.pillTextActive]}>Same for All</Text>
                <Text style={[styles.pillSub, diffMode === "all" && styles.pillTextActive]}>One difficulty</Text>
              </Pressable>
              <Pressable testID="diffmode-each" onPress={() => setDiffMode("each")} style={[styles.kind, diffMode === "each" && styles.pillActive]}>
                <MaterialCommunityIcons name="tune-variant" size={20} color={diffMode === "each" ? "#fff" : C.brand} />
                <Text style={[styles.pillText, diffMode === "each" && styles.pillTextActive]}>Per Bot</Text>
                <Text style={[styles.pillSub, diffMode === "each" && styles.pillTextActive]}>Set each bot</Text>
              </Pressable>
            </View>

            {diffMode === "all" ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
                {DIFFICULTIES.map((d) => {
                  const active = difficulty === d.id;
                  return (
                    <Pressable key={d.id} testID={`botdiff-${d.id}`} onPress={() => setDifficulty(d.id)} style={[styles.diffCard, active && styles.typeCardActive]}>
                      <MaterialCommunityIcons name={d.icon as any} size={24} color={active ? "#fff" : C.brand} />
                      <Text style={[styles.typeText, active && { color: "#fff" }]}>{d.label}</Text>
                      <Text style={[styles.diffBlurb, active && { color: "rgba(255,255,255,0.85)" }]}>{d.blurb}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              Array.from({ length: bots }, (_, i) => (
                <View key={i}>
                  <Text style={styles.botLabel}>Bot {i + 1}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
                    {DIFFICULTIES.map((d) => {
                      const active = (botDiffs[i] ?? "normal") === d.id;
                      return (
                        <Pressable key={d.id} testID={`botdiff-${i}-${d.id}`} onPress={() => setBotDiff(i, d.id)} style={[styles.diffCard, active && styles.typeCardActive]}>
                          <MaterialCommunityIcons name={d.icon as any} size={24} color={active ? "#fff" : C.brand} />
                          <Text style={[styles.typeText, active && { color: "#fff" }]}>{d.label}</Text>
                          <Text style={[styles.diffBlurb, active && { color: "rgba(255,255,255,0.85)" }]}>{d.blurb}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ))
            )}
          </>
        )}

        <Text style={styles.label}>Map Size</Text>
        <View style={styles.pillRow}>
          {MAP_SIZES.map((m) => (
            <Pressable key={m.size} testID={`mapsize-${m.size}`} onPress={() => setMapSize(m.size)} style={[styles.pill, mapSize === m.size && styles.pillActive]}>
              <Text style={[styles.pillText, mapSize === m.size && styles.pillTextActive]}>{m.label}</Text>
              <Text style={[styles.pillSub, mapSize === m.size && styles.pillTextActive]}>{m.size}×{m.size}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Map Kind</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
          {MAP_TYPES.map((m) => {
            const active = mapType === m.id;
            return (
              <Pressable key={m.id} testID={`maptype-${m.id}`} onPress={() => setMapType(m.id)} style={[styles.typeCard, active && styles.typeCardActive]}>
                <MaterialCommunityIcons name={m.icon as any} size={24} color={active ? "#fff" : C.brand} />
                <Text style={[styles.typeText, active && { color: "#fff" }]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.label}>Game Kind</Text>
        <View style={styles.pillRow}>
          <Pressable testID="gamekind-open" onPress={() => setClosed(false)} style={[styles.kind, !closed && styles.pillActive]}>
            <MaterialCommunityIcons name="earth" size={20} color={!closed ? "#fff" : C.brand} />
            <Text style={[styles.pillText, !closed && styles.pillTextActive]}>Open Game</Text>
            <Text style={[styles.pillSub, !closed && styles.pillTextActive]}>Shared map view</Text>
          </Pressable>
          <Pressable testID="gamekind-closed" onPress={() => setClosed(true)} style={[styles.kind, closed && styles.pillActive]}>
            <MaterialCommunityIcons name="eye-off" size={20} color={closed ? "#fff" : C.brand} />
            <Text style={[styles.pillText, closed && styles.pillTextActive]}>Closed Game</Text>
            <Text style={[styles.pillSub, closed && styles.pillTextActive]}>Private fog per player</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SP.md }]}>
        <Button testID="createmap-next" label="Next" icon="chevron-right" onPress={next} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: SP.md, paddingVertical: SP.sm, gap: 6 },
  back: { padding: 4, backgroundColor: C.surfaceSecondary, borderRadius: R.pill },
  headerTitle: { fontSize: 22, fontWeight: "900", color: C.onSurface },
  label: { fontSize: 13, fontWeight: "900", color: C.onSurfaceSecondary, textTransform: "uppercase", letterSpacing: 1, marginTop: SP.lg, marginBottom: SP.sm },
  pillRow: { flexDirection: "row", gap: SP.sm },
  pill: { flex: 1, backgroundColor: C.surfaceSecondary, borderRadius: R.md, paddingVertical: 14, alignItems: "center" },
  pillActive: { backgroundColor: C.brand },
  pillText: { fontSize: 16, fontWeight: "900", color: C.onSurface },
  pillSub: { fontSize: 11, fontWeight: "700", color: C.onSurfaceSecondary },
  pillTextActive: { color: "#fff" },
  kind: { flex: 1, backgroundColor: C.surfaceSecondary, borderRadius: R.md, paddingVertical: 14, alignItems: "center", gap: 3 },
  typeRow: { gap: SP.sm, paddingVertical: 4, paddingRight: 8 },
  typeCard: { width: 96, backgroundColor: C.surfaceSecondary, borderRadius: R.md, paddingVertical: 14, alignItems: "center", gap: 6, flexShrink: 0 },
  typeCardActive: { backgroundColor: C.brand },
  typeText: { fontSize: 13, fontWeight: "800", color: C.onSurface },
  diffCard: { width: 150, backgroundColor: C.surfaceSecondary, borderRadius: R.md, paddingVertical: 14, paddingHorizontal: 12, alignItems: "center", gap: 6, flexShrink: 0 },
  diffBlurb: { fontSize: 10, color: C.onSurfaceSecondary, textAlign: "center", lineHeight: 13 },
  botLabel: { fontSize: 12, fontWeight: "800", color: C.onSurface, marginTop: SP.sm, marginBottom: 2 },
  footer: { padding: SP.lg, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
});
