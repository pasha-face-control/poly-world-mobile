import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, R, SP, shadow } from "@/src/theme";

export interface CityOffer {
  cityId: string;
  buyerName: string;
  price: number;
  level: number;
}

interface Props {
  offer: CityOffer | null;
  onAccept: () => void;
  onDecline: () => void;
}

export default function OfferModal({ offer, onAccept, onDecline }: Props) {
  const visible = !!offer;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={styles.overlay}>
        <View style={styles.dialog} testID="offer-modal">
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="hand-coin" size={34} color="#fff" />
          </View>
          <Text style={styles.title}>City Purchase Offer</Text>
          <Text style={styles.sub}>
            <Text style={styles.bold}>{offer?.buyerName}</Text> wants to buy your city (Lvl {offer?.level ?? 1}).
          </Text>

          <View style={styles.earnedBox}>
            <MaterialCommunityIcons name="star-four-points" size={22} color={C.warning} />
            <Text style={styles.earnedText}>You would receive {offer?.price ?? 0} stars</Text>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.declineBtn} onPress={onDecline} testID="offer-decline">
              <MaterialCommunityIcons name="close" size={18} color={C.onSurface} />
              <Text style={styles.declineText}>Decline</Text>
            </Pressable>
            <Pressable style={styles.acceptBtn} onPress={onAccept} testID="offer-accept">
              <MaterialCommunityIcons name="check" size={18} color="#fff" />
              <Text style={styles.acceptText}>Accept Deal</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(28,28,28,0.6)", alignItems: "center", justifyContent: "center", padding: SP.xl },
  dialog: { width: "100%", maxWidth: 340, backgroundColor: C.surface, borderRadius: R.lg, padding: SP.xl, gap: SP.sm, alignItems: "stretch", ...shadow(10) },
  iconBox: { alignSelf: "center", width: 62, height: 62, borderRadius: 31, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 21, fontWeight: "900", color: C.onSurface, textAlign: "center" },
  sub: { fontSize: 14, color: C.onSurfaceSecondary, textAlign: "center", marginBottom: SP.sm },
  bold: { fontWeight: "900", color: C.onSurface },
  earnedBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SP.xs, backgroundColor: C.brandTertiary, borderRadius: R.md, paddingVertical: SP.md },
  earnedText: { fontSize: 16, fontWeight: "900", color: C.onSurface },
  actions: { flexDirection: "row", gap: SP.sm, marginTop: SP.sm },
  declineBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: C.surfaceSecondary, borderRadius: R.md, paddingVertical: SP.md },
  declineText: { color: C.onSurface, fontWeight: "900", fontSize: 15 },
  acceptBtn: { flex: 1.4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: C.brand, borderRadius: R.md, paddingVertical: SP.md },
  acceptText: { color: "#fff", fontWeight: "900", fontSize: 15 },
});
