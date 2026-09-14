import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import CityMap from "@/src/components/CityMap";
import GameIcon from "@/src/components/GameIcon";
import { useGame } from "@/src/game/store";
import { nextCitadelUpgrade, canUpgradeCitadel } from "@/src/game/engine";
import { CITY_GOODS, CITY_BUILDINGS } from "@/src/game/data";
import { GoodType } from "@/src/game/types";
import { C, R, SP, shadow } from "@/src/theme";
import { haptic } from "@/src/utils/fx";

export default function CityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cityId } = useLocalSearchParams<{ cityId: string }>();
  const { state, doUpgradeCitadel } = useGame();
  const [citadelOpen, setCitadelOpen] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const city = state?.cities.find((c) => c.id === cityId);
  if (!state || !city) {
    return (
      <View style={styles.container}>
        <Pressable style={[styles.exitFallback, { top: insets.top + 12 }]} onPress={() => router.back()}>
          <Text style={styles.exitText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const player = state.players[city.owner];
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1600); };
  const up = nextCitadelUpgrade(city);
  const upOk = canUpgradeCitadel(state, city.owner, city.id);

  return (
    <View style={styles.container} testID="city-screen">
      <StatusBar style="dark" />
      <CityMap city={city} />

      {/* Top HUD */}
      <View style={[styles.hudTop, { top: insets.top + 8 }]} pointerEvents="box-none">
        <BlurView intensity={40} tint="light" style={styles.pill}>
          <MaterialCommunityIcons name="star-four-points" size={16} color={C.warning} />
          <Text style={styles.pillValue} testID="city-income">+{city.production}</Text>
          <Text style={styles.pillSub}>/turn</Text>
        </BlurView>
        <BlurView intensity={40} tint="light" style={styles.goodsPill}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.goodsRow}>
            <View style={styles.good}>
              <MaterialCommunityIcons name="star-four-points" size={14} color={C.warning} />
              <Text style={styles.goodValue}>{player.stars}</Text>
            </View>
            {CITY_GOODS.map((g) => (
              <View key={g.id} style={styles.good} testID={`city-good-${g.id}`}>
                <GameIcon name={g.icon} size={14} color={g.color} />
                <Text style={styles.goodValue}>{player.goods[g.id as GoodType] ?? 0}</Text>
              </View>
            ))}
          </ScrollView>
        </BlurView>
      </View>

      {toast && (
        <View pointerEvents="none" style={[styles.toast, { top: insets.top + 92 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* Bottom action bar */}
      <View style={[styles.bottomWrap, { bottom: insets.bottom + 10 }]} pointerEvents="box-none">
        <BlurView intensity={40} tint="light" style={styles.bar}>
          <BarBtn icon="crown" label="Citadel" testID="city-citadel" onPress={() => { haptic.select(); setCitadelOpen(true); }} />
          <BarBtn icon="home-group" label="Buildings" testID="city-buildings" onPress={() => { haptic.select(); setBuildOpen(true); }} />
          <BarBtn icon="road-variant" label="Roads" testID="city-roads" onPress={() => showToast("Road building — coming soon")} />
          <BarBtn icon="exit-run" label="Exit" testID="city-exit" primary onPress={() => router.back()} />
        </BlurView>
      </View>

      {/* Citadel upgrade */}
      <Modal visible={citadelOpen} transparent animationType="fade" onRequestClose={() => setCitadelOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog} testID="citadel-dialog">
            <Text style={styles.dialogTitle}>Citadel</Text>
            <Text style={styles.dialogSub}>Current stage: {city.citadelStage ?? 1}</Text>
            {up ? (
              <>
                <Text style={styles.dialogSub}>Upgrade to stage {up.toStage}:</Text>
                <View style={styles.costRow}>
                  <View style={styles.costChip}>
                    <MaterialCommunityIcons name="star-four-points" size={14} color={player.stars >= up.stars ? C.warning : C.error} />
                    <Text style={[styles.costText, player.stars < up.stars && { color: C.error }]}>{up.stars}</Text>
                  </View>
                  {Object.entries(up.cost).map(([g, n]) => {
                    const meta = CITY_GOODS.find((x) => x.id === g)!;
                    const have = player.goods[g as GoodType] ?? 0;
                    return (
                      <View key={g} style={styles.costChip}>
                        <GameIcon name={meta.icon} size={14} color={have >= (n as number) ? meta.color : C.error} />
                        <Text style={[styles.costText, have < (n as number) && { color: C.error }]}>{n as number}</Text>
                      </View>
                    );
                  })}
                </View>
                <Pressable
                  testID="citadel-upgrade"
                  disabled={!upOk.ok}
                  onPress={() => { if (doUpgradeCitadel(city.id)) { haptic.notify(); setCitadelOpen(false); showToast(`Citadel upgraded to stage ${up.toStage}`); } }}
                  style={[styles.primaryBtn, !upOk.ok && { opacity: 0.5 }]}
                >
                  <Text style={styles.primaryBtnText}>{upOk.ok ? "Upgrade" : upOk.reason}</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.dialogSub}>Citadel is fully upgraded.</Text>
            )}
            <Pressable onPress={() => setCitadelOpen(false)} style={styles.secondaryBtn}><Text style={styles.secondaryText}>Close</Text></Pressable>
          </View>
        </View>
      </Modal>

      {/* Buildings menu (placement lands in the next update) */}
      <Modal visible={buildOpen} transparent animationType="slide" onRequestClose={() => setBuildOpen(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet} testID="buildings-sheet">
            <View style={styles.sheetHeader}>
              <Text style={styles.dialogTitle}>Buildings</Text>
              <Pressable onPress={() => setBuildOpen(false)} style={styles.sheetClose}><MaterialCommunityIcons name="close" size={22} color={C.onSurface} /></Pressable>
            </View>
            {CITY_BUILDINGS.map((b) => (
              <Pressable key={b.id} testID={`build-${b.id}`} style={styles.buildRow} onPress={() => { setBuildOpen(false); showToast(`${b.name} placement — coming soon`); }}>
                <View style={styles.buildIcon}><MaterialCommunityIcons name={b.icon as any} size={22} color={C.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.buildName}>{b.name} · {b.size}×{b.size}</Text>
                  <Text style={styles.buildDesc}>{b.desc}</Text>
                </View>
                <View style={styles.costRow}>
                  {b.stars > 0 && <View style={styles.costChip}><MaterialCommunityIcons name="star-four-points" size={13} color={C.warning} /><Text style={styles.costText}>{b.stars}</Text></View>}
                  {Object.entries(b.cost).map(([g, n]) => {
                    const meta = CITY_GOODS.find((x) => x.id === g)!;
                    return <View key={g} style={styles.costChip}><GameIcon name={meta.icon} size={13} color={meta.color} /><Text style={styles.costText}>{n as number}</Text></View>;
                  })}
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function BarBtn({ icon, label, onPress, primary, testID }: { icon: string; label: string; onPress: () => void; primary?: boolean; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.action, primary && styles.actionPrimary, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
      <MaterialCommunityIcons name={icon as any} size={22} color={primary ? "#fff" : C.onSurface} />
      <Text style={[styles.actionLabel, primary && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#6E8F5E" },
  exitFallback: { position: "absolute", left: 16, backgroundColor: C.surface, paddingHorizontal: 16, paddingVertical: 10, borderRadius: R.pill },
  exitText: { fontWeight: "800", color: C.onSurface },
  hudTop: { position: "absolute", left: 12, right: 12, gap: 8 },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.pill, overflow: "hidden", ...shadow(3) },
  pillValue: { fontWeight: "900", color: C.onSurface, fontSize: 15 },
  pillSub: { fontWeight: "700", color: C.onSurfaceSecondary, fontSize: 11 },
  goodsPill: { borderRadius: R.pill, overflow: "hidden", ...shadow(3) },
  goodsRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 7 },
  good: { flexDirection: "row", alignItems: "center", gap: 3 },
  goodValue: { fontWeight: "800", color: C.onSurface, fontSize: 13 },
  toast: { position: "absolute", alignSelf: "center", backgroundColor: C.surfaceInverse, paddingHorizontal: 16, paddingVertical: 8, borderRadius: R.pill },
  toastText: { color: C.onSurfaceInverse, fontWeight: "700", fontSize: 13 },
  bottomWrap: { position: "absolute", left: 12, right: 12 },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 8, borderRadius: R.lg, overflow: "hidden", ...shadow(6) },
  action: { alignItems: "center", gap: 2, paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.md, minWidth: 64 },
  actionPrimary: { backgroundColor: C.brand },
  actionLabel: { fontSize: 12, fontWeight: "800", color: C.onSurface },
  overlay: { flex: 1, backgroundColor: "rgba(28,28,28,0.6)", alignItems: "center", justifyContent: "center", padding: SP.lg },
  dialog: { backgroundColor: C.surface, borderRadius: R.lg, padding: SP.lg, width: "100%", maxWidth: 360, gap: SP.sm, ...shadow(10) },
  dialogTitle: { fontSize: 20, fontWeight: "900", color: C.onSurface },
  dialogSub: { fontSize: 14, fontWeight: "600", color: C.onSurfaceSecondary },
  costRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 4 },
  costChip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: R.pill },
  costText: { fontWeight: "800", color: C.onSurface, fontSize: 13 },
  primaryBtn: { backgroundColor: C.brand, borderRadius: R.md, paddingVertical: 12, alignItems: "center", marginTop: 4 },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  secondaryBtn: { paddingVertical: 10, alignItems: "center" },
  secondaryText: { color: C.onSurfaceSecondary, fontWeight: "700" },
  sheetOverlay: { flex: 1, backgroundColor: "rgba(28,28,28,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, padding: SP.md, paddingBottom: SP.xl, gap: SP.sm, ...shadow(10) },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SP.xs },
  sheetClose: { padding: 6, backgroundColor: C.surfaceSecondary, borderRadius: R.pill },
  buildRow: { flexDirection: "row", alignItems: "center", gap: SP.md, backgroundColor: C.surfaceSecondary, borderRadius: R.md, padding: SP.md },
  buildIcon: { width: 40, height: 40, borderRadius: R.md, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  buildName: { fontSize: 15, fontWeight: "800", color: C.onSurface },
  buildDesc: { fontSize: 12, fontWeight: "600", color: C.onSurfaceSecondary },
});
