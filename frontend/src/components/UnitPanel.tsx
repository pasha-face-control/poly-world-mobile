import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, R, SP, shadow } from "@/src/theme";
import { UNIT_DEFS } from "@/src/game/data";
import { Unit } from "@/src/game/types";

function Stat({ icon, value, color }: { icon: string; value: string | number; color?: string }) {
  return (
    <View style={styles.stat}>
      <MaterialCommunityIcons name={icon as any} size={16} color={color ?? C.onSurfaceSecondary} />
      <Text style={styles.statText}>{value}</Text>
    </View>
  );
}

export default function UnitPanel({ unit, bottomInset }: { unit: Unit; bottomInset: number }) {
  const def = UNIT_DEFS[unit.type];
  const status = unit.attacked ? "Done" : unit.moved ? "Can attack" : "Ready";
  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset + 96 }]} pointerEvents="box-none">
      <View style={styles.card} testID="unit-panel">
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name={def.icon as any} size={26} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{def.name}</Text>
          <Text style={styles.hint}>Tap a yellow tile to move · red tile to attack</Text>
        </View>
        <View style={styles.stats}>
          <Stat icon="heart" value={`${unit.hp}/${unit.maxHp}`} color={C.error} />
          <Stat icon="sword" value={def.atk} />
          <Stat icon="shield" value={def.def} color={C.info} />
        </View>
        <View style={[styles.statusChip, { backgroundColor: unit.attacked ? C.surfaceTertiary : C.brandTertiary }]}>
          <Text style={styles.statusText}>{status}</Text>
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
  statusChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.pill },
  statusText: { fontWeight: "900", fontSize: 11, color: C.onSurface },
});
