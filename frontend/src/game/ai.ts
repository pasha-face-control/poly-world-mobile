import {
  attackUnit,
  attackableTiles,
  availableTechs,
  build,
  buildableFor,
  chebyshev,
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
import { GameState, GoodType, Unit, UnitType } from "./types";
import { neighbors, unitAt } from "./grid";

function objectiveTiles(state: GameState, player: number): number[] {
  const out: number[] = [];
  for (const t of state.tiles) if (t.isVillage && !t.cityId) out.push(t.id);
  for (const c of state.cities) if (c.owner !== player) out.push(c.tileId);
  for (const u of state.units) if (u.owner !== player) out.push(u.tileId);
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
  // 1. Research when affordable (prefer cheapest, some randomness).
  const avail = availableTechs(state, player);
  if (avail.length) {
    const affordable = avail
      .map((id) => ({ id, cost: techCost(state, player, id) }))
      .filter((t) => t.cost <= state.players[player].stars)
      .sort((a, b) => a.cost - b.cost);
    if (affordable.length && Math.random() < 0.7) research(state, player, affordable[0].id);
  }

  // 2. Harvest resources in territory to grow.
  for (const t of state.tiles) {
    if (!t.resource) continue;
    const def = RESOURCE_DEFS[t.resource];
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
      const total = m.cargo ? Object.values(m.cargo).reduce((s, v) => s + v, 0) : 0;
      if (total < 4) {
        for (const g of ["wood", "meat", "wheat", "iron", "horse"] as GoodType[]) {
          const have = state.players[player].goods[g];
          if (have > 2) loadMerchant(state, m.id, g, Math.min(2, have - 1));
        }
        setMerchantPrice(state, m.id, 3);
      }
    }
  }

  // 4. Move & attack each unit (merchants stay put and trade).
  const myUnits = state.units.filter((u) => u.owner === player);
  for (const u of myUnits) {
    if (u.type === "merchant") continue;
    if (!state.units.find((x) => x.id === u.id)) continue; // may have died
    if (tryAttack(state, u)) continue;

    const objectives = objectiveTiles(state, player);
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
    tryAttack(state, u);
  }
}
