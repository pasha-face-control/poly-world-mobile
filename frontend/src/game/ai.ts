import {
  attackUnit,
  attackableTiles,
  availableTechs,
  build,
  buildableFor,
  buyCity,
  canBuyCity,
  chebyshev,
  cityBuyPrice,
  doInfra,
  embark,
  harvest,
  loadMerchant,
  moveUnit,
  reachableTiles,
  research,
  setMerchantPrice,
  techCost,
  trainUnit,
} from "./engine";
import { RESOURCE_DEFS, UNIT_DEFS } from "./data";
import { Difficulty, GameState, GoodType, Unit, UnitType } from "./types";
import { neighbors, unitAt } from "./grid";

interface DiffCfg {
  research: number; // chance to research when affordable
  aggressive: boolean; // seek out enemy units/cities to attack
  attackChance: number; // chance to actually attack an in-range enemy
  bonusStars: number; // extra stars per turn (handicap)
  preferTrade: boolean; // prioritise the trade tech line + merchants
}

const DIFF: Record<Difficulty, DiffCfg> = {
  peaceful: { research: 0.7, aggressive: false, attackChance: 1, bonusStars: 0, preferTrade: true },
  easy: { research: 0.4, aggressive: true, attackChance: 0.5, bonusStars: 0, preferTrade: false },
  normal: { research: 0.7, aggressive: true, attackChance: 1, bonusStars: 0, preferTrade: false },
  hard: { research: 1.0, aggressive: true, attackChance: 1, bonusStars: 2, preferTrade: false },
};

const TRADE_LINE = ["organisation", "roads", "construction", "trading", "trading_overseas"];
const NAVAL_LINE = ["fishing", "sailing", "expedition"];

// Tiles that make up a player's territory (their cities + surrounding cells).
function ownedTerritory(state: GameState, player: number): Set<number> {
  const set = new Set<number>();
  for (const c of state.cities) {
    if (c.owner !== player) continue;
    set.add(c.tileId);
    for (const n of neighbors(state, c.tileId)) set.add(n);
  }
  return set;
}

function isCoastal(state: GameState, terr: Set<number>): boolean {
  for (const tid of terr) {
    if (state.tiles[tid].terrain === "water") continue;
    if (neighbors(state, tid).some((n) => state.tiles[n].terrain === "water")) return true;
  }
  return false;
}

// Peaceful bots expand to neutral villages only; everyone else also hunts enemies.
function objectiveTiles(state: GameState, player: number, aggressive: boolean): number[] {
  const out: number[] = [];
  for (const t of state.tiles) if (t.isVillage && !t.cityId) out.push(t.id);
  if (aggressive) {
    for (const c of state.cities) if (c.owner !== player) out.push(c.tileId);
    for (const u of state.units) if (u.owner !== player && u.type !== "merchant") out.push(u.tileId);
  }
  return out;
}

function nearestObjective(state: GameState, unit: Unit, objectives: number[]): number | null {
  const from = state.tiles[unit.tileId];
  let best: number | null = null;
  let bestD = Infinity;
  for (const o of objectives) {
    const d = chebyshev(from, state.tiles[o]);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

function tryAttack(state: GameState, unit: Unit): boolean {
  const targets = attackableTiles(state, unit);
  if (!targets.length) return false;
  // Attack the weakest reachable enemy.
  let target = targets[0];
  let lowHp = Infinity;
  for (const t of targets) {
    const d = unitAt(state, t);
    if (d && d.hp < lowHp) {
      lowHp = d.hp;
      target = t;
    }
  }
  return attackUnit(state, unit.id, target);
}

export function runAiTurn(state: GameState, player: number) {
  const cfg = DIFF[state.difficulty] ?? DIFF.normal;
  state.players[player].stars += cfg.bonusStars; // difficulty handicap

  const terr = ownedTerritory(state, player);
  const coastal = isCoastal(state, terr);

  // 1. Research when affordable (peaceful/hard prefer the trade line; coastal bots invest in sailing).
  const avail = availableTechs(state, player);
  if (avail.length) {
    const affordable = avail
      .map((id) => ({ id, cost: techCost(state, player, id) }))
      .filter((t) => t.cost <= state.players[player].stars)
      .sort((a, b) => a.cost - b.cost);
    if (affordable.length && Math.random() < cfg.research) {
      let pick = affordable[0];
      if (cfg.preferTrade) {
        const t = affordable.find((a) => TRADE_LINE.includes(a.id));
        if (t) pick = t;
      }
      // Coastal bots frequently prioritise the naval line so the seas stay active.
      if (coastal) {
        const nav = affordable.find((a) => NAVAL_LINE.includes(a.id));
        if (nav && Math.random() < 0.6) pick = nav;
      }
      research(state, player, pick.id);
    }
  }

  // 2. Harvest resources in territory to grow.
  for (const t of state.tiles) {
    if (!t.resource) continue;
    const def = RESOURCE_DEFS[t.resource];
    if (!def) continue; // ores that gate mines aren't harvestable
    if (!state.players[player].techs.includes(def.tech)) continue;
    harvest(state, player, t.id); // no-op if not in territory / unaffordable
  }

  // 3. Train units in empty cities.
  const buildOrder: UnitType[] = ["chivalry", "swordsmen", "catapult", "armored_rider", "pikemen", "rider", "archer", "beefeater", "warrior"];
  for (const c of state.cities.filter((c) => c.owner === player)) {
    if (unitAt(state, c.tileId)) continue;
    for (const type of buildOrder) {
      const def = UNIT_DEFS[type];
      const hasTech = !def.requires || state.players[player].techs.includes(def.requires);
      if (hasTech && state.players[player].stars >= def.cost) {
        trainUnit(state, player, c.id, type);
        break;
      }
    }
  }

  // 3b. Build production structures in city territory.
  for (const c of state.cities.filter((c) => c.owner === player)) {
    const terr = [c.tileId, ...neighbors(state, c.tileId)];
    for (const tid of terr) {
      const opts = buildableFor(state, player, tid);
      if (opts.length) {
        build(state, player, tid, opts[0]);
        break;
      }
    }
  }

  // 3c. Trading: keep one stocked merchant for sale so rivals can buy from it.
  if (state.players[player].techs.includes("trading")) {
    let merchants = state.units.filter((u) => u.owner === player && u.type === "merchant");
    if (merchants.length === 0 && state.players[player].stars >= UNIT_DEFS.merchant.cost) {
      for (const c of state.cities.filter((c) => c.owner === player)) {
        if (unitAt(state, c.tileId)) continue;
        if (trainUnit(state, player, c.id, "merchant")) break;
      }
      merchants = state.units.filter((u) => u.owner === player && u.type === "merchant");
    }
    for (const m of merchants) {
      if (!m.cargo) continue;
      // Fill empty slots from surplus goods; price each at 3.
      for (let i = 0; i < m.cargo.length; i++) {
        const slot = m.cargo[i];
        if (slot.good) continue;
        const g = (["wood", "meat", "wheat", "iron", "horse"] as GoodType[]).find((gd) => state.players[player].goods[gd] > 3);
        if (!g) break;
        loadMerchant(state, m.id, i, g, Math.min(8, state.players[player].goods[g] - 1));
        setMerchantPrice(state, m.id, i, 3);
      }
    }
  }

  // 3d. Seafaring: coastal bots build a port so units can put out to sea.
  if (coastal && state.players[player].techs.includes("sailing")) {
    const hasPort = state.tiles.some((t) => t.port && neighbors(state, t.id).some((n) => terr.has(n) && state.tiles[n].terrain !== "water"));
    if (!hasPort) {
      for (const t of state.tiles) {
        if (t.terrain !== "water" || t.port) continue;
        if (!neighbors(state, t.id).some((n) => terr.has(n) && state.tiles[n].terrain !== "water")) continue;
        if (doInfra(state, player, t.id, "port")) break;
      }
    }
  }

  // 3e. Annexation: a wealthy bot peacefully buys a weak, undefended, nearby rival city.
  {
    const myStars = state.players[player].stars;
    const candidate = state.cities
      .filter((c) => c.owner !== player)
      .map((c) => ({ c, price: cityBuyPrice(c) }))
      .filter(({ c, price }) => price <= 50 && myStars - price >= 15 && canBuyCity(state, player, c.id).ok)
      // Bots only peacefully buy *undefended* cities (players may buy defended ones).
      .filter(({ c }) => { const u = unitAt(state, c.tileId); return !u || u.owner === player; })
      .filter(({ c }) => [...terr].some((tid) => chebyshev(state.tiles[tid], state.tiles[c.tileId]) <= 4))
      .sort((a, b) => a.price - b.price)[0];
    if (candidate) buyCity(state, player, candidate.c.id);
  }

  // 4. Move & attack each unit (merchants stay put and trade).
  const myUnits = state.units.filter((u) => u.owner === player);

  // Embark units already sitting on a port when their nearest objective is across the water.
  if (state.players[player].techs.includes("sailing")) {
    const seaObjs = objectiveTiles(state, player, true);
    for (const u of myUnits) {
      if (u.boat || u.type === "merchant" || u.moved) continue;
      if (!state.tiles[u.tileId].port) continue;
      const near = nearestObjective(state, u, seaObjs);
      if (near != null && chebyshev(state.tiles[u.tileId], state.tiles[near]) >= 4) embark(state, u.id);
    }
  }

  for (const u of myUnits) {
    if (u.type === "merchant") continue;
    if (!state.units.find((x) => x.id === u.id)) continue; // may have died
    // Peaceful bots never strike first — they only fight back after being attacked.
    const mayFight = cfg.aggressive || !!state.players[player].provoked;
    const canFight = mayFight && Math.random() < cfg.attackChance;
    if (canFight && tryAttack(state, u)) continue;

    const objectives = objectiveTiles(state, player, cfg.aggressive);
    const target = nearestObjective(state, u, objectives);
    if (target == null) continue;

    const reach = reachableTiles(state, u);
    if (reach.length) {
      const targetTile = state.tiles[target];
      let bestTile = reach[0];
      let bestD = Infinity;
      for (const r of reach) {
        const d = chebyshev(state.tiles[r], targetTile);
        if (d < bestD) {
          bestD = d;
          bestTile = r;
        }
      }
      // Prefer stepping onto an objective tile directly if adjacent/reachable.
      const objReachable = reach.find((r) => neighbors(state, r).includes(target) || r === target);
      moveUnit(state, u.id, objReachable ?? bestTile);
    }
    // Attack after moving.
    if (canFight) tryAttack(state, u);
  }
}
