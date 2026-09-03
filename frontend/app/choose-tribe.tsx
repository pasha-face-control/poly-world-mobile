import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import Button from "@/src/components/Button";
import { useGame } from "@/src/game/store";
import { TECH_BY_ID, TRIBES } from "@/src/game/data";
import { MapType, TribeId } from "@/src/game/types";
import { C, R, SP, shadow } from "@/src/theme";

export default function ChooseTribe() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { startNewGame } = useGame();
  const params = useLocalSearchParams<{ players: string; mapSize: string; mapType: string; index: string; chosen: string; closed: string }>();

  const players = parseInt(params.players ?? "2", 10);
  const mapSize = parseInt(params.mapSize ?? "24", 10);
  const mapType = (params.mapType ?? "continents") as MapType;
  const index = parseInt(params.index ?? "0", 10);
  const chosen = (params.chosen ?? "").split(",").filter(Boolean) as TribeId[];
  const closed = params.closed === "1";

  const [tribe, setTribe] = useState<TribeId | null>(null);
  const isLast = index >= players - 1;

  const confirm = () => {
    if (!tribe) return;
    const tribes = [...chosen, tribe];
    if (isLast) {
      startNewGame({ tribe: tribes[0], opponents: players - 1, mapSize, mapType, passAndPlay: true, difficulty: "normal", tribes, closed });
      router.replace("/game");
    } else {
      router.push({ pathname: "/choose-tribe", params: { players: String(players), mapSize: String(mapSize), mapType, closed: closed ? "1" : "", index: String(index + 1), chosen: tribes.join(",") } });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="choose-tribe-screen">
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable testID="tribe-back" onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={C.onSurface} />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>Player {index + 1}</Text>
          <Text style={styles.headerSub}>Choose your tribe</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 24, gap: SP.md }}>
        {TRIBES.map((t) => {
          const selected = tribe === t.id;
          return (
            <Pressable
              key={t.id}
              testID={`tribe-${t.id}`}
              onPress={() => setTribe(t.id)}
              style={[styles.tribeCard, { borderColor: selected ? t.color : C.border }, selected && shadow(5)]}
            >
              <View style={[styles.tribeIcon, { backgroundColor: t.color }]}>
                <MaterialCommunityIcons name={t.icon as any} size={30} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tribeName}>{t.name}</Text>
                <Text style={styles.tribeBlurb}>{t.blurb}</Text>
                <View style={styles.startTech}>
                  <MaterialCommunityIcons name={TECH_BY_ID[t.startTech].icon as any} size={14} color={C.brand} />
                  <Text style={styles.startTechText}>{TECH_BY_ID[t.startTech].name}</Text>
                </View>
              </View>
              {selected && <MaterialCommunityIcons name="check-circle" size={24} color={t.color} />}
            </Pressable>
          );
        })}
      </ScrollView>

      {tribe && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + SP.md }]}>
          <Button testID={isLast ? "start-game" : "tribe-next"} label={isLast ? "Start Game" : "Next"} icon={isLast ? "flag-checkered" : "chevron-right"} onPress={confirm} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: SP.md, paddingVertical: SP.sm, gap: 8 },
  back: { padding: 4, backgroundColor: C.surfaceSecondary, borderRadius: R.pill },
  headerTitle: { fontSize: 22, fontWeight: "900", color: C.onSurface },
  headerSub: { fontSize: 12, fontWeight: "700", color: C.onSurfaceSecondary },
  tribeCard: { flexDirection: "row", alignItems: "center", gap: SP.md, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 3, padding: SP.md },
  tribeIcon: { width: 56, height: 56, borderRadius: R.md, alignItems: "center", justifyContent: "center" },
  tribeName: { fontSize: 20, fontWeight: "900", color: C.onSurface },
  tribeBlurb: { fontSize: 12, color: C.onSurfaceSecondary, marginTop: 2 },
  startTech: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, backgroundColor: C.brandTertiary, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill },
  startTechText: { fontSize: 11, fontWeight: "800", color: C.onSurface },
  footer: { padding: SP.lg, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
});
