import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, R, SP, shadow } from "@/src/theme";
import { BUILDINGS, GOODS } from "@/src/game/data";
import { canBuild } from "@/src/game/engine";
import { GameState } from "@/src/game/types";

interface Props {
  state: GameState;
  tileId: number;
  bottomInset: number;
  onBuild: (buildingId: string) => void;
  onClose: () => void;
}

const goodMeta = (id: string) => GOODS.find((g) => g.id === id);

export default function BuildPanel({ state, tileId, bottomInset, onBuild, onClose }: Props) {
  const player = state.players[state.currentPlayer];
  const tile = state.tiles[tileId];
  const options = BUILDINGS.filter((b) => b.terrain === tile.terrain);

  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset + 96 }]} pointerEvents="box-none">
      <View style={styles.card} testID="build-panel">
        <View style={styles.header}>
          <MaterialCommunityIcons name="hammer" size={20} color={C.brand} />
          <Text style={styles.title}>Build on {tile.terrain}</Text>
          <Pressable testID="build-close" onPress={onClose} style={styles.close}>
            <MaterialCommunityIcons name="close" size={20} color={C.onSurface} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {options.map((b) => {
            const check = canBuild(state, player.index, tileId, b.id);
            const lockedTech = !player.techs.includes(b.tech);
            return (
              <Pressable key={b.id} testID={`build-${b.id}`} disabled={!check.ok} onPress={() => onBuild(b.id)} style={[styles.chip, !check.ok && styles.chipDisabled]}>
                <View style={[styles.chipIcon, { backgroundColor: b.color }]}>
                  <MaterialCommunityIcons name={b.icon as any} size={20} color="#fff" />
                </View>
                <Text style={styles.chipName}>{b.name}</Text>
                <View style={styles.chipCost}>
                  {lockedTech ? (
                    <MaterialCommunityIcons name="lock" size={12} color={C.borderStrong} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="star-four-points" size={11} color={C.warning} />
                      <Text style={styles.chipCostText}>{b.cost}</Text>
                    </>
                  )}
                </View>
                <View style={styles.produce}>
                  {Object.entries(b.produces).map(([key, amt]) => (
                    <View key={key} style={styles.produceItem}>
                      <MaterialCommunityIcons
                        name={(key === "stars" ? "star-four-points" : (goodMeta(key)?.icon ?? "help")) as any}
                        size={11}
                        color={key === "stars" ? C.warning : goodMeta(key)?.color ?? C.onSurface}
                      />
                      <Text style={styles.produceText}>+{amt}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  card: { backgroundColor: C.surface, borderRadius: R.lg, padding: SP.md, borderWidth: 1, borderColor: C.border, ...shadow(8) },
  header: { flexDirection: "row", alignItems: "center", gap: SP.sm, marginBottom: SP.sm },
  title: { fontSize: 16, fontWeight: "900", color: C.onSurface, textTransform: "capitalize" },
  close: { marginLeft: "auto", padding: 6, backgroundColor: C.surfaceSecondary, borderRadius: R.pill },
  row: { gap: SP.sm, paddingVertical: 4 },
  chip: { width: 96, backgroundColor: C.surfaceSecondary, borderRadius: R.md, paddingVertical: 10, paddingHorizontal: 4, alignItems: "center", gap: 4, flexShrink: 0 },
  chipDisabled: { opacity: 0.45 },
  chipIcon: { width: 38, height: 38, borderRadius: R.sm, alignItems: "center", justifyContent: "center" },
  chipName: { fontSize: 11, fontWeight: "800", color: C.onSurface, textAlign: "center" },
  chipCost: { flexDirection: "row", alignItems: "center", gap: 3 },
  chipCostText: { fontWeight: "900", fontSize: 12, color: C.onSurface },
  produce: { flexDirection: "row", gap: 6 },
  produceItem: { flexDirection: "row", alignItems: "center", gap: 1 },
  produceText: { fontSize: 10, fontWeight: "800", color: C.success },
});
