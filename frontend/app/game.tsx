import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import GameMap from "@/src/components/GameMap";
import TopHUD from "@/src/components/TopHUD";
import BottomBar from "@/src/components/BottomBar";
import TechTreeModal from "@/src/components/TechTreeModal";
import CityPanel from "@/src/components/CityPanel";
import UnitPanel from "@/src/components/UnitPanel";
import BuildPanel from "@/src/components/BuildPanel";
import Button from "@/src/components/Button";
import { useGame } from "@/src/game/store";
import { attackableTiles, buildableFor, neighbors, reachableTiles } from "@/src/game/engine";
import { TRIBE_BY_ID } from "@/src/game/data";
import { UnitType } from "@/src/game/types";
import { C, R, SP, shadow } from "@/src/theme";

export default function GameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, busy, endTurn, doMove, doAttack, doHarvest, doTrain, doResearch, doBuild, exitToMenu } = useGame();

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [selectedBuildTileId, setSelectedBuildTileId] = useState<number | null>(null);
  const [techOpen, setTechOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusTileId, setFocusTileId] = useState<number | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const prevPlayer = useRef<number | null>(null);

  useEffect(() => {
    if (!state) router.replace("/");
  }, [state, router]);

  // Clear selection when the active player changes.
  useEffect(() => {
    if (!state) return;
    if (prevPlayer.current !== state.currentPlayer) {
      prevPlayer.current = state.currentPlayer;
      setSelectedUnitId(null);
      setSelectedCityId(null);
      setSelectedBuildTileId(null);
    }
  }, [state?.currentPlayer, state]);

  const selectedUnit = useMemo(() => state?.units.find((u) => u.id === selectedUnitId) ?? null, [state, selectedUnitId]);
  const selectedCity = useMemo(() => state?.cities.find((c) => c.id === selectedCityId) ?? null, [state, selectedCityId]);

  const interactive = !!state && state.status === "playing" && state.players[state.currentPlayer].isHuman && !busy;
  const fog = !!state && state.players.some((p) => !p.isHuman); // fog only in vs-AI

  const reachable = useMemo(() => {
    if (!state || !selectedUnit || selectedUnit.owner !== state.currentPlayer || selectedUnit.moved) return [];
    return reachableTiles(state, selectedUnit);
  }, [state, selectedUnit]);

  const attackable = useMemo(() => {
    if (!state || !selectedUnit || selectedUnit.owner !== state.currentPlayer) return [];
    return attackableTiles(state, selectedUnit);
  }, [state, selectedUnit]);

  const territory = useMemo(() => {
    const set = new Set<number>();
    if (!state) return set;
    for (const c of state.cities) {
      if (c.owner !== state.currentPlayer) continue;
      set.add(c.tileId);
      for (const n of neighbors(state, c.tileId)) set.add(n);
    }
    return set;
  }, [state]);

  if (!state) return <View style={{ flex: 1, backgroundColor: C.surface }} />;

  const capitalTile = state.cities.find((c) => c.owner === 0 && c.isCapital)?.tileId ?? state.tiles[0].id;

  const onTileTap = (tileId: number) => {
    if (!interactive) return;
    const cp = state.currentPlayer;
    const tile = state.tiles[tileId];
    const unit = state.units.find((u) => u.tileId === tileId);
    const city = tile.cityId ? state.cities.find((c) => c.id === tile.cityId) : undefined;

    if (selectedUnit && selectedUnit.owner === cp) {
      if (attackable.includes(tileId)) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        doAttack(selectedUnit.id, tileId);
        return;
      }
      if (reachable.includes(tileId)) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        doMove(selectedUnit.id, tileId);
        return;
      }
      if (unit && unit.owner === cp) {
        Haptics.selectionAsync();
        setSelectedUnitId(unit.id);
        setSelectedCityId(null);
        return;
      }
      if (city && city.owner === cp) {
        setSelectedUnitId(null);
        setSelectedCityId(city.id);
        return;
      }
      setSelectedUnitId(null);
      return;
    }

    // Nothing selected — city takes priority so an occupied capital is still accessible.
    if (city && city.owner === cp) {
      Haptics.selectionAsync();
      setSelectedCityId(city.id);
      setSelectedUnitId(null);
      setSelectedBuildTileId(null);
    } else if (unit && unit.owner === cp) {
      Haptics.selectionAsync();
      setSelectedUnitId(unit.id);
      setSelectedCityId(null);
      setSelectedBuildTileId(null);
    } else if (buildableFor(state, cp, tileId).length > 0) {
      Haptics.selectionAsync();
      setSelectedBuildTileId(tileId);
      setSelectedUnitId(null);
      setSelectedCityId(null);
    } else {
      setSelectedUnitId(null);
      setSelectedCityId(null);
      setSelectedBuildTileId(null);
    }
  };

  const onNextUnit = () => {
    const next = state.units.find((u) => u.owner === state.currentPlayer && !u.attacked);
    if (next) {
      setSelectedUnitId(next.id);
      setSelectedCityId(null);
      setFocusTileId(next.tileId);
      setFocusKey((k) => k + 1);
      Haptics.selectionAsync();
    }
  };

  const onEndTurn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSelectedUnitId(null);
    setSelectedCityId(null);
    endTurn();
  };

  const goMenu = () => {
    setMenuOpen(false);
    exitToMenu();
    router.replace("/");
  };

  return (
    <View style={styles.container} testID="game-screen">
      <StatusBar style="dark" />
      <GameMap
        state={state}
        fog={fog}
        selectedUnitId={selectedUnitId}
        selectedTileId={selectedUnit?.tileId ?? null}
        reachable={reachable}
        attackable={attackable}
        centerTileId={capitalTile}
        focusTileId={focusTileId}
        focusKey={focusKey}
        territory={territory}
        territoryColor={TRIBE_BY_ID[state.players[state.currentPlayer].tribe].color}
        onTileTap={onTileTap}
      />

      <TopHUD state={state} topInset={insets.top} />

      {selectedUnit && !selectedCity && <UnitPanel unit={selectedUnit} bottomInset={insets.bottom} />}
      {selectedCity && (
        <CityPanel
          state={state}
          city={selectedCity}
          bottomInset={insets.bottom}
          onTrain={(t: UnitType) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            doTrain(selectedCity.id, t);
          }}
          onHarvest={(id) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            doHarvest(id);
          }}
          onClose={() => setSelectedCityId(null)}
        />
      )}
      {selectedBuildTileId != null && !selectedCity && !selectedUnit && (
        <BuildPanel
          state={state}
          tileId={selectedBuildTileId}
          bottomInset={insets.bottom}
          onBuild={(bid) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (doBuild(selectedBuildTileId, bid)) setSelectedBuildTileId(null);
          }}
          onClose={() => setSelectedBuildTileId(null)}
        />
      )}

      <BottomBar
        bottomInset={insets.bottom}
        busy={busy}
        onTech={() => setTechOpen(true)}
        onNextUnit={onNextUnit}
        onMenu={() => setMenuOpen(true)}
        onEndTurn={onEndTurn}
      />

      <TechTreeModal
        visible={techOpen}
        state={state}
        topInset={insets.top}
        onResearch={(id) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          doResearch(id);
        }}
        onClose={() => setTechOpen(false)}
      />

      {/* In-game menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.centerOverlay}>
          <View style={styles.dialog} testID="ingame-menu">
            <Text style={styles.dialogTitle}>Paused</Text>
            <Button testID="menu-resume" label="Resume" icon="play" onPress={() => setMenuOpen(false)} />
            <Button testID="menu-exit" label="Main Menu" icon="home" variant="secondary" onPress={goMenu} />
            <Text style={styles.saveNote}>Your game is auto-saved.</Text>
          </View>
        </View>
      </Modal>

      {/* Victory / Defeat */}
      <Modal visible={state.status !== "playing"} transparent animationType="fade">
        <View style={styles.centerOverlay}>
          <View style={styles.dialog} testID="result-dialog">
            <MaterialCommunityIcons
              name={state.status === "won" ? "trophy" : "skull"}
              size={64}
              color={state.status === "won" ? C.warning : C.error}
            />
            <Text style={styles.dialogTitle}>{state.status === "won" ? "Victory!" : "Defeat"}</Text>
            <Text style={styles.dialogSub}>
              {state.status === "won" ? "You conquered every rival tribe." : "Your tribe has fallen."}
            </Text>
            <Button
              testID="result-newgame"
              label="New Game"
              icon="plus-circle"
              onPress={() => {
                exitToMenu();
                router.replace("/setup");
              }}
            />
            <Button testID="result-menu" label="Main Menu" icon="home" variant="secondary" onPress={goMenu} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1d3b38" },
  centerOverlay: { flex: 1, backgroundColor: "rgba(28,28,28,0.6)", alignItems: "center", justifyContent: "center", padding: SP.xl },
  dialog: { width: "100%", maxWidth: 360, backgroundColor: C.surface, borderRadius: R.lg, padding: SP.xl, gap: SP.md, alignItems: "stretch", ...shadow(10) },
  dialogTitle: { fontSize: 28, fontWeight: "900", color: C.onSurface, textAlign: "center" },
  dialogSub: { fontSize: 14, color: C.onSurfaceSecondary, textAlign: "center", marginBottom: SP.sm },
  saveNote: { fontSize: 12, color: C.onSurfaceSecondary, textAlign: "center" },
});
