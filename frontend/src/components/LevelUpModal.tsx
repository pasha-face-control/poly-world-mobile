import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { C, R, SP, shadow } from "@/src/theme";
import { levelRewardOptions } from "@/src/game/engine";
import { City } from "@/src/game/types";

interface Props {
  city: City | null;
  onPick: (cityId: string, rewardId: string) => void;
}

export default function LevelUpModal({ city, onPick }: Props) {
  if (!city) return null;
  const options = levelRewardOptions(city);
  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.dialog} testID="levelup-modal">
          <MaterialCommunityIcons name="chevron-triple-up" size={40} color={C.warning} />
          <Text style={styles.title}>City reached Level {city.level}!</Text>
          <Text style={styles.sub}>Choose a reward</Text>
          {options.map((o) => (
            <Pressable
              key={o.id}
              testID={`reward-${o.id}`}
              onPress={() => onPick(city.id, o.id)}
              style={({ pressed }) => [styles.opt, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
            >
              <View style={styles.optIcon}>
                <MaterialCommunityIcons name={o.icon as any} size={24} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optName}>{o.name}</Text>
                <Text style={styles.optDesc}>{o.desc}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={C.onSurfaceSecondary} />
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(28,28,28,0.6)", alignItems: "center", justifyContent: "center", padding: SP.xl },
  dialog: { width: "100%", maxWidth: 360, backgroundColor: C.surface, borderRadius: R.lg, padding: SP.xl, gap: SP.sm, alignItems: "stretch", ...shadow(10) },
  title: { fontSize: 22, fontWeight: "900", color: C.onSurface, textAlign: "center" },
  sub: { fontSize: 13, color: C.onSurfaceSecondary, textAlign: "center", marginBottom: SP.sm },
  opt: { flexDirection: "row", alignItems: "center", gap: SP.md, backgroundColor: C.surfaceSecondary, borderRadius: R.md, padding: SP.md },
  optIcon: { width: 44, height: 44, borderRadius: R.md, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  optName: { fontSize: 15, fontWeight: "900", color: C.onSurface },
  optDesc: { fontSize: 12, color: C.onSurfaceSecondary, marginTop: 2 },
});
