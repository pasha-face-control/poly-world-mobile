import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { GOODS } from "@/src/game/data";
import { GoodType } from "@/src/game/types";
import { C, R, SP, shadow } from "@/src/theme";

interface Props {
  sale: { goods: Partial<Record<GoodType, number>>; stars: number } | null;
  onClose: () => void;
}

export default function SaleModal({ sale, onClose }: Props) {
  const visible = !!sale && sale.stars > 0;
  const entries = sale ? (Object.entries(sale.goods) as [GoodType, number][]).filter(([, q]) => q > 0) : [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.dialog} testID="sale-modal" onPress={() => {}}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="cash-register" size={34} color="#fff" />
          </View>
          <Text style={styles.title}>Merchant Sale!</Text>
          <Text style={styles.sub}>Your merchant sold goods this round.</Text>

          <View style={styles.rows}>
            {entries.map(([good, qty]) => {
              const def = GOODS.find((g) => g.id === good);
              return (
                <View key={good} style={styles.row} testID={`sale-row-${good}`}>
                  <View style={[styles.goodIcon, { backgroundColor: def?.color ?? C.brand }]}>
                    <MaterialCommunityIcons name={(def?.icon ?? "cube") as any} size={18} color="#fff" />
                  </View>
                  <Text style={styles.goodName}>{def?.name ?? good}</Text>
                  <Text style={styles.goodQty}>×{qty}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.earnedBox}>
            <MaterialCommunityIcons name="star-four-points" size={20} color={C.warning} />
            <Text style={styles.earnedText}>+{sale?.stars ?? 0} stars earned</Text>
          </View>

          <Pressable style={styles.btn} onPress={onClose} testID="sale-ok">
            <Text style={styles.btnText}>Great!</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(28,28,28,0.6)", alignItems: "center", justifyContent: "center", padding: SP.xl },
  dialog: { width: "100%", maxWidth: 340, backgroundColor: C.surface, borderRadius: R.lg, padding: SP.xl, gap: SP.sm, alignItems: "stretch", ...shadow(10) },
  iconBox: { alignSelf: "center", width: 62, height: 62, borderRadius: 31, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "900", color: C.onSurface, textAlign: "center" },
  sub: { fontSize: 13, color: C.onSurfaceSecondary, textAlign: "center", marginBottom: SP.sm },
  rows: { gap: SP.xs, backgroundColor: C.surfaceSecondary, borderRadius: R.md, padding: SP.md },
  row: { flexDirection: "row", alignItems: "center", gap: SP.md, paddingVertical: 4 },
  goodIcon: { width: 34, height: 34, borderRadius: R.sm, alignItems: "center", justifyContent: "center" },
  goodName: { flex: 1, fontSize: 15, fontWeight: "800", color: C.onSurface },
  goodQty: { fontSize: 16, fontWeight: "900", color: C.onSurface },
  earnedBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SP.xs, backgroundColor: C.brandTertiary, borderRadius: R.md, paddingVertical: SP.md, marginTop: SP.xs },
  earnedText: { fontSize: 16, fontWeight: "900", color: C.onSurface },
  btn: { backgroundColor: C.brand, borderRadius: R.md, paddingVertical: SP.md, alignItems: "center", marginTop: SP.xs },
  btnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
});
