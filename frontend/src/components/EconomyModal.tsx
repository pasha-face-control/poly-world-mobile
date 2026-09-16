import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView, ScrollView } from "react-native-gesture-handler";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import GameIcon from "@/src/components/GameIcon";
import { C, R, SP, shadow } from "@/src/theme";
import { GameState, GoodType } from "@/src/game/types";
import { CITY_GOODS, TRADE_GOODS } from "@/src/game/data";
import { economyProjection, starIncome } from "@/src/game/engine";

export default function EconomyModal({ state, visible, onClose }: { state: GameState; visible: boolean; onClose: () => void }) {
  if (!visible) return null;
  const player = state.players[state.currentPlayer];
  const perTurnStars = starIncome(state, player.index);
  const { income, costs } = economyProjection(state, player.index);
  const eco = player.economy ?? { bought: {}, sold: {} };
  // Show every resource, even when its income/cost is 0.
  const flowGoods = CITY_GOODS;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.flex}>
        <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet} testID="economy-modal">
          <View style={styles.header}>
              <View style={styles.titleRow}>
                <MaterialCommunityIcons name="chart-box" size={22} color={C.brand} />
                <Text style={styles.title}>Economy</Text>
              </View>
              <Pressable testID="economy-close" onPress={onClose} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={24} color={C.onSurfaceSecondary} />
              </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: SP.xxl }} showsVerticalScrollIndicator persistentScrollbar nestedScrollEnabled>
            {/* Per-turn income / costs / profit */}
            <Text style={styles.section}>Per turn</Text>
            <View style={styles.card}>
              <View style={styles.colHead}>
                <Text style={[styles.colHeadText, styles.flex1]}>Resource</Text>
                <Text style={[styles.colHeadText, styles.col3]}>Income</Text>
                <Text style={[styles.colHeadText, styles.col3]}>Costs</Text>
                <Text style={[styles.colHeadText, styles.col3]}>Profit</Text>
              </View>
              <View style={styles.row}>
                <View style={styles.resCell}>
                  <GameIcon name="star-four-points" size={18} color={C.warning} />
                  <Text style={styles.rowLabel}>Stars</Text>
                </View>
                <Text style={[styles.cellNum, styles.col3, { color: C.success }]}>+{perTurnStars}</Text>
                <Text style={[styles.cellNum, styles.col3, styles.dim]}>0</Text>
                <Text style={[styles.cellNum, styles.col3, { color: C.success }]}>+{perTurnStars}</Text>
              </View>
              {flowGoods.map((g) => {
                const inc = income[g.id] ?? 0;
                const cost = costs[g.id] ?? 0;
                const profit = inc - cost;
                return (
                  <View key={g.id} style={styles.row}>
                    <View style={styles.resCell}>
                      <GameIcon name={g.icon} size={16} color={g.color} />
                      <Text style={styles.rowLabel}>{g.name}</Text>
                    </View>
                    <Text style={[styles.cellNum, styles.col3, inc > 0 ? { color: C.success } : styles.dim]}>{inc > 0 ? `+${inc}` : "0"}</Text>
                    <Text style={[styles.cellNum, styles.col3, cost > 0 ? { color: C.error } : styles.dim]}>{cost > 0 ? `-${cost}` : "0"}</Text>
                    <Text style={[styles.cellNum, styles.col3, profit > 0 ? { color: C.success } : profit < 0 ? { color: C.error } : styles.dim]}>{profit > 0 ? `+${profit}` : profit}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.hint}>Profit = Income − Costs. Factories in your cities spend resources each turn.</Text>

            {/* Bought */}
            <Text style={styles.section}>Bought (from merchants)</Text>
            <View style={styles.card}>
              <View style={styles.colHead}>
                <Text style={[styles.colHeadText, styles.flex1]}>Resource</Text>
                <Text style={[styles.colHeadText, styles.colQty]}>Qty</Text>
                <Text style={[styles.colHeadText, styles.colStars]}>Avg ★</Text>
                <Text style={[styles.colHeadText, styles.colStars]}>Spent ★</Text>
              </View>
              {TRADE_GOODS.map((g) => {
                const b = eco.bought[g.id];
                return <TradeRow key={g.id} good={g} qty={b?.qty ?? 0} stars={b?.stars ?? 0} tone={C.error} />;
              })}
            </View>

            {/* Sold */}
            <Text style={styles.section}>Sold (via your merchants)</Text>
            <View style={styles.card}>
              <View style={styles.colHead}>
                <Text style={[styles.colHeadText, styles.flex1]}>Resource</Text>
                <Text style={[styles.colHeadText, styles.colQty]}>Qty</Text>
                <Text style={[styles.colHeadText, styles.colStars]}>Avg ★</Text>
                <Text style={[styles.colHeadText, styles.colStars]}>Income ★</Text>
              </View>
              {TRADE_GOODS.map((g) => {
                const s = eco.sold[g.id];
                return <TradeRow key={g.id} good={g} qty={s?.qty ?? 0} stars={s?.stars ?? 0} tone={C.success} />;
              })}
            </View>
          </ScrollView>
        </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function TradeRow({ good, qty, stars, tone }: { good: { id: GoodType; name: string; icon: string; color: string }; qty: number; stars: number; tone: string }) {
  const avg = qty > 0 ? (stars / qty).toFixed(1) : "—";
  const dim = qty === 0;
  return (
    <View style={styles.row}>
      <View style={styles.flex1}>
        <View style={styles.resCell}>
          <GameIcon name={good.icon} size={16} color={good.color} />
          <Text style={[styles.rowLabel, dim && styles.dim]}>{good.name}</Text>
        </View>
      </View>
      <Text style={[styles.cellNum, styles.colQty, dim && styles.dim]}>{qty}</Text>
      <Text style={[styles.cellNum, styles.colStars, dim && styles.dim]}>{avg}</Text>
      <Text style={[styles.cellNum, styles.colStars, dim ? styles.dim : { color: tone }]}>{qty > 0 ? stars : 0}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(28,28,28,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, paddingHorizontal: SP.xl, paddingTop: SP.lg, maxHeight: "90%", ...shadow(12) },
  scroll: { flexGrow: 0, flexShrink: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SP.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: SP.sm },
  title: { fontSize: 20, fontWeight: "900", color: C.onSurface },
  section: { fontSize: 13, fontWeight: "900", color: C.onSurfaceSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: SP.sm, marginBottom: SP.xs },
  card: { backgroundColor: C.surfaceSecondary, borderRadius: R.md, paddingHorizontal: SP.md, paddingVertical: 2, borderWidth: 1, borderColor: C.border },
  row: { flexDirection: "row", alignItems: "center", gap: SP.sm, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  rowLabel: { fontSize: 14, fontWeight: "700", color: C.onSurface, flexShrink: 1 },
  resCell: { flexDirection: "row", alignItems: "center", gap: SP.sm },
  amt: { fontSize: 15, fontWeight: "900", color: C.onSurface },
  colHead: { flexDirection: "row", alignItems: "center", gap: SP.sm, paddingVertical: 6 },
  colHeadText: { fontSize: 11, fontWeight: "800", color: C.onSurfaceSecondary, textTransform: "uppercase" },
  flex1: { flex: 1 },
  colQty: { width: 42, textAlign: "right" },
  colStars: { width: 58, textAlign: "right" },
  col3: { width: 62, textAlign: "right" },
  hint: { fontSize: 11, fontWeight: "600", color: C.onSurfaceSecondary, marginTop: 4, marginBottom: 2, fontStyle: "italic" },
  cellNum: { fontSize: 14, fontWeight: "800", color: C.onSurface },
  dim: { color: C.borderStrong },
});
