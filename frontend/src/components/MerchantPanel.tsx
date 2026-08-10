import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, R, SP, shadow } from "@/src/theme";
import { GOODS, merchantSlots, slotCapacity } from "@/src/game/data";
import { GameState, GoodType, Unit } from "@/src/game/types";

interface Props {
  state: GameState;
  unit: Unit;
  bottomInset: number;
  onLoad: (unitId: string, slotIndex: number, good: GoodType, amount: number) => void;
  onSetPrice: (unitId: string, slotIndex: number, price: number) => void;
  onClose: () => void;
}

const goodMeta = (id: GoodType) => GOODS.find((g) => g.id === id)!;

export default function MerchantPanel({ state, unit, bottomInset, onLoad, onSetPrice, onClose }: Props) {
  const player = state.players[state.currentPlayer];
  const slots = unit.cargo ?? [];
  const cap = slotCapacity(unit);
  const count = merchantSlots(unit);

  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset + 96 }]} pointerEvents="box-none">
      <View style={styles.card} testID="merchant-panel">
        <View style={styles.header}>
          <MaterialCommunityIcons name="cart" size={20} color={C.warning} />
          <Text style={styles.title}>{unit.boat ? "Merchant Ship" : "Merchant"}</Text>
          <Text style={styles.sub}>{count} slots · {cap}/slot</Text>
          <Pressable testID="merchant-close" onPress={onClose} style={styles.close}>
            <MaterialCommunityIcons name="close" size={20} color={C.onSurface} />
          </Pressable>
        </View>

        <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {slots.map((slot, i) => {
            if (!slot.good) {
              return (
                <View key={i} style={styles.slot} testID={`slot-${i}`}>
                  <Text style={styles.slotLabel}>Slot {i + 1} · empty</Text>
                  <View style={styles.pickRow}>
                    {GOODS.map((g) => {
                      const disabled = (player.goods[g.id] ?? 0) <= 0;
                      return (
                        <Pressable
                          key={g.id}
                          testID={`slot-${i}-load-${g.id}`}
                          disabled={disabled}
                          onPress={() => onLoad(unit.id, i, g.id, 1)}
                          style={[styles.pick, disabled && styles.dim]}
                        >
                          <MaterialCommunityIcons name={g.icon as any} size={18} color={g.color} />
                          <Text style={styles.pickQty}>{player.goods[g.id] ?? 0}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            }
            const meta = goodMeta(slot.good);
            const stock = player.goods[slot.good] ?? 0;
            return (
              <View key={i} style={styles.slot} testID={`slot-${i}`}>
                <View style={styles.slotTop}>
                  <MaterialCommunityIcons name={meta.icon as any} size={20} color={meta.color} />
                  <Text style={styles.goodName}>{meta.name}</Text>
                  <Text style={styles.qty} testID={`slot-${i}-qty`}>{slot.qty}/{cap}</Text>
                  <Text style={styles.stock}>stock {stock}</Text>
                  <Pressable testID={`slot-${i}-minus`} disabled={slot.qty <= 0} onPress={() => onLoad(unit.id, i, slot.good!, -1)} style={[styles.step, slot.qty <= 0 && styles.dim]}>
                    <MaterialCommunityIcons name="minus" size={16} color={C.onSurface} />
                  </Pressable>
                  <Pressable testID={`slot-${i}-plus`} disabled={stock <= 0 || slot.qty >= cap} onPress={() => onLoad(unit.id, i, slot.good!, 1)} style={[styles.step, (stock <= 0 || slot.qty >= cap) && styles.dim]}>
                    <MaterialCommunityIcons name="plus" size={16} color={C.onSurface} />
                  </Pressable>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Price / unit</Text>
                  <Pressable testID={`slot-${i}-price-down`} onPress={() => onSetPrice(unit.id, i, slot.price - 1)} style={styles.step}>
                    <MaterialCommunityIcons name="minus" size={16} color={C.onSurface} />
                  </Pressable>
                  <View style={styles.priceChip}>
                    <MaterialCommunityIcons name="star-four-points" size={13} color={C.warning} />
                    <Text style={styles.priceText} testID={`slot-${i}-price`}>{slot.price}</Text>
                  </View>
                  <Pressable testID={`slot-${i}-price-up`} onPress={() => onSetPrice(unit.id, i, slot.price + 1)} style={styles.step}>
                    <MaterialCommunityIcons name="plus" size={16} color={C.onSurface} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
        <Text style={styles.note}>Each slot holds one good (up to {cap}) at its own price. Rivals buy your stock each turn.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  card: { backgroundColor: C.surface, borderRadius: R.lg, padding: SP.md, borderWidth: 1, borderColor: C.border, ...shadow(8) },
  header: { flexDirection: "row", alignItems: "center", gap: SP.sm, marginBottom: SP.sm },
  title: { fontSize: 16, fontWeight: "900", color: C.onSurface },
  sub: { fontSize: 11, color: C.onSurfaceSecondary, fontWeight: "700" },
  close: { marginLeft: "auto", padding: 6, backgroundColor: C.surfaceSecondary, borderRadius: R.pill },
  slot: { backgroundColor: C.surfaceSecondary, borderRadius: R.md, padding: 10, gap: 8 },
  slotLabel: { fontSize: 12, fontWeight: "800", color: C.onSurfaceSecondary },
  pickRow: { flexDirection: "row", gap: 6, justifyContent: "space-between" },
  pick: { flex: 1, alignItems: "center", gap: 2, backgroundColor: C.surfaceTertiary, borderRadius: R.sm, paddingVertical: 8 },
  pickQty: { fontSize: 10, fontWeight: "800", color: C.onSurfaceSecondary },
  slotTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  goodName: { fontSize: 14, fontWeight: "800", color: C.onSurface, minWidth: 46 },
  qty: { fontSize: 13, fontWeight: "900", color: C.onSurface },
  stock: { fontSize: 11, color: C.onSurfaceSecondary, flex: 1 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  priceLabel: { fontSize: 12, fontWeight: "700", color: C.onSurfaceSecondary, flex: 1 },
  priceChip: { flexDirection: "row", alignItems: "center", gap: 3, minWidth: 40, justifyContent: "center" },
  priceText: { fontSize: 15, fontWeight: "900", color: C.onSurface },
  step: { width: 30, height: 30, borderRadius: R.sm, backgroundColor: C.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  dim: { opacity: 0.4 },
  note: { fontSize: 11, color: C.onSurfaceSecondary, marginTop: SP.sm, textAlign: "center" },
});
