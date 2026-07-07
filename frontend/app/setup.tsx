import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Button from "@/src/components/Button";
import { useGame } from "@/src/game/store";
import { MAP_SIZES, TECH_BY_ID, TRIBES } from "@/src/game/data";
import { TribeId } from "@/src/game/types";
import { C, R, SP, shadow } from "@/src/theme";

export default function Setup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { startNewGame } = useGame();

  const [tribe, setTribe] = useState<TribeId>("nature");
  const [opponents, setOpponents] = useState(1);
  const [mapSize, setMapSize] = useState(11);
  const [passAndPlay, setPassAndPlay] = useState(false);

  const start = () => {
    startNewGame({ tribe, opponents, mapSize, passAndPlay });
    router.replace("/game");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="setup-screen">
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable testID="setup-back" onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={C.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>New Game</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 24 }}>
        <Text style={styles.label}>Choose Your Tribe</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tribeRow}>
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
                <Text style={styles.tribeName}>{t.name}</Text>
                <Text style={styles.tribeBlurb}>{t.blurb}</Text>
                <View style={styles.startTech}>
                  <MaterialCommunityIcons name={TECH_BY_ID[t.startTech].icon as any} size={14} color={C.brand} />
                  <Text style={styles.startTechText}>{TECH_BY_ID[t.startTech].name}</Text>
                </View>
                {selected && <MaterialCommunityIcons name="check-circle" size={22} color={t.color} style={styles.check} />}
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.label}>Opponents</Text>
        <View style={styles.pillRow}>
          {[1, 2, 3].map((n) => (
            <Pressable key={n} testID={`opponents-${n}`} onPress={() => setOpponents(n)} style={[styles.pill, opponents === n && styles.pillActive]}>
              <Text style={[styles.pillText, opponents === n && styles.pillTextActive]}>{n}</Text>
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

        <Text style={styles.label}>Mode</Text>
        <Pressable testID="mode-toggle" onPress={() => setPassAndPlay((v) => !v)} style={styles.modeRow}>
          <MaterialCommunityIcons name={passAndPlay ? "account-multiple" : "robot"} size={24} color={C.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.modeTitle}>{passAndPlay ? "Pass & Play" : "vs AI"}</Text>
            <Text style={styles.modeSub}>{passAndPlay ? "All players are human, one device" : "Battle the computer tribes"}</Text>
          </View>
          <View style={[styles.switch, passAndPlay && styles.switchOn]}>
            <View style={[styles.knob, passAndPlay && styles.knobOn]} />
          </View>
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SP.md }]}>
        <Button testID="start-game" label="Start Game" icon="flag-checkered" onPress={start} />
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
  tribeRow: { gap: SP.md, paddingVertical: 4, paddingRight: 8 },
  tribeCard: { width: 170, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 3, padding: SP.md },
  tribeIcon: { width: 56, height: 56, borderRadius: R.md, alignItems: "center", justifyContent: "center" },
  tribeName: { fontSize: 20, fontWeight: "900", color: C.onSurface, marginTop: SP.sm },
  tribeBlurb: { fontSize: 12, color: C.onSurfaceSecondary, marginTop: 2, minHeight: 32 },
  startTech: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, backgroundColor: C.brandTertiary, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill },
  startTechText: { fontSize: 11, fontWeight: "800", color: C.onSurface },
  check: { position: "absolute", top: 10, right: 10 },
  pillRow: { flexDirection: "row", gap: SP.sm },
  pill: { flex: 1, backgroundColor: C.surfaceSecondary, borderRadius: R.md, paddingVertical: 14, alignItems: "center" },
  pillActive: { backgroundColor: C.brand },
  pillText: { fontSize: 16, fontWeight: "900", color: C.onSurface },
  pillSub: { fontSize: 11, fontWeight: "700", color: C.onSurfaceSecondary },
  pillTextActive: { color: "#fff" },
  modeRow: { flexDirection: "row", alignItems: "center", gap: SP.md, backgroundColor: C.surfaceSecondary, borderRadius: R.lg, padding: SP.md },
  modeTitle: { fontSize: 16, fontWeight: "900", color: C.onSurface },
  modeSub: { fontSize: 12, color: C.onSurfaceSecondary },
  switch: { width: 52, height: 30, borderRadius: 15, backgroundColor: C.borderStrong, padding: 3, justifyContent: "center" },
  switchOn: { backgroundColor: C.brand },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff" },
  knobOn: { alignSelf: "flex-end" },
  footer: { padding: SP.lg, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
});
