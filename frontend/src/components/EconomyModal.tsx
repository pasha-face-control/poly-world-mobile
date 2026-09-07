import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, R, SP, shadow } from "@/src/theme";
import { GameState, GoodType } from "@/src/game/types";
import { GOODS } from "@/src/game/data";
import { goodsIncome, starIncome } from "@/src/game/engine";

export default function EconomyModal({ state, visible, onClose }: { state: GameState; visible: boolean; onClose: () => void }) {
  const player = state.players[state.currentPlayer];
  const perTurnStars = starIncome(state, player.index);
  const perTurnGoods = goodsIncome(state, player.index);
  const eco = player.economy ?? { bought: {}, sold: {} };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet} testID="economy-modal">
          <Pressable onPress={() => {}}>
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <MaterialCommunityIcons name="chart-box" size={22} color={C.brand} />
                <Text style={styles.title}>Economy</Text>
              </View>
              <Pressable testID="economy-close" onPress={onClose} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={24} color={C.onSurfaceSecondary} />
              </Pressable>
            </View>
          </Pressable>

          <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: SP.xxl }} showsVerticalScrollIndicator persistentScrollbar nestedScrollEnabled>
            {/* Per-turn income */}
            <Text style={styles.section}>Income per turn</Text>
            <View style={styles.card}>
              <Row
                icon="star-four-points"
                iconColor={C.warning}
                label="Stars"
                right={<Text style={[styles.amt, { color: C.warning }]}>+{perTurnStars}</Text>}
              />
              {GOODS.map((g) => (
                <Row
                  key={g.id}
                  icon={g.icon}
                  iconColor={g.color}
                  label={g.name}
                  right={<Text style={[styles.amt, perTurnGoods[g.id] > 0 && { color: C.success }]}>{perTurnGoods[g.id] > 0 ? `+${perTurnGoods[g.id]}` : "0"}</Text>}
                />
              ))}
            </View>

            {/* Bought */}
            <Text style={styles.section}>Bought (from merchants)</Text>
            <View style={styles.card}>
              <View style={styles.colHead}>
                <Text style={[styles.colHeadText, styles.flex1]}>Resource</Text>
                <Text style={[styles.colHeadText, styles.colQty]}>Qty</Text>
                <Text style={[styles.colHeadText, styles.colStars]}>Avg ★</Text>
                <Text style={[styles.colHeadText, styles.colStars]}>Spent ★</Text>
              </View>
              {GOODS.map((g) => {
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
              {GOODS.map((g) => {
                const s = eco.sold[g.id];
                return <TradeRow key={g.id} good={g} qty={s?.qty ?? 0} stars={s?.stars ?? 0} tone={C.success} />;
              })}
            </View>
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

function Row({ icon, iconColor, label, right }: { icon: string; iconColor: string; label: string; right: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name={icon as any} size={18} color={iconColor} />
      <Text style={styles.rowLabel}>{label}</Text>
      {right}
    </View>
  );
}

function TradeRow({ good, qty, stars, tone }: { good: { id: GoodType; name: string; icon: string; color: string }; qty: number; stars: number; tone: string }) {
  const avg = qty > 0 ? (stars / qty).toFixed(1) : "—";
  const dim = qty === 0;
  return (
    <View style={styles.row}>
      <View style={styles.flex1}>
        <View style={styles.resCell}>
          <MaterialCommunityIcons name={good.icon as any} size={16} color={good.color} />
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
  cellNum: { fontSize: 14, fontWeight: "800", color: C.onSurface },
  dim: { color: C.borderStrong },
});
