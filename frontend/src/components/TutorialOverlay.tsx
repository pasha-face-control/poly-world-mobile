import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, R, SP, shadow } from "@/src/theme";

interface Step { icon: string; title: string; body: string }

const STEPS: Step[] = [
  { icon: "hexagon-multiple", title: "Welcome, Chief!", body: "Lead your tribe to conquer every rival. Here's a 30-second crash course — you can reopen this any time from the pause menu." },
  { icon: "gesture-tap", title: "Move your units", body: "Tap a unit to select it, then tap a highlighted yellow tile to move. Units glide to their new spot. Use the Next button to jump to your next ready unit." },
  { icon: "sword-cross", title: "Battle & capture", body: "Tap an enemy on a red tile to attack. Defeat the last defender of a city and move in to capture it. Move onto a neutral village to found a new city." },
  { icon: "home-city", title: "Grow your cities", body: "Tap a city to train units and harvest nearby food, ore and crops. Harvesting grows population — full cities level up and let you pick a reward." },
  { icon: "file-tree", title: "Research tech", body: "Open the Tech tree to unlock new units, roads, ports & boats, and the Merchant for trading. Each tech opens new strategies. Now go — expand and exterminate!" },
];

export default function TutorialOverlay({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const close = () => {
    setI(0);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.card} testID="tutorial-overlay">
          <Pressable testID="tutorial-skip" onPress={close} style={styles.skip}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name={step.icon as any} size={40} color="#fff" />
          </View>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>

          <View style={styles.dots}>
            {STEPS.map((_, k) => (
              <View key={k} style={[styles.dot, k === i && styles.dotActive]} />
            ))}
          </View>

          <View style={styles.nav}>
            {i > 0 ? (
              <Pressable testID="tutorial-back" onPress={() => setI(i - 1)} style={[styles.navBtn, styles.navSecondary]}>
                <MaterialCommunityIcons name="chevron-left" size={20} color={C.onSurface} />
                <Text style={styles.navSecondaryText}>Back</Text>
              </Pressable>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Pressable
              testID={last ? "tutorial-done" : "tutorial-next"}
              onPress={() => (last ? close() : setI(i + 1))}
              style={[styles.navBtn, styles.navPrimary]}
            >
              <Text style={styles.navPrimaryText}>{last ? "Start Playing" : "Next"}</Text>
              {!last && <MaterialCommunityIcons name="chevron-right" size={20} color="#fff" />}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(28,28,28,0.7)", alignItems: "center", justifyContent: "center", padding: SP.xl },
  card: { width: "100%", maxWidth: 360, backgroundColor: C.surface, borderRadius: R.lg, padding: SP.xl, alignItems: "center", gap: SP.sm, ...shadow(12) },
  skip: { position: "absolute", top: SP.md, right: SP.md, padding: 6, zIndex: 2 },
  skipText: { fontSize: 13, fontWeight: "800", color: C.onSurfaceSecondary },
  iconBox: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.brand, alignItems: "center", justifyContent: "center", marginTop: SP.sm, marginBottom: SP.xs },
  title: { fontSize: 22, fontWeight: "900", color: C.onSurface, textAlign: "center" },
  body: { fontSize: 14, color: C.onSurfaceSecondary, textAlign: "center", lineHeight: 21, minHeight: 84 },
  dots: { flexDirection: "row", gap: 6, marginVertical: SP.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.border },
  dotActive: { backgroundColor: C.brand, width: 18 },
  nav: { flexDirection: "row", alignItems: "center", gap: SP.sm, width: "100%" },
  navBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 12, borderRadius: R.md, flex: 1 },
  navPrimary: { backgroundColor: C.brand },
  navPrimaryText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  navSecondary: { backgroundColor: C.surfaceSecondary },
  navSecondaryText: { color: C.onSurface, fontWeight: "800", fontSize: 15 },
});
