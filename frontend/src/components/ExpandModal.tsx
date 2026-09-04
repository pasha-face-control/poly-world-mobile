import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, R, SP, shadow } from "@/src/theme";

export interface ExpandTarget {
  tileId: number;
  cost: number;
  tier: number;
}

interface Props {
  target: ExpandTarget | null;
  stars: number;
  onBuy: () => void;
  onClose: () => void;
}

export default function ExpandModal({ target, stars, onBuy, onClose }: Props) {
  const visible = !!target;
  const cost = target?.cost ?? 0;
  const tier = target?.tier ?? 0;
  const canAfford = stars >= cost;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.dialog} testID="expand-modal" onPress={() => {}}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="vector-square-plus" size={34} color="#fff" />
          </View>
          <Text style={styles.title}>Expand Territory</Text>
          <Text style={styles.sub}>
            Claim this tile for your city (Tier {tier}). It becomes part of your borders — build, harvest and road it like any other cell.
          </Text>

          <Pressable
            testID="expand-buy"
            disabled={!canAfford}
            onPress={onBuy}
            style={[styles.buyBtn, !canAfford && styles.dim]}
          >
            <MaterialCommunityIcons name="map-marker-plus" size={20} color="#fff" />
            <Text style={styles.buyText}>Buy this tile</Text>
            <View style={styles.priceTag}>
              <MaterialCommunityIcons name="star-four-points" size={14} color="#fff" />
              <Text style={styles.buyText}>{cost}</Text>
            </View>
          </Pressable>

          {!canAfford && <Text style={styles.warn}>You need {cost} stars (you have {stars}).</Text>}

          <Pressable testID="expand-cancel" onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(28,28,28,0.6)", alignItems: "center", justifyContent: "center", padding: SP.xl },
  dialog: { width: "100%", maxWidth: 340, backgroundColor: C.surface, borderRadius: R.lg, padding: SP.xl, gap: SP.sm, alignItems: "stretch", ...shadow(10) },
  iconBox: { alignSelf: "center", width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center", backgroundColor: C.brand },
  title: { fontSize: 20, fontWeight: "900", color: C.onSurface, textAlign: "center" },
  sub: { fontSize: 13, color: C.onSurfaceSecondary, textAlign: "center", marginBottom: SP.sm },
  buyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SP.sm, backgroundColor: C.brand, borderRadius: R.md, paddingVertical: SP.md },
  dim: { opacity: 0.45 },
  buyText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  priceTag: { flexDirection: "row", alignItems: "center", gap: 3, marginLeft: 2, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.4)" },
  warn: { fontSize: 12, color: C.error, textAlign: "center", fontWeight: "700" },
  cancel: { alignSelf: "center", paddingVertical: 8, paddingHorizontal: 20, marginTop: 2 },
  cancelText: { fontSize: 14, fontWeight: "800", color: C.onSurfaceSecondary },
});
