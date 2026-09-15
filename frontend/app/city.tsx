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
import { nextCitadelUpgrade, canUpgradeCitadel, canPlaceCityBuilding, canPlaceCityRoad } from "@/src/game/engine";
import { CITY_GOODS, CITY_BUILDINGS, TRIBE_MATERIAL } from "@/src/game/data";
import { CityBuilding, CityBuildingType, GoodType } from "@/src/game/types";
import { C, R, SP, shadow } from "@/src/theme";
import { haptic } from "@/src/utils/fx";

export default function CityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cityId } = useLocalSearchParams<{ cityId: string }>();
  const { state, doUpgradeCitadel, doPlaceCityBuilding, doSetFactoryFeed, doDrawCityRoads, doMoveCityBuilding, doDemolishCityBuilding, doRemoveCityRoad } = useGame();
  const [citadelOpen, setCitadelOpen] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [placing, setPlacing] = useState<CityBuildingType | null>(null);
  const [roadMode, setRoadMode] = useState(false);
  const [factory, setFactory] = useState<CityBuilding | null>(null);
  const [editMode, setEditMode] = useState<"move" | "demolish" | "deleteRoad" | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [editMenuOpen, setEditMenuOpen] = useState(false);
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
  const clearModes = () => { setRoadMode(false); setEditMode(null); setMovingId(null); setPlacing(null); };
  const up = nextCitadelUpgrade(city);
  const upOk = canUpgradeCitadel(state, city.owner, city.id);

  return (
    <View style={styles.container} testID="city-screen">
      <StatusBar style="dark" />
      <CityMap
        city={city}
        placing={placing}
        canPlaceAt={(t, x, y) => canPlaceCityBuilding(state, city.owner, city.id, t, x, y, movingId ?? undefined).ok}
        onPlace={(x, y) => {
          if (!placing) return;
          if (movingId) {
            const check = canPlaceCityBuilding(state, city.owner, city.id, placing, x, y, movingId);
            if (check.ok && doMoveCityBuilding(city.id, movingId, x, y)) { haptic.notify(); showToast("Building moved"); }
            else showToast(check.reason ?? "Can't move there");
            setMovingId(null); setPlacing(null);
            return;
          }
          const check = canPlaceCityBuilding(state, city.owner, city.id, placing, x, y);
          if (check.ok && doPlaceCityBuilding(city.id, placing, x, y)) { haptic.notify(); showToast(`${CITY_BUILDINGS.find((b) => b.id === placing)!.name} built`); }
          else showToast(check.reason ?? "Can't build there");
          setPlacing(null);
        }}
        onCancelPlace={() => { setPlacing(null); setMovingId(null); }}
        roadMode={roadMode}
        canRoadAt={(cell) => canPlaceCityRoad(state, city.owner, city.id, cell)}
        onDrawRoads={(cells) => { if (doDrawCityRoads(city.id, cells)) haptic.select(); }}
        editMode={editMode}
        onDeleteRoad={(cell) => { if (doRemoveCityRoad(city.id, cell)) { haptic.select(); showToast("Road removed"); } }}
        onTapBuilding={(b) => {
          if (editMode === "move") { haptic.select(); setMovingId(b.id); setPlacing(b.type); setEditMode(null); showToast("Drag to reposition · release to place"); }
          else if (editMode === "demolish") { if (doDemolishCityBuilding(city.id, b.id)) { haptic.notify(); showToast(`${CITY_BUILDINGS.find((x) => x.id === b.type)?.name ?? "Building"} demolished`); } }
          else if (b.type === "factory") { haptic.select(); setFactory(b); }
        }}
      />

      {placing && (
        <View pointerEvents="none" style={[styles.placeHint, { top: insets.top + 92 }]}>
          <Text style={styles.toastText}>{movingId ? "Drag to reposition · release to place" : "Drag to position · release to place"}</Text>
        </View>
      )}
      {roadMode && !placing && (
        <View pointerEvents="none" style={[styles.placeHint, { top: insets.top + 92 }]}>
          <Text style={styles.toastText}>Drag to draw roads · tap Roads to finish</Text>
        </View>
      )}
      {editMode && !placing && (
        <View pointerEvents="none" style={[styles.placeHint, { top: insets.top + 92 }]}>
          <Text style={styles.toastText}>
            {editMode === "move" ? "Tap a building to move it" : editMode === "demolish" ? "Tap a building to demolish it" : "Tap a road to remove it"}
          </Text>
        </View>
      )}

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
          <BarBtn icon="crown" label="Citadel" testID="city-citadel" onPress={() => { haptic.select(); clearModes(); setCitadelOpen(true); }} />
          <BarBtn icon="home-group" label="Buildings" testID="city-buildings" onPress={() => { haptic.select(); clearModes(); setBuildOpen(true); }} />
          <BarBtn icon="road-variant" label={roadMode ? "Done" : "Roads"} testID="city-roads" primary={roadMode} onPress={() => { haptic.select(); setPlacing(null); setEditMode(null); setMovingId(null); setRoadMode((v) => !v); showToast(roadMode ? "Roads saved" : "Drag on the map to draw roads"); }} />
          <BarBtn icon="pencil" label={editMode ? "Done" : "Edit"} testID="city-edit" primary={!!editMode} onPress={() => { haptic.select(); if (editMode || movingId) { clearModes(); showToast("Done editing"); } else { setRoadMode(false); setPlacing(null); setEditMenuOpen(true); } }} />
          <BarBtn icon="exit-run" label="Exit" testID="city-exit" primary={!roadMode && !editMode} onPress={() => router.back()} />
        </BlurView>
      </View>

      {/* Edit menu */}
      <Modal visible={editMenuOpen} transparent animationType="fade" onRequestClose={() => setEditMenuOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setEditMenuOpen(false)}>
          <View style={styles.dialog} testID="edit-menu">
            <Text style={styles.dialogTitle}>Edit City</Text>
            <EditOption icon="cursor-move" title="Move Building" desc="Select a building, then drag it to a new spot." testID="edit-move" onPress={() => { setEditMenuOpen(false); setEditMode("move"); showToast("Tap a building to move it"); }} />
            <EditOption icon="hammer" title="Demolish" desc="Tap a building to remove it (not the citadel)." testID="edit-demolish" onPress={() => { setEditMenuOpen(false); setEditMode("demolish"); showToast("Tap a building to demolish it"); }} />
            <EditOption icon="road-variant" title="Delete Road" desc="Tap a road cell to remove it." testID="edit-delete-road" onPress={() => { setEditMenuOpen(false); setEditMode("deleteRoad"); showToast("Tap a road to remove it"); }} />
            <Pressable onPress={() => setEditMenuOpen(false)} style={styles.secondaryBtn}><Text style={styles.secondaryText}>Cancel</Text></Pressable>
          </View>
        </Pressable>
      </Modal>

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
              <Pressable key={b.id} testID={`build-${b.id}`} style={styles.buildRow} onPress={() => { setBuildOpen(false); setPlacing(b.id); showToast(`Placing ${b.name} — drag on the map`); }}>
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

      {/* Material Factory config / status */}
      <FactoryDialog
        city={city}
        factory={factory ? (city.layout?.buildings.find((b) => b.id === factory.id) ?? null) : null}
        tribe={player.tribe}
        player={player}
        onClose={() => setFactory(null)}
        onFeed={(feed) => { if (factory) doSetFactoryFeed(city.id, factory.id, feed); }}
      />
    </View>
  );
}

function FactoryDialog({ city, factory, tribe, player, onClose, onFeed }: { city: any; factory: CityBuilding | null; tribe: string; player: any; onClose: () => void; onFeed: (feed: number) => void }) {
  const material = TRIBE_MATERIAL[tribe as keyof typeof TRIBE_MATERIAL] as GoodType;
  const meta = CITY_GOODS.find((g) => g.id === material)!;
  const feed = factory?.feed ?? 0;
  const woodHave = player.goods.wood ?? 0;
  const usable = Math.min(feed, woodHave) - (Math.min(feed, woodHave) % 2);
  return (
    <Modal visible={!!factory} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog} testID="factory-dialog">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <GameIcon name={meta.icon} size={22} color={meta.color} />
            <Text style={styles.dialogTitle}>{meta.name} Factory</Text>
          </View>

          {material === "planks" && (
            <>
              <Text style={styles.dialogSub}>Feeds wood in, crafts planks (2 wood → 1 plank) at the start of your turn.</Text>
              <View style={styles.stepper}>
                <Pressable testID="factory-feed-minus" onPress={() => onFeed(Math.max(0, feed - 2))} style={styles.stepBtn}><MaterialCommunityIcons name="minus" size={22} color={C.onSurface} /></Pressable>
                <View style={styles.stepVal}>
                  <GameIcon name="tree" size={16} color="#7A5230" />
                  <Text style={styles.stepText} testID="factory-feed-value">{feed}</Text>
                  <Text style={styles.stepSub}>wood/turn</Text>
                </View>
                <Pressable testID="factory-feed-plus" onPress={() => onFeed(feed + 2)} style={styles.stepBtn}><MaterialCommunityIcons name="plus" size={22} color={C.onSurface} /></Pressable>
              </View>
              <Text style={styles.factoryOut}>→ {usable / 2} plank{usable / 2 === 1 ? "" : "s"} next turn (uses {usable} of your {woodHave} wood)</Text>
            </>
          )}
          {material === "stone" && <Text style={styles.dialogSub}>Produces +2 stone every turn automatically.</Text>}
          {material === "sand" && <Text style={styles.dialogSub}>Delivers +5 sand every turn automatically.</Text>}
          {material === "glass" && (
            <>
              <Text style={styles.dialogSub}>Crafts +1 glass each turn. Needs 5 sand + (1 coal or 2 wood).</Text>
              <View style={styles.costRow}>
                <View style={styles.costChip}><GameIcon name="grain" size={14} color={(player.goods.sand ?? 0) >= 5 ? "#E8CE8A" : C.error} /><Text style={[styles.costText, (player.goods.sand ?? 0) < 5 && { color: C.error }]}>5 sand</Text></View>
                <View style={styles.costChip}><GameIcon name="img:coal_ore" size={14} color={(player.goods.coal ?? 0) >= 1 ? "#3A3A3A" : C.onSurfaceSecondary} /><Text style={styles.costText}>1 coal</Text></View>
                <Text style={styles.dialogSub}>or</Text>
                <View style={styles.costChip}><GameIcon name="tree" size={14} color={(player.goods.wood ?? 0) >= 2 ? "#7A5230" : C.onSurfaceSecondary} /><Text style={styles.costText}>2 wood</Text></View>
              </View>
              {factory?.starved && <Text style={[styles.factoryOut, { color: C.error }]}>⚠ Not enough inputs last turn — stock up on sand + coal/wood.</Text>}
            </>
          )}

          <Pressable onPress={onClose} style={styles.secondaryBtn}><Text style={styles.secondaryText}>Close</Text></Pressable>
        </View>
      </View>
    </Modal>
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

function EditOption({ icon, title, desc, onPress, testID }: { icon: string; title: string; desc: string; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.buildRow}>
      <View style={styles.buildIcon}><MaterialCommunityIcons name={icon as any} size={22} color={C.brand} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.buildName}>{title}</Text>
        <Text style={styles.buildDesc}>{desc}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={C.onSurfaceSecondary} />
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
  placeHint: { position: "absolute", alignSelf: "center", backgroundColor: C.brand, paddingHorizontal: 16, paddingVertical: 8, borderRadius: R.pill },
  toastText: { color: C.onSurfaceInverse, fontWeight: "700", fontSize: 13 },
  bottomWrap: { position: "absolute", left: 12, right: 12 },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6, paddingVertical: 8, borderRadius: R.lg, overflow: "hidden", ...shadow(6) },
  action: { alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 6, borderRadius: R.md, minWidth: 54 },
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
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SP.md, marginVertical: 6 },
  stepBtn: { width: 46, height: 46, borderRadius: R.md, backgroundColor: C.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  stepVal: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  stepText: { fontSize: 22, fontWeight: "900", color: C.onSurface },
  stepSub: { fontSize: 12, fontWeight: "700", color: C.onSurfaceSecondary },
  factoryOut: { fontSize: 13, fontWeight: "700", color: C.brand, marginTop: 2 },
});
