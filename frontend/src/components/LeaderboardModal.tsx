import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { computeLeaderboards, LbKind } from "@/src/game/leaderboard";
import { GameState } from "@/src/game/types";
import { C, R, SP, shadow } from "@/src/theme";

interface Props {
  visible: boolean;
  state: GameState;
  onClose: () => void;
}

const TABS: { id: LbKind; label: string; icon: string }[] = [
  { id: "points", label: "Points", icon: "star-four-points" },
  { id: "cities", label: "Cities", icon: "home-city" },
  { id: "cityLevel", label: "City Level", icon: "chevron-triple-up" },
];

const MEDAL = ["#E5B93A", "#B9C0C8", "#C88A50"]; // gold / silver / bronze

export default function LeaderboardModal({ visible, state, onClose }: Props) {
  const [tab, setTab] = useState<LbKind>("points");
  const boards = useMemo(() => (visible ? computeLeaderboards(state) : null), [visible, state]);
  const rows = boards ? boards[tab] : [];
  const fmt = (v: number) => (tab === "points" ? `${v.toLocaleString()} pts` : String(v));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}} testID="leaderboard-panel">
          <View style={styles.header}>
            <MaterialCommunityIcons name="trophy" size={22} color={C.brand} />
            <Text style={styles.title}>Leaderboard</Text>
            <Pressable testID="leaderboard-close" onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={22} color={C.onSurfaceSecondary} />
            </Pressable>
          </View>

          <View style={styles.tabs}>
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <Pressable key={t.id} testID={`lb-tab-${t.id}`} onPress={() => setTab(t.id)} style={[styles.tab, active && styles.tabActive]}>
                  <MaterialCommunityIcons name={t.icon as any} size={16} color={active ? "#fff" : C.onSurfaceSecondary} />
                  <Text style={[styles.tabText, active && { color: "#fff" }]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: SP.md }}>
            {rows.map((r, i) => {
              const me = r.player === state.currentPlayer;
              return (
                <View key={r.player} style={[styles.row, me && styles.rowMe]}>
                  <View style={styles.rankWrap}>
                    {i < 3 ? (
                      <MaterialCommunityIcons name="medal" size={20} color={MEDAL[i]} />
                    ) : (
                      <Text style={styles.rankNum}>{i + 1}</Text>
                    )}
                  </View>
                  <View style={[styles.dot, { backgroundColor: r.color }]} />
                  <Text style={[styles.name, r.eliminated && styles.elim]} numberOfLines={1}>
                    {r.name}
                    {me ? "  (you)" : ""}
                    {r.eliminated ? "  ✕" : ""}
                  </Text>
                  <Text style={styles.value}>{fmt(r.value)}</Text>
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  card: { backgroundColor: C.surface, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, paddingHorizontal: SP.lg, paddingTop: SP.md, paddingBottom: SP.lg, maxHeight: "78%", ...shadow(12) },
  header: { flexDirection: "row", alignItems: "center", gap: SP.sm, marginBottom: SP.md },
  title: { flex: 1, fontSize: 19, fontWeight: "900", color: C.onSurface },
  closeBtn: { padding: 4 },
  tabs: { flexDirection: "row", gap: 6, backgroundColor: C.surfaceSecondary, borderRadius: R.md, padding: 4, marginBottom: SP.md },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: R.sm },
  tabActive: { backgroundColor: C.brand },
  tabText: { fontSize: 13, fontWeight: "800", color: C.onSurfaceSecondary },
  list: { flexGrow: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: SP.sm, paddingVertical: 11, paddingHorizontal: SP.sm, borderRadius: R.md },
  rowMe: { backgroundColor: C.surfaceSecondary },
  rankWrap: { width: 26, alignItems: "center" },
  rankNum: { fontSize: 14, fontWeight: "800", color: C.onSurfaceSecondary },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: "#fff" },
  name: { flex: 1, fontSize: 15, fontWeight: "700", color: C.onSurface },
  elim: { textDecorationLine: "line-through", color: C.onSurfaceSecondary },
  value: { fontSize: 15, fontWeight: "900", color: C.brand },
});
