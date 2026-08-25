import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { haptic, playSfx, setHapticsOn, setSoundOn } from "@/src/utils/fx";
import { useFxSettings } from "@/src/utils/useFxSettings";

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
import HuntChoiceModal from "@/src/components/HuntChoiceModal";
import HuntingMiniGame from "@/src/components/HuntingMiniGame";
import FishChoiceModal from "@/src/components/FishChoiceModal";
import FishingMiniGame from "@/src/components/FishingMiniGame";
import SaleModal from "@/src/components/SaleModal";
import CaptureModal, { CaptureTarget } from "@/src/components/CaptureModal";
import OfferModal from "@/src/components/OfferModal";
import Button from "@/src/components/Button";
import { useGame } from "@/src/game/store";
import { storage } from "@/src/utils/storage";
import { attackableTiles, canBuyCity, canBuyVillage, canFish, canHunt, neighbors, reachableTiles, stalemateTurnsLeft, tileHasActions } from "@/src/game/engine";
import { TRIBE_BY_ID } from "@/src/game/data";
import { UnitType } from "@/src/game/types";
import { C, R, SP, shadow } from "@/src/theme";

export default function GameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { soundOn, hapticsOn } = useFxSettings();
  const { state, busy, endTurn, doMove, doAttack, doTrain, doResearch, doBuild, doInfra, doEmbark, doUpgradeBoat, doLoadMerchant, doSetPrice, doApplyReward, doBuyFromMerchant, doHireHunter, doHuntSuccess, doHireFisherman, doFishSuccess, doClearSale, doBuyVillage, doBuyCity, doResolveOffer, exitToMenu } = useGame();

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [selectedBuildTileId, setSelectedBuildTileId] = useState<number | null>(null);
  const [merchantOpen, setMerchantOpen] = useState(false);
  const [buyMerchantId, setBuyMerchantId] = useState<string | null>(null);
  const [huntTileId, setHuntTileId] = useState<number | null>(null);
  const [huntPlaying, setHuntPlaying] = useState(false);
  const [fishTileId, setFishTileId] = useState<number | null>(null);
  const [fishPlaying, setFishPlaying] = useState(false);
  const [captureTarget, setCaptureTarget] = useState<(CaptureTarget & { tileId: number; cityId?: string }) | null>(null);
  const [moveAnim, setMoveAnim] = useState<{ unitId: string; fromTileId: number; toTileId: number; key: number } | null>(null);
  const [techOpen, setTechOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const tutorialChecked = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gateFor, setGateFor] = useState<number | null>(null);
  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);
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
      setHuntTileId(null);
      setHuntPlaying(false);
      setFishTileId(null);
      setFishPlaying(false);
      setCaptureTarget(null);
    }
  }, [state?.currentPlayer, state]);

  const selectedUnit = useMemo(() => state?.units.find((u) => u.id === selectedUnitId) ?? null, [state, selectedUnitId]);
  const selectedCity = useMemo(() => state?.cities.find((c) => c.id === selectedCityId) ?? null, [state, selectedCityId]);

  // Chime when this player's merchant made sales this round (SaleModal shows).
  const hasSale = !!state?.pendingSales?.[state?.currentPlayer ?? 0];
  useEffect(() => {
    if (hasSale) playSfx("trade");
  }, [hasSale]);

  const gateShowing = !!state && !!state.closed && state.status === "playing" && gateFor !== state.currentPlayer;
  const interactive = !!state && state.status === "playing" && state.players[state.currentPlayer].isHuman && !busy && !gateShowing;
  const fog = !!state && (state.closed || state.players.some((p) => !p.isHuman)); // fog in vs-AI or closed games

  const reachable = useMemo(() => {
    if (!state || !selectedUnit || selectedUnit.owner !== state.currentPlayer || selectedUnit.moved) return [];
    return reachableTiles(state, selectedUnit);
  }, [state, selectedUnit]);

  // Tiles reachable only thanks to the road speed bonus (highlighted brighter).
  const roadExtra = useMemo(() => {
    if (!state || !selectedUnit || selectedUnit.owner !== state.currentPlayer || selectedUnit.moved) return [];
    if (selectedUnit.boat || !state.tiles[selectedUnit.tileId].road) return [];
    const base = reachableTiles(state, selectedUnit, true);
    return reachable.filter((t) => !base.includes(t));
  }, [state, selectedUnit, reachable]);

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

    // Tapping another player's merchant opens its shop so you can buy goods —
    // unless it is garrisoned inside an enemy city, in which case buying the city takes priority.
    if (unit && unit.type === "merchant" && unit.owner !== cp && !(city && city.owner !== cp)) {
      haptic.select();
      playSfx("tap");
      setBuyMerchantId(unit.id);
      setSelectedUnitId(null);
      setSelectedCityId(null);
      setSelectedBuildTileId(null);
      setMerchantOpen(false);
      return;
    }
    setBuyMerchantId(null);

    // Peaceful acquisition: tapping an enemy city or a neutral village offers a buy option,
    // unless a selected unit can act on that tile militarily (attack / move-in takes priority).
    const militaryTarget = !!selectedUnit && selectedUnit.owner === cp && (attackable.includes(tileId) || reachable.includes(tileId));
    if (!militaryTarget) {
      if (city && city.owner !== cp && canBuyCity(state, cp, city.id).price > 0) {
        haptic.select(); playSfx("tap");
        setCaptureTarget({ kind: "city", price: canBuyCity(state, cp, city.id).price, level: city.level, tileId, cityId: city.id });
        setSelectedUnitId(null);
        setSelectedCityId(null);
        setSelectedBuildTileId(null);
        return;
      }
      if (tile.isVillage && !tile.cityId && (cp !== 0 || tile.explored)) {
        haptic.select(); playSfx("tap");
        setCaptureTarget({ kind: "village", price: canBuyVillage(state, cp, tileId).price, tileId });
        setSelectedUnitId(null);
        setSelectedCityId(null);
        setSelectedBuildTileId(null);
        return;
      }
    }

    if (selectedUnit && selectedUnit.owner === cp) {
      if (attackable.includes(tileId)) {
        haptic.impact(Haptics.ImpactFeedbackStyle.Heavy);
        playSfx("battle");
        doAttack(selectedUnit.id, tileId);
        return;
      }
      if (reachable.includes(tileId)) {
        haptic.impact(Haptics.ImpactFeedbackStyle.Medium);
        const fromTileId = selectedUnit.tileId;
        const uid = selectedUnit.id;
        if (doMove(uid, tileId)) setMoveAnim({ unitId: uid, fromTileId, toTileId: tileId, key: Date.now() });
        return;
      }
      if (unit && unit.owner === cp) {
        haptic.select(); playSfx("tap");
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

    // Nothing selected — a wild animal takes priority so tapping it opens the hunt choice.
    if (tile.resource === "animal" && canHunt(state, cp, tileId).ok) {
      haptic.select(); playSfx("tap");
      setHuntTileId(tileId);
      setSelectedUnitId(null);
      setSelectedCityId(null);
      setSelectedBuildTileId(null);
      setMerchantOpen(false);
      return;
    }

    // Nothing selected — a fish tile opens the fishing choice.
    if (tile.resource === "fish" && canFish(state, cp, tileId).ok) {
      haptic.select(); playSfx("tap");
      setFishTileId(tileId);
      setSelectedUnitId(null);
      setSelectedCityId(null);
      setSelectedBuildTileId(null);
      setMerchantOpen(false);
      return;
    }

    // Nothing selected — city takes priority so an occupied capital is still accessible.
    if (city && city.owner === cp) {
      const garrison = unit && unit.owner === cp ? unit : undefined;
      haptic.select(); playSfx("tap");
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
      haptic.select(); playSfx("tap");
      setSelectedUnitId(unit.id);
      setSelectedCityId(null);
      setSelectedBuildTileId(null);
      setMerchantOpen(false);
    } else if (tileHasActions(state, cp, tileId)) {
      haptic.select(); playSfx("tap");
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
      haptic.impact(Haptics.ImpactFeedbackStyle.Light);
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
      haptic.select(); playSfx("tap");
    }
  };

  const onEndTurn = () => {
    haptic.impact(Haptics.ImpactFeedbackStyle.Heavy);
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
        roadExtra={roadExtra}
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

      {state.status === "playing" && stalemateTurnsLeft(state) > 0 && (
        <View pointerEvents="none" style={[styles.stalemateBanner, { top: insets.top + 52 }]} testID="stalemate-banner">
          <MaterialCommunityIcons name="alert-octagon" size={16} color="#3A2A0E" />
          <Text style={styles.stalemateText}>
            Boxed in — no way to fight back. Draw in {stalemateTurnsLeft(state)} turn{stalemateTurnsLeft(state) > 1 ? "s" : ""}
          </Text>
        </View>
      )}

      {toast && (
        <View pointerEvents="none" style={[styles.toast, { top: insets.top + 92 }]} testID="toast">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {selectedUnit && !selectedCity && !merchantOpen && (
        <UnitPanel
          state={state}
          unit={selectedUnit}
          bottomInset={insets.bottom}
          onEmbark={(id) => {
            haptic.impact(Haptics.ImpactFeedbackStyle.Medium);
            doEmbark(id);
          }}
          onUpgradeBoat={(id) => {
            haptic.impact(Haptics.ImpactFeedbackStyle.Medium);
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
            haptic.select(); playSfx("tap");
            doLoadMerchant(id, slotIndex, good, amount);
          }}
          onSetPrice={(id, slotIndex, price) => {
            haptic.select(); playSfx("tap");
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
              haptic.impact(Haptics.ImpactFeedbackStyle.Medium);
              playSfx("trade");
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
            haptic.impact(Haptics.ImpactFeedbackStyle.Medium);
            doTrain(selectedCity.id, t);
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
            haptic.impact(Haptics.ImpactFeedbackStyle.Medium);
            if (doBuild(selectedBuildTileId, bid)) setSelectedBuildTileId(null);
          }}
          onInfra={(iid) => {
            haptic.impact(Haptics.ImpactFeedbackStyle.Medium);
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
          haptic.notify();
          doResearch(id);
        }}
        onClose={() => setTechOpen(false)}
      />

      <LevelUpModal
        city={state.pendingLevelUps?.length ? state.cities.find((c) => c.id === state.pendingLevelUps[0]) ?? null : null}
        onPick={(cityId, rewardId) => {
          haptic.notify();
          doApplyReward(cityId, rewardId);
        }}
      />

      <TutorialOverlay visible={tutorialOpen} onClose={() => setTutorialOpen(false)} />

      <SaleModal sale={state.pendingSales?.[state.currentPlayer] ?? null} onClose={() => doClearSale()} />

      <CaptureModal
        target={captureTarget}
        stars={state.players[state.currentPlayer]?.stars ?? 0}
        onBuy={() => {
          if (!captureTarget) return;
          haptic.notify();
          playSfx("coin");
          if (captureTarget.kind === "city" && captureTarget.cityId) {
            const city = state.cities.find((c) => c.id === captureTarget.cityId);
            const pending = !!city && state.players[city.owner]?.isHuman && city.owner !== state.currentPlayer;
            let defectors = 0;
            if (city) {
              const terr = [city.tileId, ...neighbors(state, city.tileId)];
              defectors = state.units.filter((u) => u.owner === city.owner && terr.includes(u.tileId)).length;
            }
            doBuyCity(captureTarget.cityId);
            if (pending) showToast("Offer sent — awaiting the owner's reply");
            else if (defectors > 0) showToast(`${defectors} unit${defectors > 1 ? "s" : ""} joined your side!`);
          } else if (captureTarget.kind === "village") doBuyVillage(captureTarget.tileId);
          setCaptureTarget(null);
        }}
        onClose={() => setCaptureTarget(null)}
      />

      {(() => {
        const offer = state.pendingOffers?.find((o) => o.seller === state.currentPlayer);
        return (
          <OfferModal
            offer={offer ? { cityId: offer.cityId, buyerName: state.players[offer.buyer]?.name ?? "A rival", price: offer.price, level: offer.level } : null}
            onAccept={() => {
              haptic.notify();
              playSfx("coin");
              if (offer) doResolveOffer(offer.cityId, true);
            }}
            onDecline={() => {
              haptic.select(); playSfx("tap");
              if (offer) doResolveOffer(offer.cityId, false);
            }}
          />
        );
      })()}

      {gateShowing && state && (
        <View style={styles.gate} testID="start-turn-screen">
          <Text style={styles.gateLabel} testID="start-turn-label">{state.players[state.currentPlayer].name}</Text>
          <Pressable style={styles.gateBtn} testID="start-turn-btn" onPress={() => setGateFor(state.currentPlayer)}>
            <MaterialCommunityIcons name="play" size={24} color="#fff" />
            <Text style={styles.gateBtnText}>Start</Text>
          </Pressable>
        </View>
      )}

      <HuntChoiceModal
        visible={huntTileId != null && !huntPlaying}
        stars={state.players[state.currentPlayer]?.stars ?? 0}
        onHire={() => {
          if (huntTileId == null) return;
          haptic.notify();
          doHireHunter(huntTileId);
          setHuntTileId(null);
        }}
        onHunt={() => {
          haptic.impact(Haptics.ImpactFeedbackStyle.Medium);
          setHuntPlaying(true);
        }}
        onClose={() => setHuntTileId(null)}
      />

      {huntPlaying && (
        <HuntingMiniGame
          onFinish={(result) => {
            if (result === "kill" && huntTileId != null) {
              haptic.notify();
              doHuntSuccess(huntTileId);
            }
            setHuntPlaying(false);
            setHuntTileId(null);
          }}
        />
      )}

      <FishChoiceModal
        visible={fishTileId != null && !fishPlaying}
        stars={state.players[state.currentPlayer]?.stars ?? 0}
        onHire={() => {
          if (fishTileId == null) return;
          haptic.notify();
          doHireFisherman(fishTileId);
          setFishTileId(null);
        }}
        onFish={() => {
          haptic.impact(Haptics.ImpactFeedbackStyle.Medium);
          setFishPlaying(true);
        }}
        onClose={() => setFishTileId(null)}
      />

      {fishPlaying && (
        <FishingMiniGame
          onFinish={(result) => {
            if (result === "catch" && fishTileId != null) {
              haptic.notify();
              doFishSuccess(fishTileId);
            }
            setFishPlaying(false);
            setFishTileId(null);
          }}
        />
      )}


      {/* In-game menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.centerOverlay}>
          <View style={styles.dialog} testID="ingame-menu">
            <Text style={styles.dialogTitle}>Paused</Text>
            <Button testID="menu-resume" label="Resume" icon="play" onPress={() => setMenuOpen(false)} />

            <Pressable testID="toggle-sound" style={styles.toggleRow} onPress={() => setSoundOn(!soundOn)}>
              <MaterialCommunityIcons name={soundOn ? "volume-high" : "volume-off"} size={22} color={C.onSurface} />
              <Text style={styles.toggleLabel}>Sound Effects</Text>
              <View style={[styles.switch, soundOn && styles.switchOn]}>
                <View style={[styles.knob, soundOn && styles.knobOn]} />
              </View>
            </Pressable>

            <Pressable testID="toggle-haptics" style={styles.toggleRow} onPress={() => setHapticsOn(!hapticsOn)}>
              <MaterialCommunityIcons name={hapticsOn ? "vibrate" : "vibrate-off"} size={22} color={C.onSurface} />
              <Text style={styles.toggleLabel}>Vibration</Text>
              <View style={[styles.switch, hapticsOn && styles.switchOn]}>
                <View style={[styles.knob, hapticsOn && styles.knobOn]} />
              </View>
            </Pressable>

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
  toast: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(28,28,28,0.9)", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, ...shadow(6) },
  toastText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  stalemateBanner: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#E7C24B", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, ...shadow(5) },
  stalemateText: { color: "#3A2A0E", fontWeight: "900", fontSize: 12 },
  gate: { ...StyleSheet.absoluteFillObject, backgroundColor: "#1d3b38", alignItems: "center", justifyContent: "center", gap: 28, zIndex: 200 },
  gateLabel: { fontSize: 40, fontWeight: "900", color: "#F8F6F0", letterSpacing: 1 },
  gateBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#4F772D", paddingHorizontal: 44, paddingVertical: 16, borderRadius: 999 },
  gateBtnText: { color: "#fff", fontWeight: "900", fontSize: 20 },
  centerOverlay: { flex: 1, backgroundColor: "rgba(28,28,28,0.6)", alignItems: "center", justifyContent: "center", padding: SP.xl },
  dialog: { width: "100%", maxWidth: 360, backgroundColor: C.surface, borderRadius: R.lg, padding: SP.xl, gap: SP.md, alignItems: "stretch", ...shadow(10) },
  dialogTitle: { fontSize: 28, fontWeight: "900", color: C.onSurface, textAlign: "center" },
  dialogSub: { fontSize: 14, color: C.onSurfaceSecondary, textAlign: "center", marginBottom: SP.sm },
  saveNote: { fontSize: 12, color: C.onSurfaceSecondary, textAlign: "center" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: SP.md, backgroundColor: C.surfaceSecondary, paddingVertical: 14, paddingHorizontal: SP.lg, borderRadius: R.md },
  toggleLabel: { flex: 1, fontSize: 16, fontWeight: "800", color: C.onSurface },
  switch: { width: 48, height: 28, borderRadius: 999, backgroundColor: C.borderStrong, padding: 3, justifyContent: "center" },
  switchOn: { backgroundColor: C.brand },
  knob: { width: 22, height: 22, borderRadius: 999, backgroundColor: "#fff", ...shadow(2) },
  knobOn: { alignSelf: "flex-end" },
});
