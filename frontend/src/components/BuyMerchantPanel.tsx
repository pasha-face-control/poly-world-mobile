import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, R, SP, shadow } from "@/src/theme";
import { GOODS, TRIBE_BY_ID } from "@/src/game/data";
import { GameState, GoodType, Unit } from "@/src/game/types";

interface Props {
  state: GameState;
  merchant: Unit;
  bottomInset: number;
  onBuy: (merchantId: string, good: GoodType, amount: number) => void;
  onClose: () => void;
}

export default function BuyMerchantPanel({ state, merchant, bottomInset, onBuy, onClose }: Props) {
  const buyer = state.players[state.currentPlayer];
  const owner = state.players[merchant.owner];
  const tribe = TRIBE_BY_ID[owner.tribe];
  const cargo = merchant.cargo ?? ({} as Record<GoodType, number>);
  const price = merchant.price ?? 3;
  const forSale = GOODS.filter((g) => (cargo[g.id] ?? 0) > 0);

  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset + 96 }]} pointerEvents="box-none">
      <View style={styles.card} testID="buy-merchant-panel">
        <View style={styles.header}>
          <MaterialCommunityIcons name="storefront" size={20} color={C.warning} />
          <View style={styles.titleWrap}>
            <Text style={styles.title}>{tribe.name} Merchant</Text>
            <View style={styles.priceTag}>
              <Text style={styles.priceLabel}>Buy at</Text>
              <MaterialCommunityIcons name="star-four-points" size={12} color={C.warning} />
              <Text style={styles.priceValue}>{price}</Text>
              <Text style={styles.priceLabel}>/ unit</Text>
            </View>
          </View>
          <View style={styles.walletChip}>
            <MaterialCommunityIcons name="star-four-points" size={13} color={C.warning} />
            <Text style={styles.walletText} testID="buy-stars">{buyer.stars}</Text>
          </View>
          <Pressable testID="buy-close" onPress={onClose} style={styles.close}>
            <MaterialCommunityIcons name="close" size={20} color={C.onSurface} />
          </Pressable>
        </View>

        {forSale.length === 0 ? (
          <Text style={styles.empty}>This merchant has nothing left to sell.</Text>
        ) : (
          <View style={styles.list}>
            {forSale.map((g) => {
              const avail = cargo[g.id] ?? 0;
              const canAfford = buyer.stars >= price;
              return (
                <View key={g.id} style={styles.row}>
                  <MaterialCommunityIcons name={g.icon as any} size={20} color={g.color} />
                  <Text style={styles.goodName}>{g.name}</Text>
                  <Text style={styles.avail}>x{avail}</Text>
                  <Pressable
                    testID={`buy-${g.id}`}
                    disabled={!canAfford || avail <= 0}
                    onPress={() => onBuy(merchant.id, g.id, 1)}
                    style={[styles.buyBtn, (!canAfford || avail <= 0) && styles.buyOff]}
                  >
                    <MaterialCommunityIcons name="cart-plus" size={15} color="#fff" />
                    <Text style={styles.buyText}>Buy</Text>
                    <View style={styles.cost}>
                      <MaterialCommunityIcons name="star-four-points" size={11} color="#fff" />
                      <Text style={styles.buyText}>{price}</Text>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
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
  titleWrap: { flex: 1 },
  title: { fontSize: 16, fontWeight: "900", color: C.onSurface },
  priceTag: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  priceLabel: { fontSize: 11, color: C.onSurfaceSecondary, fontWeight: "700" },
  priceValue: { fontSize: 12, fontWeight: "900", color: C.onSurface },
  walletChip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill },
  walletText: { fontWeight: "800", color: C.onSurface, fontSize: 12 },
  close: { padding: 6, backgroundColor: C.surfaceSecondary, borderRadius: R.pill },
  list: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.surfaceSecondary, borderRadius: R.md, paddingHorizontal: 10, paddingVertical: 8 },
  goodName: { fontSize: 14, fontWeight: "800", color: C.onSurface, flex: 1 },
  avail: { fontSize: 13, fontWeight: "800", color: C.onSurfaceSecondary, marginRight: 4 },
  buyBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.brand, paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.pill },
  buyOff: { opacity: 0.4 },
  buyText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  cost: { flexDirection: "row", alignItems: "center", gap: 1, marginLeft: 2 },
  empty: { fontSize: 13, color: C.onSurfaceSecondary, textAlign: "center", paddingVertical: SP.md },
  note: { fontSize: 11, color: C.onSurfaceSecondary, marginTop: SP.sm, textAlign: "center" },
});
