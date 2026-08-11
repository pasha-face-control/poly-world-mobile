import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, R, SP, shadow } from "@/src/theme";
import { GOODS, RESOURCE_DEFS, UNIT_DEFS, levelThreshold } from "@/src/game/data";
import { canHarvest, canTrain, neighbors } from "@/src/game/engine";
import { City, GameState, UnitType } from "@/src/game/types";

interface Props {
  state: GameState;
  city: City;
  bottomInset: number;
  onTrain: (type: UnitType) => void;
  onHarvest: (tileId: number) => void;
  onClose: () => void;
}

const TRAINABLE: UnitType[] = ["warrior", "archer", "beefeater", "catapult", "rider", "armored_rider", "chivalry", "pikemen", "swordsmen", "merchant"];

export default function CityPanel({ state, city, bottomInset, onTrain, onHarvest, onClose }: Props) {
  const player = state.players[state.currentPlayer];
  const territory = [city.tileId, ...neighbors(state, city.tileId)];
  const harvestTiles = territory.filter((id) => {
    const r = state.tiles[id].resource;
    return r && RESOURCE_DEFS[r];
  });

  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset + 96 }]} pointerEvents="box-none">
      <View style={styles.card} testID="city-panel">
        <View style={styles.header}>
          <MaterialCommunityIcons name={city.isCapital ? "castle" : "home-city"} size={22} color={C.brand} />
          <Text style={styles.title}>{city.isCapital ? "Capital" : "City"} · Lvl {city.level}</Text>
          <View style={styles.headerStat}>
            <MaterialCommunityIcons name="account-group" size={15} color={C.onSurfaceSecondary} />
            <Text style={styles.headerStatText}>{city.population}/{levelThreshold(city.level)}</Text>
          </View>
          <View style={styles.headerStat}>
            <MaterialCommunityIcons name="star-four-points" size={15} color={C.warning} />
            <Text style={styles.headerStatText}>+{city.production}</Text>
          </View>
          <Pressable testID="city-close" onPress={onClose} style={styles.close}>
            <MaterialCommunityIcons name="close" size={20} color={C.onSurface} />
          </Pressable>
        </View>

        <Text style={styles.section}>Train Units</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {TRAINABLE.map((type) => {
            const def = UNIT_DEFS[type];
            const check = canTrain(state, player.index, city.id, type);
            const locked = !!def.requires && !player.techs.includes(def.requires);
            return (
              <Pressable
                key={type}
                testID={`train-${type}`}
                disabled={!check.ok}
                onPress={() => onTrain(type)}
                style={[styles.chip, !check.ok && styles.chipDisabled]}
              >
                <MaterialCommunityIcons name={def.icon as any} size={22} color={locked ? C.borderStrong : C.brand} />
                <Text style={styles.chipName}>{def.name}</Text>
                <View style={styles.chipCost}>
                  {locked ? (
                    <MaterialCommunityIcons name="lock" size={13} color={C.borderStrong} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="star-four-points" size={12} color={C.warning} />
                      <Text style={styles.chipCostText}>{def.cost}</Text>
                    </>
                  )}
                </View>
                {!locked && def.goods && (
                  <View style={styles.goodsRow}>
                    {GOODS.filter((g) => def.goods?.[g.id]).map((g) => {
                      const need = def.goods![g.id]!;
                      const enough = player.goods[g.id] >= need;
                      return (
                        <View key={g.id} style={styles.goodCost}>
                          <MaterialCommunityIcons name={g.icon as any} size={11} color={enough ? g.color : C.error} />
                          <Text style={[styles.goodCostText, !enough && { color: C.error }]}>{need}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {harvestTiles.length > 0 && (
          <>
            <Text style={styles.section}>Harvest (grow city)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {harvestTiles.map((id) => {
                const res = state.tiles[id].resource!;
                const def = RESOURCE_DEFS[res];
                const check = canHarvest(state, player.index, id);
                const locked = !player.techs.includes(def.tech);
                return (
                  <Pressable
                    key={id}
                    testID={`harvest-${id}`}
                    disabled={!check.ok}
                    onPress={() => onHarvest(id)}
                    style={[styles.chip, !check.ok && styles.chipDisabled]}
                  >
                    <MaterialCommunityIcons name={def.icon as any} size={22} color={locked ? C.borderStrong : C.success} />
                    <Text style={styles.chipName}>{def.name} +{def.pop}</Text>
                    <View style={styles.chipCost}>
                      {locked ? (
                        <MaterialCommunityIcons name="lock" size={13} color={C.borderStrong} />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="star-four-points" size={12} color={C.warning} />
                          <Text style={styles.chipCostText}>{def.cost}</Text>
                        </>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12 },
  card: {
    backgroundColor: C.surface,
    borderRadius: R.lg,
    padding: SP.md,
    borderWidth: 1,
    borderColor: C.border,
    ...shadow(8),
  },
  header: { flexDirection: "row", alignItems: "center", gap: SP.sm, marginBottom: SP.sm },
  title: { fontSize: 17, fontWeight: "900", color: C.onSurface },
  headerStat: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill },
  headerStatText: { fontWeight: "800", color: C.onSurface, fontSize: 12 },
  close: { marginLeft: "auto", padding: 6, backgroundColor: C.surfaceSecondary, borderRadius: R.pill },
  section: { fontSize: 12, fontWeight: "900", color: C.onSurfaceSecondary, textTransform: "uppercase", letterSpacing: 0.8, marginTop: SP.sm, marginBottom: SP.xs },
  row: { gap: SP.sm, paddingVertical: 4 },
  chip: {
    width: 94,
    backgroundColor: C.surfaceSecondary,
    borderRadius: R.md,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  chipDisabled: { opacity: 0.45 },
  chipName: { fontSize: 11, fontWeight: "800", color: C.onSurface, textAlign: "center" },
  chipCost: { flexDirection: "row", alignItems: "center", gap: 3 },
  chipCostText: { fontWeight: "900", fontSize: 12, color: C.onSurface },
  goodsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 5 },
  goodCost: { flexDirection: "row", alignItems: "center", gap: 1 },
  goodCostText: { fontSize: 10, fontWeight: "800", color: C.onSurface },
});
