import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { C, R, shadow } from "@/src/theme";
import { GameState } from "@/src/game/types";
import { TRIBE_BY_ID, GOODS } from "@/src/game/data";
import { starIncome } from "@/src/game/engine";

export default function TopHUD({ state, topInset }: { state: GameState; topInset: number }) {
  const player = state.players[state.currentPlayer];
  const color = TRIBE_BY_ID[player.tribe].color;
  const cities = state.cities.filter((c) => c.owner === player.index).length;
  const income = starIncome(state, player.index);

  return (
    <View style={[styles.wrap, { top: topInset + 8 }]} pointerEvents="box-none">
      <BlurView intensity={40} tint="light" style={styles.pill} testID="top-hud">
        <View style={styles.item}>
          <MaterialCommunityIcons name="star-four-points" size={18} color={C.warning} />
          <Text style={styles.value} testID="hud-income">+{income}</Text>
        </View>
        <View style={styles.sep} />
        <View style={styles.item}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text style={styles.value} numberOfLines={1}>{player.name}</Text>
        </View>
        <View style={styles.sep} />
        <View style={styles.item}>
          <MaterialCommunityIcons name="home-city" size={16} color={C.onSurface} />
          <Text style={styles.value}>{cities}</Text>
        </View>
        <View style={styles.sep} />
        <View style={styles.item}>
          <MaterialCommunityIcons name="flag" size={16} color={C.brand} />
          <Text style={styles.value} testID="hud-turn">T{state.turn}</Text>
        </View>
      </BlurView>

      <BlurView intensity={40} tint="light" style={styles.goodsPill} testID="hud-goods">
        <View style={styles.good} testID="hud-stars">
          <MaterialCommunityIcons name="star-four-points" size={14} color={C.warning} />
          <Text style={styles.goodValue}>{player.stars}</Text>
        </View>
        <View style={styles.goodSep} />
        {GOODS.map((g) => (
          <View key={g.id} style={styles.good} testID={`hud-good-${g.id}`}>
            <MaterialCommunityIcons name={g.icon as any} size={14} color={g.color} />
            <Text style={styles.goodValue}>{player.goods[g.id]}</Text>
          </View>
        ))}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 6 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: R.pill,
    overflow: "hidden",
    backgroundColor: "rgba(248,246,240,0.75)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    ...shadow(4),
  },
  goodsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: R.pill,
    overflow: "hidden",
    backgroundColor: "rgba(248,246,240,0.75)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    ...shadow(3),
  },
  good: { flexDirection: "row", alignItems: "center", gap: 3 },
  goodSep: { width: 1, height: 14, backgroundColor: C.border },
  goodValue: { fontSize: 13, fontWeight: "900", color: C.onSurface },
  item: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: 130 },
  value: { fontSize: 15, fontWeight: "900", color: C.onSurface },
  dot: { width: 12, height: 12, borderRadius: 6 },
  sep: { width: 1, height: 18, backgroundColor: C.border, marginHorizontal: 12 },
});
