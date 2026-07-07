import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, R, SP, shadow } from "@/src/theme";
import { TECHS } from "@/src/game/data";
import { techCost } from "@/src/game/engine";
import { GameState } from "@/src/game/types";

interface Props {
  visible: boolean;
  state: GameState;
  onResearch: (techId: string) => void;
  onClose: () => void;
  topInset: number;
}

export default function TechTreeModal({ visible, state, onResearch, onClose, topInset }: Props) {
  const player = state.players[state.currentPlayer];
  const known = player.techs;

  const tier1 = TECHS.filter((t) => t.tier === 1);
  const tier2 = TECHS.filter((t) => t.tier === 2);

  const renderTech = (id: string) => {
    const tech = TECHS.find((t) => t.id === id)!;
    const researched = known.includes(tech.id);
    const unlocked = !tech.requires || known.includes(tech.requires);
    const cost = techCost(state, player.index, tech.id);
    const affordable = player.stars >= cost;
    const canResearch = !researched && unlocked && affordable;

    return (
      <Pressable
        key={tech.id}
        testID={`tech-${tech.id}`}
        disabled={!canResearch}
        onPress={() => onResearch(tech.id)}
        style={[
          styles.node,
          researched && styles.nodeDone,
          !unlocked && styles.nodeLocked,
        ]}
      >
        <MaterialCommunityIcons name={tech.icon as any} size={26} color={researched ? "#fff" : unlocked ? C.brand : C.borderStrong} />
        <Text style={[styles.nodeName, researched && { color: "#fff" }]}>{tech.name}</Text>
        <Text style={[styles.nodeDesc, researched && { color: "rgba(255,255,255,0.85)" }]} numberOfLines={2}>
          {tech.desc}
        </Text>
        {researched ? (
          <View style={styles.doneTag}>
            <MaterialCommunityIcons name="check-bold" size={14} color="#fff" />
            <Text style={styles.doneTagText}>Researched</Text>
          </View>
        ) : (
          <View style={[styles.costTag, canResearch ? styles.costOk : styles.costNo]}>
            <MaterialCommunityIcons name="star-four-points" size={13} color={C.onSurface} />
            <Text style={styles.costText}>{cost}</Text>
            {!unlocked && <MaterialCommunityIcons name="lock" size={12} color={C.borderStrong} style={{ marginLeft: 4 }} />}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingTop: topInset }]}>
        <View style={styles.sheet} testID="tech-tree-modal">
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Technology</Text>
              <Text style={styles.sub}>Research unlocks units, terrain & bonuses</Text>
            </View>
            <View style={styles.starsChip}>
              <MaterialCommunityIcons name="star-four-points" size={16} color={C.warning} />
              <Text style={styles.starsText}>{player.stars}</Text>
            </View>
            <Pressable testID="tech-close" onPress={onClose} style={styles.close}>
              <MaterialCommunityIcons name="close" size={22} color={C.onSurface} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 40 }}>
            <Text style={styles.tierLabel}>Tier I</Text>
            <View style={styles.grid}>{tier1.map((t) => renderTech(t.id))}</View>
            <Text style={styles.tierLabel}>Tier II</Text>
            <View style={styles.grid}>{tier2.map((t) => renderTech(t.id))}</View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(28,28,28,0.5)" },
  sheet: { flex: 1, backgroundColor: C.surface, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, marginTop: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: SP.lg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: SP.sm,
  },
  title: { fontSize: 22, fontWeight: "900", color: C.onSurface },
  sub: { fontSize: 12, color: C.onSurfaceSecondary, marginTop: 2 },
  starsChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.brandTertiary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill, marginLeft: "auto" },
  starsText: { fontWeight: "900", color: C.onSurface },
  close: { padding: 6, backgroundColor: C.surfaceSecondary, borderRadius: R.pill },
  tierLabel: { fontSize: 14, fontWeight: "900", color: C.onSurfaceSecondary, marginTop: SP.md, marginBottom: SP.sm, textTransform: "uppercase", letterSpacing: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SP.md },
  node: {
    width: "47%",
    backgroundColor: C.brandTertiary,
    borderRadius: R.md,
    padding: SP.md,
    minHeight: 130,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.06)",
    ...shadow(2),
  },
  nodeDone: { backgroundColor: C.brand, borderColor: C.brand },
  nodeLocked: { opacity: 0.6, backgroundColor: C.surfaceSecondary },
  nodeName: { fontSize: 16, fontWeight: "900", color: C.onSurface, marginTop: 6 },
  nodeDesc: { fontSize: 11, color: C.onSurfaceSecondary, marginTop: 4, flex: 1 },
  doneTag: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 6 },
  doneTagText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  costTag: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill, marginTop: 6 },
  costOk: { backgroundColor: C.surface },
  costNo: { backgroundColor: C.surfaceTertiary },
  costText: { fontWeight: "900", color: C.onSurface },
});
