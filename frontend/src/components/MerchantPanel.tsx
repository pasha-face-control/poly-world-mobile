import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, R, SP, shadow } from "@/src/theme";
import { GOODS, merchantCapacity } from "@/src/game/data";
import { GameState, GoodType, Unit } from "@/src/game/types";

interface Props {
  state: GameState;
  unit: Unit;
  bottomInset: number;
  onLoad: (unitId: string, good: GoodType, amount: number) => void;
  onSetPrice: (unitId: string, price: number) => void;
  onClose: () => void;
}

export default function MerchantPanel({ state, unit, bottomInset, onLoad, onSetPrice, onClose }: Props) {
  const player = state.players[state.currentPlayer];
  const cargo = unit.cargo ?? ({} as Record<GoodType, number>);
  const price = unit.price ?? 3;
  const cap = merchantCapacity(unit);
  const loaded = GOODS.reduce((s, g) => s + (cargo[g.id] ?? 0), 0);

  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset + 96 }]} pointerEvents="box-none">
      <View style={styles.card} testID="merchant-panel">
        <View style={styles.header}>
          <MaterialCommunityIcons name="cart" size={20} color={C.warning} />
          <Text style={styles.title}>{unit.boat ? "Merchant Ship" : "Merchant"}</Text>
          <View style={styles.capChip}>
            <MaterialCommunityIcons name="package-variant" size={13} color={C.onSurface} />
            <Text style={styles.capText}>{loaded}/{cap}</Text>
          </View>
          <Pressable testID="merchant-close" onPress={onClose} style={styles.close}>
            <MaterialCommunityIcons name="close" size={20} color={C.onSurface} />
          </Pressable>
        </View>

        <View style={styles.goodsGrid}>
          {GOODS.map((g) => {
            const inCargo = cargo[g.id] ?? 0;
            const inStock = player.goods[g.id] ?? 0;
            return (
              <View key={g.id} style={styles.goodRow}>
                <MaterialCommunityIcons name={g.icon as any} size={18} color={g.color} />
                <Text style={styles.goodCargo} testID={`merch-cargo-${g.id}`}>{inCargo}</Text>
                <Text style={styles.goodStock}>({inStock})</Text>
                <Pressable
                  testID={`merch-remove-${g.id}`}
                  disabled={inCargo <= 0}
                  onPress={() => onLoad(unit.id, g.id, -1)}
                  style={[styles.step, inCargo <= 0 && styles.stepOff]}
                >
                  <MaterialCommunityIcons name="minus" size={16} color={C.onSurface} />
                </Pressable>
                <Pressable
                  testID={`merch-add-${g.id}`}
                  disabled={inStock <= 0 || loaded >= cap}
                  onPress={() => onLoad(unit.id, g.id, 1)}
                  style={[styles.step, (inStock <= 0 || loaded >= cap) && styles.stepOff]}
                >
                  <MaterialCommunityIcons name="plus" size={16} color={C.onSurface} />
                </Pressable>
              </View>
            );
          })}
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Sell price / unit</Text>
          <Pressable testID="merch-price-down" onPress={() => onSetPrice(unit.id, price - 1)} style={styles.step}>
            <MaterialCommunityIcons name="minus" size={16} color={C.onSurface} />
          </Pressable>
          <View style={styles.priceChip}>
            <MaterialCommunityIcons name="star-four-points" size={13} color={C.warning} />
            <Text style={styles.priceText} testID="merch-price">{price}</Text>
          </View>
          <Pressable testID="merch-price-up" onPress={() => onSetPrice(unit.id, price + 1)} style={styles.step}>
            <MaterialCommunityIcons name="plus" size={16} color={C.onSurface} />
          </Pressable>
        </View>
        <Text style={styles.note}>Rival tribes buy your cargo each turn — you earn the price in stars.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  card: { backgroundColor: C.surface, borderRadius: R.lg, padding: SP.md, borderWidth: 1, borderColor: C.border, ...shadow(8) },
  header: { flexDirection: "row", alignItems: "center", gap: SP.sm, marginBottom: SP.sm },
  title: { fontSize: 16, fontWeight: "900", color: C.onSurface },
  capChip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill },
  capText: { fontWeight: "800", color: C.onSurface, fontSize: 12 },
  close: { marginLeft: "auto", padding: 6, backgroundColor: C.surfaceSecondary, borderRadius: R.pill },
  goodsGrid: { gap: 6 },
  goodRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.surfaceSecondary, borderRadius: R.md, paddingHorizontal: 10, paddingVertical: 6 },
  goodCargo: { fontSize: 15, fontWeight: "900", color: C.onSurface, minWidth: 18, textAlign: "center" },
  goodStock: { fontSize: 12, color: C.onSurfaceSecondary, flex: 1 },
  step: { width: 30, height: 30, borderRadius: R.sm, backgroundColor: C.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  stepOff: { opacity: 0.4 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: SP.md },
  priceLabel: { fontSize: 13, fontWeight: "800", color: C.onSurface, flex: 1 },
  priceChip: { flexDirection: "row", alignItems: "center", gap: 3, minWidth: 44, justifyContent: "center" },
  priceText: { fontSize: 16, fontWeight: "900", color: C.onSurface },
  note: { fontSize: 11, color: C.onSurfaceSecondary, marginTop: SP.sm, textAlign: "center" },
});
