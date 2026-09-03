import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, R, SP, shadow } from "@/src/theme";

interface Props {
  visible: boolean;
  stars: number;
  onHire: () => void;
  onHunt: () => void;
  onClose: () => void;
}

export default function HuntChoiceModal({ visible, stars, onHire, onHunt, onClose }: Props) {
  const canHire = stars >= 3;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.dialog} testID="hunt-choice-modal" onPress={() => {}}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="cow" size={38} color="#fff" />
          </View>
          <Text style={styles.title}>Wild Bull</Text>
          <Text style={styles.sub}>How do you want to take it down?</Text>

          <Pressable testID="hunt-hire" disabled={!canHire} onPress={onHire} style={[styles.opt, !canHire && styles.dim]}>
            <View style={[styles.optIcon, { backgroundColor: C.brand }]}>
              <MaterialCommunityIcons name="account-hard-hat" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optName}>Hire a Hunter</Text>
              <Text style={styles.optDesc}>Instant · reward +1 population, +1 meat</Text>
            </View>
            <View style={styles.priceTag}>
              <MaterialCommunityIcons name="star-four-points" size={13} color={C.warning} />
              <Text style={styles.priceText}>3</Text>
            </View>
          </Pressable>

          <Pressable testID="hunt-play" onPress={onHunt} style={styles.opt}>
            <View style={[styles.optIcon, { backgroundColor: "#3E6B3A" }]}>
              <MaterialCommunityIcons name="bow-arrow" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optName}>Hunt Yourself</Text>
              <Text style={styles.optDesc}>Play the bow mini-game · free</Text>
            </View>
            <View style={styles.priceTag}>
              <MaterialCommunityIcons name="star-four-points" size={13} color={C.onSurfaceSecondary} />
              <Text style={[styles.priceText, { color: C.onSurfaceSecondary }]}>0</Text>
            </View>
          </Pressable>

          <Pressable testID="hunt-cancel" onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(28,28,28,0.6)", alignItems: "center", justifyContent: "center", padding: SP.xl },
  dialog: { width: "100%", maxWidth: 360, backgroundColor: C.surface, borderRadius: R.lg, padding: SP.xl, gap: SP.sm, alignItems: "stretch", ...shadow(10) },
  iconBox: { alignSelf: "center", width: 66, height: 66, borderRadius: 33, backgroundColor: "#8A5A2B", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "900", color: C.onSurface, textAlign: "center" },
  sub: { fontSize: 13, color: C.onSurfaceSecondary, textAlign: "center", marginBottom: SP.sm },
  opt: { flexDirection: "row", alignItems: "center", gap: SP.md, backgroundColor: C.surfaceSecondary, borderRadius: R.md, padding: SP.md },
  dim: { opacity: 0.45 },
  optIcon: { width: 42, height: 42, borderRadius: R.md, alignItems: "center", justifyContent: "center" },
  optName: { fontSize: 15, fontWeight: "900", color: C.onSurface },
  optDesc: { fontSize: 12, color: C.onSurfaceSecondary, marginTop: 2 },
  priceTag: { flexDirection: "row", alignItems: "center", gap: 2 },
  priceText: { fontSize: 15, fontWeight: "900", color: C.warning },
  cancel: { alignSelf: "center", paddingVertical: 8, paddingHorizontal: 20, marginTop: 4 },
  cancelText: { fontSize: 14, fontWeight: "800", color: C.onSurfaceSecondary },
});
