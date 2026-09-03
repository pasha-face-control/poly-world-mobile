import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { C, R, SP, shadow } from "@/src/theme";
import { BUILDINGS, BUILDING_POP, GOODS, INFRA } from "@/src/game/data";
import { canBuild, canInfra } from "@/src/game/engine";
import { GameState } from "@/src/game/types";

interface Props {
  state: GameState;
  tileId: number;
  bottomInset: number;
  onBuild: (buildingId: string) => void;
  onInfra: (infraId: string) => void;
  onClose: () => void;
}

const goodMeta = (id: string) => GOODS.find((g) => g.id === id);

export default function BuildPanel({ state, tileId, bottomInset, onBuild, onInfra, onClose }: Props) {
  const player = state.players[state.currentPlayer];
  const tile = state.tiles[tileId];
  const options = BUILDINGS.filter((b) => b.terrain === tile.terrain);
  // Infra options that are terrain-relevant to this tile (validity handled by canInfra).
  const infraOptions = INFRA.filter((i) => {
    if (i.id === "road") return tile.terrain !== "water" && tile.terrain !== "mountain" && !tile.road;
    if (i.id === "port") return tile.terrain === "water" && !tile.port;
    if (i.id === "burn_forest") return tile.terrain === "forest";
    return false;
  });

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
                  {BUILDING_POP[b.id] > 0 && (
                    <View style={styles.produceItem}>
                      <MaterialCommunityIcons name="account-group" size={11} color={C.info} />
                      <Text style={[styles.produceText, { color: C.info }]}>+{BUILDING_POP[b.id]}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
          {infraOptions.map((i) => {
            const check = canInfra(state, player.index, tileId, i.id);
            const lockedTech = !player.techs.includes(i.tech);
            return (
              <Pressable key={i.id} testID={`infra-${i.id}`} disabled={!check.ok} onPress={() => onInfra(i.id)} style={[styles.chip, !check.ok && styles.chipDisabled]}>
                <View style={[styles.chipIcon, { backgroundColor: i.color }]}>
                  <MaterialCommunityIcons name={i.icon as any} size={20} color="#fff" />
                </View>
                <Text style={styles.chipName}>{i.name}</Text>
                <View style={styles.chipCost}>
                  {lockedTech ? (
                    <MaterialCommunityIcons name="lock" size={12} color={C.borderStrong} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="star-four-points" size={11} color={C.warning} />
                      <Text style={styles.chipCostText}>{i.cost}</Text>
                    </>
                  )}
                </View>
                <Text style={styles.infraDesc} numberOfLines={2}>{i.desc}</Text>
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
  infraDesc: { fontSize: 9, color: C.onSurfaceSecondary, textAlign: "center", lineHeight: 11 },
});
