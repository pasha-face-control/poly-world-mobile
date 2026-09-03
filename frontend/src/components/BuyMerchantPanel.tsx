import React, { useState } from "react";
import { ScrollView, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { C, R, SP, shadow } from "@/src/theme";
import { GOODS, TRIBE_BY_ID } from "@/src/game/data";
import { GameState, GoodType, Unit } from "@/src/game/types";

interface Props {
  state: GameState;
  merchant: Unit;
  bottomInset: number;
  onBuy: (merchantId: string, slotIndex: number, amount: number) => void;
  onClose: () => void;
}

const goodMeta = (id: GoodType) => GOODS.find((g) => g.id === id)!;

export default function BuyMerchantPanel({ state, merchant, bottomInset, onBuy, onClose }: Props) {
  const buyer = state.players[state.currentPlayer];
  const owner = state.players[merchant.owner];
  const tribe = TRIBE_BY_ID[owner.tribe];
  const slots = (merchant.cargo ?? []).map((s, i) => ({ ...s, i })).filter((s) => s.good && s.qty > 0);

  // Per-slot chosen quantity (defaults to 1).
  const [qty, setQty] = useState<Record<number, number>>({});
  const getQty = (slotIndex: number, max: number) => Math.min(Math.max(qty[slotIndex] ?? 1, 1), Math.max(max, 1));
  const setSlotQty = (slotIndex: number, value: number, max: number) => {
    setQty((prev) => ({ ...prev, [slotIndex]: Math.min(Math.max(value, 1), Math.max(max, 1)) }));
  };

  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset + 96 }]} pointerEvents="box-none">
      <View style={styles.card} testID="buy-merchant-panel">
        <View style={styles.header}>
          <MaterialCommunityIcons name="storefront" size={20} color={C.warning} />
          <Text style={styles.title}>{tribe.name} Merchant</Text>
          <View style={styles.walletChip}>
            <MaterialCommunityIcons name="star-four-points" size={13} color={C.warning} />
            <Text style={styles.walletText} testID="buy-stars">{buyer.stars}</Text>
          </View>
          <Pressable testID="buy-close" onPress={onClose} style={styles.close}>
            <MaterialCommunityIcons name="close" size={20} color={C.onSurface} />
          </Pressable>
        </View>

        {slots.length === 0 ? (
          <Text style={styles.empty}>This merchant has nothing left to sell.</Text>
        ) : (
          <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {slots.map((slot) => {
              const meta = goodMeta(slot.good!);
              const affordableMax = Math.floor(buyer.stars / slot.price);
              const maxBuy = Math.min(slot.qty, affordableMax); // most the player can take
              const canAfford = maxBuy >= 1;
              const n = getQty(slot.i, maxBuy);
              const total = n * slot.price;
              return (
                <View key={slot.i} style={styles.row}>
                  <View style={styles.rowTop}>
                    <MaterialCommunityIcons name={meta.icon as any} size={20} color={meta.color} />
                    <Text style={styles.goodName}>{meta.name}</Text>
                    <Text style={styles.avail}>x{slot.qty}</Text>
                    <View style={styles.priceChip}>
                      <MaterialCommunityIcons name="star-four-points" size={11} color={C.warning} />
                      <Text style={styles.priceText}>{slot.price} ea</Text>
                    </View>
                  </View>
                  <View style={styles.rowBottom}>
                    <View style={styles.stepper}>
                      <Pressable
                        testID={`buy-minus-${slot.i}`}
                        disabled={!canAfford || n <= 1}
                        onPress={() => setSlotQty(slot.i, n - 1, maxBuy)}
                        style={[styles.stepBtn, (!canAfford || n <= 1) && styles.stepOff]}
                      >
                        <MaterialCommunityIcons name="minus" size={16} color={C.onSurface} />
                      </Pressable>
                      <Text testID={`buy-qty-${slot.i}`} style={styles.qtyText}>{canAfford ? n : 0}</Text>
                      <Pressable
                        testID={`buy-plus-${slot.i}`}
                        disabled={!canAfford || n >= maxBuy}
                        onPress={() => setSlotQty(slot.i, n + 1, maxBuy)}
                        style={[styles.stepBtn, (!canAfford || n >= maxBuy) && styles.stepOff]}
                      >
                        <MaterialCommunityIcons name="plus" size={16} color={C.onSurface} />
                      </Pressable>
                      <Pressable
                        testID={`buy-max-${slot.i}`}
                        disabled={!canAfford || n >= maxBuy}
                        onPress={() => setSlotQty(slot.i, maxBuy, maxBuy)}
                        style={[styles.maxBtn, (!canAfford || n >= maxBuy) && styles.stepOff]}
                      >
                        <Text style={styles.maxText}>MAX</Text>
                      </Pressable>
                    </View>
                    <Pressable
                      testID={`buy-slot-${slot.i}`}
                      disabled={!canAfford}
                      onPress={() => { onBuy(merchant.id, slot.i, n); setSlotQty(slot.i, 1, maxBuy); }}
                      style={[styles.buyBtn, !canAfford && styles.buyOff]}
                    >
                      <MaterialCommunityIcons name="cart-plus" size={15} color="#fff" />
                      <Text style={styles.buyText}>Buy {canAfford ? n : ""}</Text>
                      <View style={styles.buyCost}>
                        <MaterialCommunityIcons name="star-four-points" size={11} color="#fff" />
                        <Text style={styles.buyText}>{canAfford ? total : "—"}</Text>
                      </View>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
        <Text style={styles.note}>Buying pays the owner in stars and moves the goods to your stockpile.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  card: { backgroundColor: C.surface, borderRadius: R.lg, padding: SP.md, borderWidth: 1, borderColor: C.border, ...shadow(8) },
  header: { flexDirection: "row", alignItems: "center", gap: SP.sm, marginBottom: SP.sm },
  title: { fontSize: 16, fontWeight: "900", color: C.onSurface, flex: 1 },
  walletChip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill },
  walletText: { fontWeight: "800", color: C.onSurface, fontSize: 12 },
  close: { padding: 6, backgroundColor: C.surfaceSecondary, borderRadius: R.pill },
  row: { backgroundColor: C.surfaceSecondary, borderRadius: R.md, paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  goodName: { fontSize: 14, fontWeight: "800", color: C.onSurface, flex: 1 },
  avail: { fontSize: 13, fontWeight: "800", color: C.onSurfaceSecondary },
  priceChip: { flexDirection: "row", alignItems: "center", gap: 2 },
  priceText: { fontSize: 13, fontWeight: "900", color: C.onSurface },
  stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepBtn: { width: 32, height: 32, borderRadius: R.sm, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  stepOff: { opacity: 0.35 },
  qtyText: { fontSize: 15, fontWeight: "900", color: C.onSurface, minWidth: 26, textAlign: "center" },
  maxBtn: { paddingHorizontal: 8, height: 32, borderRadius: R.sm, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  maxText: { fontSize: 11, fontWeight: "900", color: C.onSurfaceSecondary },
  buyBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.brand, paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.pill },
  buyOff: { opacity: 0.4 },
  buyCost: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: 2, paddingLeft: 6, borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.4)" },
  buyText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  empty: { fontSize: 13, color: C.onSurfaceSecondary, textAlign: "center", paddingVertical: SP.md },
  note: { fontSize: 11, color: C.onSurfaceSecondary, marginTop: SP.sm, textAlign: "center" },
});
