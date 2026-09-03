import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Button from "@/src/components/Button";
import { MAP_SIZES, MAP_TYPES } from "@/src/game/data";
import { MapType } from "@/src/game/types";
import { C, R, SP } from "@/src/theme";

export default function CreateMap() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mapSize, setMapSize] = useState(24);
  const [mapType, setMapType] = useState<MapType>("continents");
  const [players, setPlayers] = useState(2);
  const [closed, setClosed] = useState(false);

  const next = () => {
    router.push({ pathname: "/choose-tribe", params: { players: String(players), mapSize: String(mapSize), mapType, closed: closed ? "1" : "", index: "0", chosen: "" } });
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
  footer: { padding: SP.lg, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
});
