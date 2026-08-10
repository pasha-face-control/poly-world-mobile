import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";

import GameMap from "@/src/components/GameMap";
import TopHUD from "@/src/components/TopHUD";
import BottomBar from "@/src/components/BottomBar";
import TechTreeModal from "@/src/components/TechTreeModal";
import CityPanel from "@/src/components/CityPanel";
import UnitPanel from "@/src/components/UnitPanel";
import BuildPanel from "@/src/components/BuildPanel";
import MerchantPanel from "@/src/components/MerchantPanel";
import BuyMerchantPanel from "@/src/components/BuyMerchantPanel";
import LevelUpModal from "@/src/components/LevelUpModal";
import VictoryCard from "@/src/components/VictoryCard";
import TutorialOverlay from "@/src/components/TutorialOverlay";
import Button from "@/src/components/Button";
import { useGame } from "@/src/game/store";
import { storage } from "@/src/utils/storage";
import { attackableTiles, neighbors, reachableTiles, tileHasActions } from "@/src/game/engine";
import { TRIBE_BY_ID } from "@/src/game/data";
import { UnitType } from "@/src/game/types";
import { C, R, SP, shadow } from "@/src/theme";

export default function GameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, busy, endTurn, doMove, doAttack, doHarvest, doTrain, doResearch, doBuild, doInfra, doEmbark, doUpgradeBoat, doLoadMerchant, doSetPrice, doApplyReward, doBuyFromMerchant, exitToMenu } = useGame();

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [selectedBuildTileId, setSelectedBuildTileId] = useState<number | null>(null);
  const [merchantOpen, setMerchantOpen] = useState(false);
  const [buyMerchantId, setBuyMerchantId] = useState<string | null>(null);
  const [moveAnim, setMoveAnim] = useState<{ unitId: string; fromTileId: number; toTileId: number; key: number } | null>(null);
  const [techOpen, setTechOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const tutorialChecked = useRef(false);
  const [focusTileId, setFocusTileId] = useState<number | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const prevPlayer = useRef<number | null>(null);

  useEffect(() => {
    if (!state) router.replace("/");
  }, [state, router]);

  // Show the quick tutorial the first time a player enters a game.
  useEffect(() => {
    if (tutorialChecked.current) return;
    tutorialChecked.current = true;
    (async () => {
      const seen = await storage.getItem<boolean>("hextribes_tutorial_seen_v1", false);
      if (!seen) {
        setTutorialOpen(true);
        await storage.setItem("hextribes_tutorial_seen_v1", true);
      }
    })();
  }, []);

  // Clear selection when the active player changes.
  useEffect(() => {
    if (!state) return;
    if (prevPlayer.current !== state.currentPlayer) {
      prevPlayer.current = state.currentPlayer;
      setSelectedUnitId(null);
      setSelectedCityId(null);
      setSelectedBuildTileId(null);
      setMerchantOpen(false);
      setBuyMerchantId(null);
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

    // Tapping another player's merchant opens its shop so you can buy goods.
    if (unit && unit.type === "merchant" && unit.owner !== cp) {
      Haptics.selectionAsync();
      setBuyMerchantId(unit.id);
      setSelectedUnitId(null);
      setSelectedCityId(null);
      setSelectedBuildTileId(null);
      setMerchantOpen(false);
      return;
    }
    setBuyMerchantId(null);

    if (selectedUnit && selectedUnit.owner === cp) {
      if (attackable.includes(tileId)) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        doAttack(selectedUnit.id, tileId);
        return;
      }
      if (reachable.includes(tileId)) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const fromTileId = selectedUnit.tileId;
        const uid = selectedUnit.id;
        if (doMove(uid, tileId)) setMoveAnim({ unitId: uid, fromTileId, toTileId: tileId, key: Date.now() });
        return;
      }
      if (unit && unit.owner === cp) {
        Haptics.selectionAsync();
        setSelectedUnitId(unit.id);
        setSelectedCityId(null);
        setMerchantOpen(false);
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
      const garrison = unit && unit.owner === cp ? unit : undefined;
      Haptics.selectionAsync();
      if (selectedCityId === city.id && garrison) {
        // Second tap on an occupied city pulls the garrisoned unit out for movement.
        setSelectedUnitId(garrison.id);
        setSelectedCityId(null);
      } else {
        setSelectedCityId(city.id);
        setSelectedUnitId(null);
      }
      setSelectedBuildTileId(null);
      setMerchantOpen(false);
    } else if (unit && unit.owner === cp) {
      Haptics.selectionAsync();
      setSelectedUnitId(unit.id);
      setSelectedCityId(null);
      setSelectedBuildTileId(null);
      setMerchantOpen(false);
    } else if (tileHasActions(state, cp, tileId)) {
      Haptics.selectionAsync();
      setSelectedBuildTileId(tileId);
      setSelectedUnitId(null);
      setSelectedCityId(null);
      setMerchantOpen(false);
    } else {
      setSelectedUnitId(null);
      setSelectedCityId(null);
      setSelectedBuildTileId(null);
    }
  };

  // Double-tap a merchant to open its inventory / trade panel.
  const onTileDoubleTap = (tileId: number) => {
    if (!interactive) return;
    const cp = state.currentPlayer;
    const unit = state.units.find((u) => u.tileId === tileId);
    if (unit && unit.owner === cp && unit.type === "merchant") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedUnitId(unit.id);
      setSelectedCityId(null);
      setSelectedBuildTileId(null);
      setMerchantOpen(true);
    } else {
      onTileTap(tileId);
    }
  };

  const onNextUnit = () => {
    const next = state.units.find((u) => u.owner === state.currentPlayer && !u.attacked);
    if (next) {
      setSelectedUnitId(next.id);
      setSelectedCityId(null);
      setMerchantOpen(false);
      setBuyMerchantId(null);
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
        moveAnim={moveAnim}
        onTileTap={onTileTap}
        onTileDoubleTap={onTileDoubleTap}
      />

      <TopHUD state={state} topInset={insets.top} />

      {selectedUnit && !selectedCity && !merchantOpen && (
        <UnitPanel
          state={state}
          unit={selectedUnit}
          bottomInset={insets.bottom}
          onEmbark={(id) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            doEmbark(id);
          }}
          onUpgradeBoat={(id) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            doUpgradeBoat(id);
          }}
          onTrade={() => setMerchantOpen(true)}
        />
      )}
      {selectedUnit && merchantOpen && selectedUnit.type === "merchant" && (
        <MerchantPanel
          state={state}
          unit={selectedUnit}
          bottomInset={insets.bottom}
          onLoad={(id, slotIndex, good, amount) => {
            Haptics.selectionAsync();
            doLoadMerchant(id, slotIndex, good, amount);
          }}
          onSetPrice={(id, slotIndex, price) => {
            Haptics.selectionAsync();
            doSetPrice(id, slotIndex, price);
          }}
          onClose={() => setMerchantOpen(false)}
        />
      )}
      {buyMerchantId && (() => {
        const bm = state.units.find((u) => u.id === buyMerchantId);
        if (!bm || bm.type !== "merchant" || bm.owner === state.currentPlayer) return null;
        return (
          <BuyMerchantPanel
            state={state}
            merchant={bm}
            bottomInset={insets.bottom}
            onBuy={(mid, slotIndex, amount) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              doBuyFromMerchant(mid, slotIndex, amount);
            }}
            onClose={() => setBuyMerchantId(null)}
          />
        );
      })()}
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
          onInfra={(iid) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (doInfra(selectedBuildTileId, iid)) setSelectedBuildTileId(null);
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

      <LevelUpModal
        city={state.pendingLevelUps?.length ? state.cities.find((c) => c.id === state.pendingLevelUps[0]) ?? null : null}
        onPick={(cityId, rewardId) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          doApplyReward(cityId, rewardId);
        }}
      />

      <TutorialOverlay visible={tutorialOpen} onClose={() => setTutorialOpen(false)} />

      {/* In-game menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.centerOverlay}>
          <View style={styles.dialog} testID="ingame-menu">
            <Text style={styles.dialogTitle}>Paused</Text>
            <Button testID="menu-resume" label="Resume" icon="play" onPress={() => setMenuOpen(false)} />
            <Button testID="menu-tutorial" label="How to Play" icon="help-circle" variant="secondary" onPress={() => { setMenuOpen(false); setTutorialOpen(true); }} />
            <Button testID="menu-exit" label="Main Menu" icon="home" variant="secondary" onPress={goMenu} />
            <Text style={styles.saveNote}>Your game is auto-saved.</Text>
          </View>
        </View>
      </Modal>

      {/* Victory / Defeat */}
      <Modal visible={state.status !== "playing"} transparent animationType="fade">
        <View style={styles.centerOverlay}>
          <View style={styles.dialog} testID="result-dialog">
            {state.status !== "playing" && <VictoryCard state={state} />}
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
