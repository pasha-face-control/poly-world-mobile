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
  expandTerritory,
  expansionOptionForTile,
  harvest,
  loadMerchant,
  moveUnit,
  reachableTiles,
  refreshFog,
  research,
  setMerchantPrice,
  techCost,
  trainUnit,
} from "./engine";
import { RESOURCE_DEFS, TRIBE_MATERIAL, UNIT_DEFS, unitStats } from "./data";
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

// Tiles that make up a player's territory (their cities + surrounding cells + bought cells).
function ownedTerritory(state: GameState, player: number): Set<number> {
  const set = new Set<number>();
  for (const c of state.cities) {
    if (c.owner !== player) continue;
    set.add(c.tileId);
    for (const n of neighbors(state, c.tileId)) set.add(n);
    for (const e of c.expandedTiles ?? []) set.add(e);
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

// A peaceful bot's trade caravan travels cross-country to the human's capital so the
// player can buy from it (buying only needs the merchant's tile to be explored, which is
// always true right beside a city). Normal move rules — climbing for mountains, ports for
// water — are far too restrictive for a map-spanning trade run, so the caravan may cross
// ANY terrain (it shows as a ship over water) and only has to avoid tiles held by another
// unit. It parks on a free tile adjacent to the capital and then stays put to trade.
function stepMerchantToward(state: GameState, m: Unit, capitalTileId: number): void {
  if (chebyshev(state.tiles[m.tileId], state.tiles[capitalTileId]) <= 1) return; // already parked
  // Breadth-first search toward the capital, routing around tiles occupied by other units.
  const prev: Record<number, number> = {};
  const seen = new Set<number>([m.tileId]);
  const queue: number[] = [m.tileId];
  let reached = false;
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === capitalTileId) { reached = true; break; }
    for (const n of neighbors(state, cur)) {
      if (seen.has(n)) continue;
      const occ = unitAt(state, n);
      if (occ && occ.id !== m.id && n !== capitalTileId) continue; // can't pass through a unit
      seen.add(n);
      prev[n] = cur;
      queue.push(n);
    }
  }
  if (!reached) return;
  // Rebuild the path [firstStep, ..., capital], then drop the capital so we stop beside it.
  const path: number[] = [];
  for (let t = capitalTileId; t !== m.tileId; t = prev[t]) path.push(t);
  path.reverse();
  path.pop();
  // Advance several tiles per turn so the caravan actually reaches the player in good time.
  const range = Math.max(3, unitStats(m).move);
  let stepped = 0;
  for (const next of path) {
    if (stepped >= range) break;
    if (unitAt(state, next)) break; // never stack onto another unit
    m.tileId = next;
    m.boat = state.tiles[next].terrain === "water" ? "sailing" : null; // ship on water, cart on land
    stepped++;
  }
  if (stepped > 0) { m.moved = true; refreshFog(state, m.owner); }
}


export function runAiTurn(state: GameState, player: number) {
  const cfg = DIFF[state.difficulty] ?? DIFF.normal;
  state.players[player].stars += cfg.bonusStars; // difficulty handicap

  // Peaceful bots stay trade-focused until the human attacks them: capped tiny militia,
  // no city annexation, and their units garrison at home (they never roam to surround
  // the player). Being attacked sets `provoked`, which lifts all of these restraints.
  const restrained = state.difficulty === "peaceful" && !state.players[player].provoked;
  const MILITARY_CAP: Partial<Record<UnitType, number>> = { catapult: 1, rider: 1, warrior: 3 };

  const terr = ownedTerritory(state, player);
  const coastal = isCoastal(state, terr);

  // 1. Research when affordable (peaceful/hard prefer the trade line; coastal bots invest in sailing).
  const avail = availableTechs(state, player);
  // Every peaceful bot is fast-tracked down the trade line (one tech/turn, subsidised if broke)
  // so they ALL reliably reach `trading` within a few turns and can send a merchant to the
  // player — their tiny home economy would otherwise never afford it. Applies until they trade.
  const needTrading = restrained && !state.players[player].techs.includes("trading");
  if (needTrading) {
    const next = TRADE_LINE.find((id) => avail.includes(id));
    if (next) {
      const cost = techCost(state, player, next);
      if (state.players[player].stars < cost) state.players[player].stars = cost; // trade subsidy
      research(state, player, next);
    }
  } else if (avail.length) {
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
  // Restrained peaceful bots keep only a tiny militia: 1 catapult, 1 rider, 3 warriors — nothing else.
  const restrainedOrder: UnitType[] = ["catapult", "rider", "warrior"];
  // Trade-focused peaceful bots secure a merchant BEFORE any militia (a lone city can only
  // hold one unit at a time, so building warriors first would starve trade — and while they
  // still lack the `trading` tech they save their stars to research it faster).
  const needMerchantFirst = restrained
    && !state.units.some((u) => u.owner === player && u.type === "merchant");
  if (!needMerchantFirst) {
    for (const c of state.cities.filter((c) => c.owner === player)) {
      if (unitAt(state, c.tileId)) continue;
      const order = restrained ? restrainedOrder : buildOrder;
      for (const type of order) {
        const def = UNIT_DEFS[type];
        const hasTech = !def.requires || state.players[player].techs.includes(def.requires);
        if (!hasTech || state.players[player].stars < def.cost) continue;
        if (restrained) {
          const cap = MILITARY_CAP[type] ?? 0;
          const have = state.units.filter((u) => u.owner === player && u.type === type).length;
          if (have >= cap) continue; // militia cap reached for this type
        }
        trainUnit(state, player, c.id, type);
        break;
      }
    }
  }

  // 3b. Build production structures in city territory.
  for (const c of state.cities.filter((c) => c.owner === player)) {
    const terr = [c.tileId, ...neighbors(state, c.tileId), ...(c.expandedTiles ?? [])];
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
    // Peaceful bots run a "factory": they generate their tribe's material each turn so the
    // human can buy the resources they can't produce themselves.
    if (state.difficulty === "peaceful") {
      state.players[player].goods[TRIBE_MATERIAL[state.players[player].tribe]] += 4;
    }
    let merchants = state.units.filter((u) => u.owner === player && u.type === "merchant");
    if (merchants.length === 0) {
      // Subsidise a peaceful bot's FIRST merchant so it ships out the turn after `trading` lands.
      if (restrained && state.players[player].stars < UNIT_DEFS.merchant.cost) {
        state.players[player].stars = UNIT_DEFS.merchant.cost;
      }
      if (state.players[player].stars >= UNIT_DEFS.merchant.cost) {
        for (const c of state.cities.filter((c) => c.owner === player)) {
          if (unitAt(state, c.tileId)) continue;
          if (trainUnit(state, player, c.id, "merchant")) break;
        }
        merchants = state.units.filter((u) => u.owner === player && u.type === "merchant");
      }
    }
    // Sellable goods include the crafted materials (planks/stone/sand/glass) so the player
    // can buy what their own tribe can't make. The bot's own material is listed first so it
    // always claims a slot; coal is never traded.
    const material = TRIBE_MATERIAL[state.players[player].tribe];
    const sellable = [material, ...(["wood", "meat", "wheat", "iron", "horse", "planks", "stone", "sand", "glass"] as GoodType[]).filter((g) => g !== material)];
    for (const m of merchants) {
      if (!m.cargo) continue;
      // Fill empty slots from surplus goods; price each at 3.
      for (let i = 0; i < m.cargo.length; i++) {
        const slot = m.cargo[i];
        if (slot.good) continue;
        const g = sellable.find((gd) => state.players[player].goods[gd] > 3);
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
  // Restrained peaceful bots never annex — they stay trade-focused, not map-grabbing.
  if (!restrained) {
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

  // 3f. Territory expansion: a bot with spare stars buys one cheap expansion tile
  // per turn for one of its cities (keeps a small buffer so it can still act).
  {
    const buffer = 8;
    let bestTile: number | null = null;
    let bestCost = Infinity;
    for (const t of state.tiles) {
      const opt = expansionOptionForTile(state, player, t.id);
      if (!opt) continue;
      if (state.players[player].stars - opt.cost < buffer) continue;
      if (opt.cost < bestCost) { bestCost = opt.cost; bestTile = t.id; }
    }
    if (bestTile != null) expandTerritory(state, player, bestTile);
  }

  // 4. Move & attack each unit.
  // Restrained peaceful bots don't roam toward villages/players, BUT every bot walks one
  // Merchant to the human's capital as soon as possible so the player can trade with it
  // (buying only needs the merchant's tile to be explored — parking beside the capital
  // brings it into the player's vision). Other units just step off their own city tile so
  // the city keeps producing; they never advance on the player.
  if (restrained) {
    const own = ownedTerritory(state, player);
    const humanCap = state.cities.find((c) => c.owner === 0 && c.isCapital);
    if (humanCap) {
      for (const m of state.units.filter((u) => u.owner === player && u.type === "merchant")) {
        if (m.moved) continue;
        stepMerchantToward(state, m, humanCap.tileId);
      }
    }
    for (const u of state.units.filter((x) => x.owner === player && x.type !== "merchant")) {
      if (u.moved || u.boat) continue;
      const onCity = state.cities.some((c) => c.owner === player && c.tileId === u.tileId);
      if (!onCity) continue; // only shuffle units that are blocking a city
      const spot = reachableTiles(state, u).find((r) => own.has(r) && !state.cities.some((c) => c.tileId === r) && !unitAt(state, r));
      if (spot != null) moveUnit(state, u.id, spot);
    }
    return;
  }
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
