import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";
import { generateGame } from "./mapgen";
import {
  advanceTurn,
  applyLevelReward,
  attackUnit,
  build,
  buyFromMerchant,
  buyVillage,
  requestBuyCity,
  resolveCityOffer,
  checkVictory,
  clone,
  computeVisibility,
  revealFor,
  applyFogForPlayer,
  doInfra,
  embark,
  harvest,
  hireHunter,
  huntSuccess,
  hireFisherman,
  fishSuccess,
  loadMerchant,
  moveUnit,
  research,
  setMerchantPrice,
  startPlayerTurn,
  trainUnit,
  upgradeBoat,
} from "./engine";
import { runAiTurn } from "./ai";
import { GameState, GoodType, NewGameConfig, UnitType } from "./types";

const SAVE_KEY = "hextribes_save_v1";
const STATS_KEY = "hextribes_stats_v1";

export interface Stats {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  pwPoints: number;
}
const DEFAULT_STATS: Stats = { played: 0, wins: 0, losses: 0, draws: 0, pwPoints: 0 };

interface GameContextValue {
  state: GameState | null;
  busy: boolean;
  hasSave: boolean;
  stats: Stats;
  startNewGame: (config: NewGameConfig) => void;
  continueGame: () => Promise<boolean>;
  exitToMenu: () => void;
  endTurn: () => void;
  doMove: (unitId: string, tileId: number) => boolean;
  doAttack: (unitId: string, tileId: number) => boolean;
  doHarvest: (tileId: number) => boolean;
  doTrain: (cityId: string, type: UnitType) => boolean;
  doResearch: (techId: string) => boolean;
  doBuild: (tileId: number, buildingId: string) => boolean;
  doInfra: (tileId: number, infraId: string) => boolean;
  doEmbark: (unitId: string) => boolean;
  doUpgradeBoat: (unitId: string) => boolean;
  doLoadMerchant: (unitId: string, slotIndex: number, good: GoodType, amount: number) => boolean;
  doSetPrice: (unitId: string, slotIndex: number, price: number) => boolean;
  doApplyReward: (cityId: string, rewardId: string) => boolean;
  doHireHunter: (tileId: number) => boolean;
  doHuntSuccess: (tileId: number) => boolean;
  doHireFisherman: (tileId: number) => boolean;
  doFishSuccess: (tileId: number) => boolean;
  doBuyFromMerchant: (merchantId: string, slotIndex: number, amount: number) => boolean;
  doClearSale: () => boolean;
  doBuyVillage: (tileId: number) => boolean;
  doBuyCity: (cityId: string) => boolean;
  doResolveOffer: (cityId: string, accept: boolean) => boolean;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);

  useEffect(() => {
    (async () => {
      const raw = await storage.getItem<string>(SAVE_KEY, "");
      setHasSave(!!raw);
      const s = await storage.getItem<string>(STATS_KEY, "");
      if (s) {
        try {
          setStats({ ...DEFAULT_STATS, ...JSON.parse(s) });
        } catch {}
      }
    })();
  }, []);

  const persist = useCallback(async (s: GameState) => {
    await storage.setItem(SAVE_KEY, JSON.stringify(s));
    setHasSave(true);
  }, []);

  const recordResult = useCallback(
    async (outcome: GameState["status"], capitalWin: boolean) => {
      // PW points: Victory +8, Capital Win +4, Draw +1, Defeat -8.
      const pwDelta =
        outcome === "won" ? (capitalWin ? 4 : 8) : outcome === "draw" ? 1 : outcome === "lost" ? -8 : 0;
      const next: Stats = {
        played: stats.played + 1,
        wins: stats.wins + (outcome === "won" ? 1 : 0),
        losses: stats.losses + (outcome === "lost" ? 1 : 0),
        draws: stats.draws + (outcome === "draw" ? 1 : 0),
        pwPoints: stats.pwPoints + pwDelta,
      };
      setStats(next);
      await storage.setItem(STATS_KEY, JSON.stringify(next));
    },
    [stats],
  );

  const commit = useCallback(
    (s: GameState, prevStatus: GameState["status"]) => {
      setState(s);
      persist(s);
      if (s.status !== "playing" && prevStatus === "playing") {
        recordResult(s.status, !!s.peacefulWin);
      }
    },
    [persist, recordResult],
  );

  const startNewGame = useCallback(
    (config: NewGameConfig) => {
      const s = generateGame(config);
      s.closed = !!config.closed;
      if (s.closed) {
        // Closed game: each player only ever sees their own explored territory.
        for (const p of s.players) revealFor(s, p.index);
        applyFogForPlayer(s, 0);
      } else if (config.passAndPlay) {
        s.tiles.forEach((t) => (t.explored = true));
      } else {
        computeVisibility(s, 0);
      }
      startPlayerTurn(s, 0);
      // startPlayerTurn double-counts income for turn 1; reset stars to base + income once.
      commit(s, "playing");
    },
    [commit],
  );

  const continueGame = useCallback(async () => {
    const raw = await storage.getItem<string>(SAVE_KEY, "");
    if (!raw) return false;
    try {
      const loaded = JSON.parse(raw) as GameState;
      if (!loaded.pendingLevelUps) loaded.pendingLevelUps = [];
      if (!loaded.difficulty) loaded.difficulty = "normal";
      // Ensure every player has a complete goods record + flags (older saves
      // may be missing keys, which would crash the HUD reading `goods.wood`).
      for (const p of loaded.players || []) {
        const g = (p.goods || {}) as Partial<Record<GoodType, number>>;
        p.goods = { wood: 0, iron: 0, wheat: 0, meat: 0, horse: 0, ...g };
        if (p.provoked === undefined) p.provoked = false;
      }
      // Migrate old (record-based) merchant cargo to the new slot array.
      for (const u of loaded.units) {
        if (u.type === "merchant" && u.cargo && !Array.isArray(u.cargo)) {
          const rec = u.cargo as unknown as Record<string, number>;
          const oldPrice = (u as unknown as { price?: number }).price ?? 3;
          const slots = Object.entries(rec)
            .filter(([, q]) => q > 0)
            .map(([good, q]) => ({ good: good as GoodType, qty: q, price: oldPrice }));
          const count = u.boat ? 8 : 4;
          while (slots.length < count) slots.push({ good: null as unknown as GoodType, qty: 0, price: 3 });
          u.cargo = slots.slice(0, count) as unknown as GameState["units"][number]["cargo"];
        }
      }
      setState(loaded);
      return true;
    } catch {
      return false;
    }
  }, []);

  const exitToMenu = useCallback(() => setState(null), []);

  const apply = useCallback(
    (mutator: (s: GameState) => boolean): boolean => {
      if (!state) return false;
      const s = clone(state);
      const prevStatus = state.status;
      const ok = mutator(s);
      if (!ok) return false;
      checkVictory(s);
      commit(s, prevStatus);
      return true;
    },
    [state, commit],
  );

  const doMove = useCallback((unitId: string, tileId: number) => apply((s) => moveUnit(s, unitId, tileId)), [apply]);
  const doAttack = useCallback((unitId: string, tileId: number) => apply((s) => attackUnit(s, unitId, tileId)), [apply]);
  const doHarvest = useCallback((tileId: number) => apply((s) => harvest(s, s.currentPlayer, tileId)), [apply]);
  const doTrain = useCallback((cityId: string, type: UnitType) => apply((s) => trainUnit(s, s.currentPlayer, cityId, type)), [apply]);
  const doResearch = useCallback((techId: string) => apply((s) => research(s, s.currentPlayer, techId)), [apply]);
  const doBuild = useCallback((tileId: number, buildingId: string) => apply((s) => build(s, s.currentPlayer, tileId, buildingId)), [apply]);
  const doInfraCb = useCallback((tileId: number, infraId: string) => apply((s) => doInfra(s, s.currentPlayer, tileId, infraId)), [apply]);
  const doEmbark = useCallback((unitId: string) => apply((s) => embark(s, unitId)), [apply]);
  const doUpgradeBoat = useCallback((unitId: string) => apply((s) => upgradeBoat(s, unitId)), [apply]);
  const doLoadMerchant = useCallback((unitId: string, slotIndex: number, good: GoodType, amount: number) => apply((s) => loadMerchant(s, unitId, slotIndex, good, amount)), [apply]);
  const doSetPrice = useCallback((unitId: string, slotIndex: number, price: number) => apply((s) => setMerchantPrice(s, unitId, slotIndex, price)), [apply]);
  const doApplyReward = useCallback((cityId: string, rewardId: string) => apply((s) => applyLevelReward(s, cityId, rewardId)), [apply]);
  const doHireHunter = useCallback((tileId: number) => apply((s) => hireHunter(s, s.currentPlayer, tileId)), [apply]);
  const doHuntSuccess = useCallback((tileId: number) => apply((s) => huntSuccess(s, s.currentPlayer, tileId)), [apply]);
  const doHireFisherman = useCallback((tileId: number) => apply((s) => hireFisherman(s, s.currentPlayer, tileId)), [apply]);
  const doFishSuccess = useCallback((tileId: number) => apply((s) => fishSuccess(s, s.currentPlayer, tileId)), [apply]);
  const doBuyFromMerchant = useCallback((merchantId: string, slotIndex: number, amount: number) => apply((s) => buyFromMerchant(s, s.currentPlayer, merchantId, slotIndex, amount)), [apply]);
  const doClearSale = useCallback(() => apply((s) => { if (s.pendingSales) delete s.pendingSales[s.currentPlayer]; return true; }), [apply]);
  const doBuyVillage = useCallback((tileId: number) => apply((s) => buyVillage(s, s.currentPlayer, tileId)), [apply]);
  const doBuyCity = useCallback((cityId: string) => apply((s) => requestBuyCity(s, s.currentPlayer, cityId).ok), [apply]);
  const doResolveOffer = useCallback((cityId: string, accept: boolean) => apply((s) => resolveCityOffer(s, cityId, accept)), [apply]);

  const endTurn = useCallback(() => {
    if (!state || state.status !== "playing") return;
    const prevStatus = state.status;
    const s = clone(state);
    advanceTurn(s);

    const anyAi = s.players.some((p) => !p.isHuman);
    if (!anyAi) {
      commit(s, prevStatus);
      return;
    }
    setBusy(true);
    setTimeout(() => {
      let guard = 0;
      while (s.status === "playing" && !s.players[s.currentPlayer].isHuman && guard < 50) {
        runAiTurn(s, s.currentPlayer);
        advanceTurn(s);
        guard += 1;
      }
      commit(s, prevStatus);
      setBusy(false);
    }, 300);
  }, [state, commit]);

  return (
    <GameContext.Provider
      value={{
        state,
        busy,
        hasSave,
        stats,
        startNewGame,
        continueGame,
        exitToMenu,
        endTurn,
        doMove,
        doAttack,
        doHarvest,
        doTrain,
        doResearch,
        doBuild,
        doInfra: doInfraCb,
        doEmbark,
        doUpgradeBoat,
        doLoadMerchant,
        doSetPrice,
        doApplyReward,
        doHireHunter,
        doHuntSuccess,
        doHireFisherman,
        doFishSuccess,
        doBuyFromMerchant,
        doClearSale,
        doBuyVillage,
        doBuyCity,
        doResolveOffer,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
