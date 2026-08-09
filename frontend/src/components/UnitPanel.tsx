import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, R, SP, shadow } from "@/src/theme";
import { BOAT_DEFS, UNIT_DEFS, unitStats } from "@/src/game/data";
import { canEmbark, canUpgradeBoat, nextBoatTier } from "@/src/game/engine";
import { GameState, Unit } from "@/src/game/types";

function Stat({ icon, value, color }: { icon: string; value: string | number; color?: string }) {
  return (
    <View style={styles.stat}>
      <MaterialCommunityIcons name={icon as any} size={16} color={color ?? C.onSurfaceSecondary} />
      <Text style={styles.statText}>{value}</Text>
    </View>
  );
}

interface Props {
  state: GameState;
  unit: Unit;
  bottomInset: number;
  onEmbark: (unitId: string) => void;
  onUpgradeBoat: (unitId: string) => void;
  onTrade: (unitId: string) => void;
}

export default function UnitPanel({ state, unit, bottomInset, onEmbark, onUpgradeBoat, onTrade }: Props) {
  const def = UNIT_DEFS[unit.type];
  const stats = unitStats(unit);
  const status = unit.attacked ? "Done" : unit.moved ? "Can attack" : "Ready";
  const name = unit.boat ? BOAT_DEFS[unit.boat].name : def.name;
  const icon = unit.boat ? BOAT_DEFS[unit.boat].icon : def.icon;

  const embarkOk = canEmbark(state, unit.id).ok;
  const upgradeOk = canUpgradeBoat(state, unit.id).ok;
  const next = unit.boat ? nextBoatTier(unit.boat) : null;
  const isMerchant = unit.type === "merchant";

  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset + 96 }]} pointerEvents="box-none">
      <View style={styles.card} testID="unit-panel">
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name={icon as any} size={26} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.hint}>
            {isMerchant ? "Load goods and set a price to trade" : "Tap a yellow tile to move · red tile to attack"}
          </Text>
        </View>
        <View style={styles.stats}>
          <Stat icon="heart" value={`${unit.hp}/${stats.maxHp}`} color={C.error} />
          <Stat icon="sword" value={stats.atk} />
          <Stat icon="shield" value={stats.def} color={C.info} />
        </View>
        <View style={styles.actions}>
          {isMerchant && (
            <Pressable testID="unit-trade" onPress={() => onTrade(unit.id)} style={[styles.actionBtn, { backgroundColor: C.warning }]}>
              <MaterialCommunityIcons name="cart" size={16} color="#fff" />
              <Text style={styles.actionText}>Trade</Text>
            </Pressable>
          )}
          {embarkOk && (
            <Pressable testID="unit-embark" onPress={() => onEmbark(unit.id)} style={[styles.actionBtn, { backgroundColor: C.info }]}>
              <MaterialCommunityIcons name="sail-boat" size={16} color="#fff" />
              <Text style={styles.actionText}>Embark</Text>
            </Pressable>
          )}
          {unit.boat && next && (
            <Pressable testID="unit-upgrade-boat" disabled={!upgradeOk} onPress={() => onUpgradeBoat(unit.id)} style={[styles.actionBtn, { backgroundColor: C.brand }, !upgradeOk && styles.disabled]}>
              <MaterialCommunityIcons name="arrow-up-bold" size={16} color="#fff" />
              <Text style={styles.actionText}>{BOAT_DEFS[next].name.replace(" Boat", "")}</Text>
              <View style={styles.starCost}>
                <MaterialCommunityIcons name="star-four-points" size={10} color="#fff" />
                <Text style={styles.actionText}>{BOAT_DEFS[next].upgradeCost}</Text>
              </View>
            </Pressable>
          )}
          {!embarkOk && !isMerchant && !unit.boat && (
            <View style={[styles.statusChip, { backgroundColor: unit.attacked ? C.surfaceTertiary : C.brandTertiary }]}>
              <Text style={styles.statusText}>{status}</Text>
            </View>
          )}
        </View>
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
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    borderWidth: 1,
    borderColor: C.border,
    ...shadow(8),
  },
  iconBox: { width: 46, height: 46, borderRadius: R.md, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 16, fontWeight: "900", color: C.onSurface },
  hint: { fontSize: 11, color: C.onSurfaceSecondary, marginTop: 2 },
  stats: { gap: 4 },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontWeight: "800", color: C.onSurface, fontSize: 13 },
  actions: { gap: 4, alignItems: "flex-end" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: R.pill },
  actionText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  starCost: { flexDirection: "row", alignItems: "center", gap: 1, marginLeft: 2 },
  disabled: { opacity: 0.45 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.pill },
  statusText: { fontWeight: "900", fontSize: 11, color: C.onSurface },
});
