import React, { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, R, SP, shadow } from "@/src/theme";
import { TECHS, TECH_BY_ID } from "@/src/game/data";
import { techCost } from "@/src/game/engine";
import { GameState } from "@/src/game/types";

interface Props {
  visible: boolean;
  state: GameState;
  onResearch: (techId: string) => void;
  onClose: () => void;
  topInset: number;
}

const RING = 150;
const NODE = 64;

interface Node {
  id: string;
  x: number;
  y: number;
  depth: number;
}

// Radial tree layout: virtual center -> 4 roots -> branches.
function computeLayout() {
  const childrenOf: Record<string, string[]> = {};
  const roots: string[] = [];
  for (const t of TECHS) {
    if (t.requires) (childrenOf[t.requires] ||= []).push(t.id);
    else roots.push(t.id);
  }
  // Count leaves per subtree to allocate angular width.
  const leafCount: Record<string, number> = {};
  const countLeaves = (id: string): number => {
    const ch = childrenOf[id] || [];
    if (!ch.length) return (leafCount[id] = 1);
    return (leafCount[id] = ch.reduce((s, c) => s + countLeaves(c), 0));
  };
  const totalLeaves = roots.reduce((s, r) => s + countLeaves(r), 0);

  const nodes: Record<string, Node> = {};
  const angleStep = (Math.PI * 2) / totalLeaves;
  let cursor = 0; // leaf index cursor

  const place = (id: string, depth: number): number => {
    const ch = childrenOf[id] || [];
    let angle: number;
    if (!ch.length) {
      angle = (cursor + 0.5) * angleStep;
      cursor += 1;
    } else {
      const childAngles = ch.map((c) => place(c, depth + 1));
      angle = childAngles.reduce((a, b) => a + b, 0) / childAngles.length;
    }
    nodes[id] = { id, x: Math.cos(angle - Math.PI / 2) * depth * RING, y: Math.sin(angle - Math.PI / 2) * depth * RING, depth };
    return angle;
  };
  roots.forEach((r) => place(r, 1));

  // Normalize to positive coords with padding.
  const xs = Object.values(nodes).map((n) => n.x);
  const ys = Object.values(nodes).map((n) => n.y);
  const pad = NODE + 40;
  const minX = Math.min(0, ...xs) - pad;
  const minY = Math.min(0, ...ys) - pad;
  const maxX = Math.max(0, ...xs) + pad;
  const maxY = Math.max(0, ...ys) + pad;
  const ox = -minX;
  const oy = -minY;
  Object.values(nodes).forEach((n) => {
    n.x += ox;
    n.y += oy;
  });
  return { nodes, center: { x: ox, y: oy }, w: maxX - minX, h: maxY - minY, childrenOf, roots };
}

export default function TechTreeModal({ visible, state, onResearch, onClose, topInset }: Props) {
  const player = state.players[state.currentPlayer];
  const known = player.techs;
  const layout = useMemo(computeLayout, []);

  const edges: React.ReactNode[] = [];
  for (const t of TECHS) {
    const n = layout.nodes[t.id];
    const p = t.requires ? layout.nodes[t.requires] : layout.center;
    const researched = known.includes(t.id);
    edges.push(<Line key={`e${t.id}`} x1={p.x} y1={p.y} x2={n.x} y2={n.y} stroke={researched ? C.brand : "#C9C3B2"} strokeWidth={researched ? 5 : 3} />);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingTop: topInset }]}>
        <View style={styles.sheet} testID="tech-tree-modal">
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Technology Tree</Text>
              <Text style={styles.sub}>Tap a lit node to research it</Text>
            </View>
            <View style={styles.starsChip}>
              <MaterialCommunityIcons name="star-four-points" size={16} color={C.warning} />
              <Text style={styles.starsText}>{player.stars}</Text>
            </View>
            <Pressable testID="tech-close" onPress={onClose} style={styles.close}>
              <MaterialCommunityIcons name="close" size={22} color={C.onSurface} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ minHeight: layout.h }} showsVerticalScrollIndicator={false}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ width: layout.w, height: layout.h }}
              contentOffset={{ x: layout.center.x - 160, y: 0 }}
            >
              <View style={{ width: layout.w, height: layout.h }}>
                <Svg width={layout.w} height={layout.h} style={StyleSheet.absoluteFill}>
                  {edges}
                </Svg>

                {/* Center start node */}
                <View style={[styles.node, styles.center, { left: layout.center.x - NODE / 2, top: layout.center.y - NODE / 2 }]}>
                  <MaterialCommunityIcons name="castle" size={26} color="#fff" />
                </View>

                {TECHS.map((t) => {
                  const n = layout.nodes[t.id];
                  const researched = known.includes(t.id);
                  const unlocked = !t.requires || known.includes(t.requires);
                  const cost = techCost(state, player.index, t.id);
                  const affordable = player.stars >= cost;
                  const canResearch = !researched && unlocked && affordable;
                  return (
                    <View key={t.id} style={{ position: "absolute", left: n.x - NODE / 2, top: n.y - NODE / 2, width: NODE, alignItems: "center" }}>
                      <Pressable
                        testID={`tech-${t.id}`}
                        disabled={!canResearch}
                        onPress={() => onResearch(t.id)}
                        style={[styles.node, researched ? styles.nodeDone : unlocked ? styles.nodeOpen : styles.nodeLocked, canResearch && styles.nodeReady]}
                      >
                        <MaterialCommunityIcons name={t.icon as any} size={24} color={researched ? "#fff" : unlocked ? C.brand : C.borderStrong} />
                        {!researched && (
                          <View style={styles.costTag}>
                            {unlocked ? (
                              <MaterialCommunityIcons name="star-four-points" size={9} color={C.warning} />
                            ) : (
                              <MaterialCommunityIcons name="lock" size={9} color={C.borderStrong} />
                            )}
                            <Text style={styles.costText}>{cost}</Text>
                          </View>
                        )}
                      </Pressable>
                      <Text style={styles.nodeLabel} numberOfLines={2}>
                        {t.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </ScrollView>

          {/* Selected tech detail hint */}
          <View style={styles.legend}>
            <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: C.brand }]} /><Text style={styles.legendText}>Researched</Text></View>
            <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: C.brandTertiary, borderWidth: 2, borderColor: C.warning }]} /><Text style={styles.legendText}>Available</Text></View>
            <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: C.surfaceSecondary }]} /><Text style={styles.legendText}>Locked</Text></View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(28,28,28,0.5)" },
  sheet: { flex: 1, backgroundColor: C.surface, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, marginTop: 40, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", padding: SP.lg, borderBottomWidth: 1, borderBottomColor: C.border, gap: SP.sm },
  title: { fontSize: 22, fontWeight: "900", color: C.onSurface },
  sub: { fontSize: 12, color: C.onSurfaceSecondary, marginTop: 2 },
  starsChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.brandTertiary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill, marginLeft: "auto" },
  starsText: { fontWeight: "900", color: C.onSurface },
  close: { padding: 6, backgroundColor: C.surfaceSecondary, borderRadius: R.pill },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: "center", justifyContent: "center", ...shadow(2) },
  center: { position: "absolute", backgroundColor: C.surfaceInverse, borderWidth: 3, borderColor: C.brandSecondary },
  nodeDone: { backgroundColor: C.brand, borderWidth: 3, borderColor: C.brandSecondary },
  nodeOpen: { backgroundColor: C.brandTertiary, borderWidth: 2, borderColor: "rgba(0,0,0,0.08)" },
  nodeReady: { borderWidth: 3, borderColor: C.warning },
  nodeLocked: { backgroundColor: C.surfaceSecondary, borderWidth: 2, borderColor: C.border },
  nodeLabel: { fontSize: 10, fontWeight: "800", color: C.onSurface, textAlign: "center", marginTop: 3, width: NODE + 24 },
  costTag: { position: "absolute", bottom: -6, flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: C.surface, paddingHorizontal: 6, paddingVertical: 1, borderRadius: R.pill, borderWidth: 1, borderColor: C.border },
  costText: { fontWeight: "900", color: C.onSurface, fontSize: 10 },
  legend: { flexDirection: "row", justifyContent: "center", gap: SP.lg, paddingVertical: SP.sm, borderTopWidth: 1, borderTopColor: C.border },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  legendText: { fontSize: 11, fontWeight: "700", color: C.onSurfaceSecondary },
});
