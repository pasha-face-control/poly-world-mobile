import React, { useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, R, SP, shadow } from "@/src/theme";
import { TRIBE_BY_ID } from "@/src/game/data";
import { GameState } from "@/src/game/types";

export function computeScore(state: GameState): number {
  const p = 0;
  const cities = state.cities.filter((c) => c.owner === p);
  const units = state.units.filter((u) => u.owner === p).length;
  const cityScore = cities.reduce((s, c) => s + c.level * 60 + (c.isCapital ? 40 : 0), 0);
  const techScore = state.players[p].techs.length * 25;
  return cityScore + units * 15 + techScore;
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <View style={styles.stat}>
      <MaterialCommunityIcons name={icon as any} size={20} color="#F8F6F0" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function VictoryCard({ state }: { state: GameState }) {
  const shotRef = useRef<ViewShot>(null);
  const [status, setStatus] = useState<"idle" | "sharing" | "unavailable">("idle");
  const won = state.status === "won";
  const isDraw = state.status === "draw";
  const peaceful = won && !!state.peacefulWin;
  const tribe = TRIBE_BY_ID[state.players[0].tribe];
  const cities = state.cities.filter((c) => c.owner === 0).length;
  const units = state.units.filter((u) => u.owner === 0).length;
  const techs = state.players[0].techs.length;
  const score = computeScore(state);

  const onShare = async () => {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setStatus("unavailable");
        setTimeout(() => setStatus("idle"), 2500);
        return;
      }
      setStatus("sharing");
      const uri = await captureRef(shotRef, { format: "png", quality: 0.95 });
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your HexTribes result" });
    } catch {
      // user cancelled or capture failed — ignore
    } finally {
      setStatus("idle");
    }
  };

  return (
    <View style={{ alignItems: "stretch", gap: SP.md }}>
      <ViewShot ref={shotRef} options={{ format: "png", quality: 0.95 }}>
        <View style={[styles.card, { backgroundColor: isDraw ? "#33342A" : won ? "#2E4A22" : "#3A2222" }]}>
          <View style={styles.badge}>
            <MaterialCommunityIcons name={isDraw ? "handshake-outline" : peaceful ? "handshake" : won ? "trophy-variant" : "skull-crossbones"} size={44} color={isDraw ? "#D8CFA6" : won ? C.warning : "#E88"} />
          </View>
          <Text style={styles.outcome}>{isDraw ? "DRAW" : peaceful ? "CAPITAL WIN" : won ? "VICTORY" : "DEFEAT"}</Text>
          {isDraw && <Text style={styles.peaceNote}>Stalemate — your forces were boxed in with no way to fight back for 3 turns. The war ends undecided.</Text>}
          {peaceful && <Text style={styles.peaceNote}>You united the map by trade — a capital win for all. No one was defeated.</Text>}
          <View style={styles.tribeRow}>
            <View style={[styles.dot, { backgroundColor: tribe.color }]} />
            <Text style={styles.tribeName}>{tribe.name}</Text>
          </View>
          <View style={styles.statsGrid}>
            <Stat icon="flag" label="Turns" value={state.turn} />
            <Stat icon="home-city" label="Cities" value={cities} />
            <Stat icon="account-group" label="Units" value={units} />
            <Stat icon="file-tree" label="Techs" value={techs} />
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>SCORE</Text>
            <Text style={styles.scoreValue}>{score.toLocaleString()}</Text>
          </View>
          <Text style={styles.brand}>HexTribes · 4X Strategy</Text>
        </View>
      </ViewShot>

      <Pressable testID="share-result" onPress={onShare} style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]}>
        <MaterialCommunityIcons name="share-variant" size={20} color="#fff" />
        <Text style={styles.shareText}>
          {status === "sharing" ? "Preparing…" : status === "unavailable" ? "Sharing not available here" : "Share Result Card"}
        </Text>
      </Pressable>
      {Platform.OS === "web" && <Text style={styles.webNote}>Tip: sharing works on the mobile app.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: R.lg, padding: SP.xl, alignItems: "center", gap: SP.sm, overflow: "hidden" },
  badge: { width: 76, height: 76, borderRadius: 38, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", marginBottom: SP.xs },
  outcome: { fontSize: 30, fontWeight: "900", color: "#F8F6F0", letterSpacing: 2 },
  peaceNote: { fontSize: 12, fontWeight: "700", color: "rgba(248,246,240,0.85)", textAlign: "center", marginTop: 2, paddingHorizontal: 6 },
  tribeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: SP.sm },
  dot: { width: 14, height: 14, borderRadius: 7 },
  tribeName: { fontSize: 16, fontWeight: "800", color: "rgba(248,246,240,0.9)" },
  statsGrid: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: SP.xs },
  stat: { alignItems: "center", flex: 1, gap: 2 },
  statValue: { fontSize: 20, fontWeight: "900", color: "#F8F6F0" },
  statLabel: { fontSize: 10, fontWeight: "700", color: "rgba(248,246,240,0.6)", textTransform: "uppercase" },
  scoreBox: { marginTop: SP.md, alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", paddingVertical: SP.sm, paddingHorizontal: SP.xl, borderRadius: R.md },
  scoreLabel: { fontSize: 11, fontWeight: "800", color: "rgba(248,246,240,0.6)", letterSpacing: 2 },
  scoreValue: { fontSize: 32, fontWeight: "900", color: C.warning },
  brand: { fontSize: 11, fontWeight: "700", color: "rgba(248,246,240,0.45)", marginTop: SP.sm },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.brand, borderRadius: R.md, paddingVertical: 14 },
  shareText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  webNote: { fontSize: 11, color: C.onSurfaceSecondary, textAlign: "center" },
});
