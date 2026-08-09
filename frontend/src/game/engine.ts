import {
  RESOURCE_DEFS,
  TECH_BY_ID,
  UNIT_DEFS,
  levelThreshold,
} from "./data";
import { resolveCombat } from "./combat";
import { newCity, newUnit } from "./factory";
import { attackableTiles, chebyshev, neighbors, playerHasTech, reachableTiles, unitAt } from "./grid";
import { City, GameState, GoodType, ResourceType, UnitType } from "./types";

export const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s));

function log(state: GameState, msg: string) {
  state.log.unshift(`T${state.turn}: ${msg}`);
  if (state.log.length > 40) state.log.pop();
}

// ---------- Visibility ----------
export function computeVisibility(state: GameState, player = 0) {
  const reveal = (tileId: number, radius: number) => {
    const src = state.tiles[tileId];
    for (const t of state.tiles) {
      if (chebyshev(src, t) <= radius) t.explored = true;
    }
  };
  for (const u of state.units) {
    if (u.owner !== player) continue;
    const onMountain = state.tiles[u.tileId].terrain === "mountain";
    reveal(u.tileId, onMountain ? 2 : 1);
  }
  for (const c of state.cities) {
    if (c.owner !== player) continue;
    reveal(c.tileId, 1);
  }
}

// ---------- City growth ----------
function grantLevelReward(state: GameState, city: City) {
  city.production += 1;
  // Alternate reward: population/star boost.
  if (city.level % 2 === 0) {
    state.players[city.owner].stars += 5;
  } else {
    city.hasWall = true;
  }
}

function addPopulation(state: GameState, city: City, amount: number) {
  city.population += amount;
  while (city.population >= levelThreshold(city.level)) {
    city.population -= levelThreshold(city.level);
    city.level += 1;
    grantLevelReward(state, city);
  }
}

function cityTerritory(state: GameState, city: City): number[] {
  return [city.tileId, ...neighbors(state, city.tileId)];
}

// Find owned city whose territory includes tileId.
function owningCityForTile(state: GameState, player: number, tileId: number): City | undefined {
  return state.cities.find(
    (c) => c.owner === player && cityTerritory(state, c).includes(tileId),
  );
}

// ---------- Economy income (turn start) ----------
export function startPlayerTurn(state: GameState, player: number) {
  const income = state.cities.filter((c) => c.owner === player).reduce((s, c) => s + c.production, 0);
  state.players[player].stars += income;
  for (const u of state.units) {
    if (u.owner === player) {
      u.moved = false;
      u.attacked = false;
    }
  }
  if (player === 0) computeVisibility(state, 0);
}

// ---------- Player actions ----------
export function canHarvest(state: GameState, player: number, tileId: number): { ok: boolean; reason?: string } {
  const tile = state.tiles[tileId];
  if (!tile.resource) return { ok: false, reason: "No resource" };
  const def = RESOURCE_DEFS[tile.resource];
  if (!playerHasTech(state, player, def.tech)) return { ok: false, reason: `Requires ${TECH_BY_ID[def.tech].name}` };
  if (!owningCityForTile(state, player, tileId)) return { ok: false, reason: "Not in your territory" };
  if (state.players[player].stars < def.cost) return { ok: false, reason: "Not enough stars" };
  return { ok: true };
}

export function harvest(state: GameState, player: number, tileId: number): boolean {
  const check = canHarvest(state, player, tileId);
  if (!check.ok) return false;
  const tile = state.tiles[tileId];
  const def = RESOURCE_DEFS[tile.resource as Exclude<ResourceType, null>];
  const city = owningCityForTile(state, player, tileId)!;
  state.players[player].stars -= def.cost;
  tile.resource = null;
  addPopulation(state, city, def.pop);
  log(state, `${state.players[player].name} harvested ${def.name}`);
  return true;
}

export function canTrain(state: GameState, player: number, cityId: string, type: UnitType): { ok: boolean; reason?: string } {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city || city.owner !== player) return { ok: false, reason: "Invalid city" };
  const def = UNIT_DEFS[type];
  if (def.requires && !playerHasTech(state, player, def.requires)) return { ok: false, reason: `Requires ${TECH_BY_ID[def.requires].name}` };
  if (state.players[player].stars < def.cost) return { ok: false, reason: "Not enough stars" };
  if (def.goods) {
    for (const [good, amt] of Object.entries(def.goods)) {
      if ((state.players[player].goods[good as GoodType] ?? 0) < (amt ?? 0)) return { ok: false, reason: `Need ${amt} ${good}` };
    }
  }
  if (unitAt(state, city.tileId)) return { ok: false, reason: "City occupied" };
  return { ok: true };
}

export function trainUnit(state: GameState, player: number, cityId: string, type: UnitType): boolean {
  const check = canTrain(state, player, cityId, type);
  if (!check.ok) return false;
  const city = state.cities.find((c) => c.id === cityId)!;
  const def = UNIT_DEFS[type];
  state.players[player].stars -= def.cost;
  if (def.goods) {
    for (const [good, amt] of Object.entries(def.goods)) {
      state.players[player].goods[good as GoodType] -= amt ?? 0;
    }
  }
  const u = newUnit(type, player, city.tileId);
  u.moved = true;
  u.attacked = true; // trained units act next turn
  state.units.push(u);
  if (player === 0) computeVisibility(state, 0);
  log(state, `${state.players[player].name} trained ${def.name}`);
  return true;
}

export function availableTechs(state: GameState, player: number): string[] {
  const known = state.players[player].techs;
  return Object.values(TECH_BY_ID)
    .filter((t) => !known.includes(t.id) && (!t.requires || known.includes(t.requires)))
    .map((t) => t.id);
}

export function techCost(state: GameState, player: number, techId: string): number {
  const t = TECH_BY_ID[techId];
  const numCities = state.cities.filter((c) => c.owner === player).length || 1;
  // Scales gently with empire size, like Polytopia.
  return t.cost + (numCities - 1) * t.tier;
}

export function research(state: GameState, player: number, techId: string): boolean {
  const t = TECH_BY_ID[techId];
  if (!t) return false;
  if (state.players[player].techs.includes(techId)) return false;
  if (t.requires && !state.players[player].techs.includes(t.requires)) return false;
  const cost = techCost(state, player, techId);
  if (state.players[player].stars < cost) return false;
  state.players[player].stars -= cost;
  state.players[player].techs.push(techId);
  if (player === 0) computeVisibility(state, 0);
  log(state, `${state.players[player].name} researched ${t.name}`);
  return true;
}

function captureTile(state: GameState, player: number, tileId: number) {
  const tile = state.tiles[tileId];
  if (tile.isVillage && !tile.cityId) {
    const city = newCity(player, tileId, false);
    tile.cityId = city.id;
    tile.isVillage = false;
    state.cities.push(city);
    log(state, `${state.players[player].name} founded a city`);
  } else if (tile.cityId) {
    const city = state.cities.find((c) => c.id === tile.cityId);
    if (city && city.owner !== player) {
      city.owner = player;
      city.hasWall = false;
      log(state, `${state.players[player].name} captured a city!`);
    }
  }
}

export function moveUnit(state: GameState, unitId: string, targetTileId: number): boolean {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || unit.moved) return false;
  if (!reachableTiles(state, unit).includes(targetTileId)) return false;
  unit.tileId = targetTileId;
  unit.moved = true;
  captureTile(state, unit.owner, targetTileId);
  if (unit.owner === 0) computeVisibility(state, 0);
  return true;
}

export function attackUnit(state: GameState, attackerId: string, targetTileId: number): boolean {
  const attacker = state.units.find((u) => u.id === attackerId);
  if (!attacker || attacker.attacked) return false;
  if (!attackableTiles(state, attacker).includes(targetTileId)) return false;
  const defender = unitAt(state, targetTileId);
  if (!defender) return false;

  const result = resolveCombat(state, attacker, defender);
  attacker.attacked = true;
  attacker.moved = true;

  defender.hp -= result.attackerDamage;
  if (result.defenderDamage) attacker.hp -= result.defenderDamage;

  const aDef = UNIT_DEFS[attacker.type];
  if (result.defenderDied) {
    state.units = state.units.filter((u) => u.id !== defender.id);
    log(state, `${state.players[attacker.owner].name}'s ${aDef.name} destroyed a unit`);
    // Melee move-in to the now-empty tile.
    if (aDef.range === 1 && !unitAt(state, targetTileId)) {
      attacker.tileId = targetTileId;
      captureTile(state, attacker.owner, targetTileId);
    }
  }
  if (result.attackerDied) {
    state.units = state.units.filter((u) => u.id !== attacker.id);
  }
  if (attacker.owner === 0 || defender.owner === 0) computeVisibility(state, 0);
  return true;
}

// ---------- Turn flow ----------
export function checkVictory(state: GameState) {
  for (const p of state.players) {
    const hasCity = state.cities.some((c) => c.owner === p.index);
    const hasUnit = state.units.some((u) => u.owner === p.index);
    if (!hasCity && !hasUnit) p.eliminated = true;
  }
  const humanAlive = !state.players[0].eliminated;
  const enemiesAlive = state.players.some((p) => p.index !== 0 && !p.eliminated);
  if (!humanAlive) state.status = "lost";
  else if (!enemiesAlive) state.status = "won";
}

// Advance to next living player; wrap => new turn. Runs their income.
export function advanceTurn(state: GameState) {
  checkVictory(state);
  if (state.status !== "playing") return;
  let next = state.currentPlayer;
  for (let i = 0; i < state.players.length; i++) {
    next = (next + 1) % state.players.length;
    if (next === 0) state.turn += 1;
    if (!state.players[next].eliminated) break;
  }
  state.currentPlayer = next;
  startPlayerTurn(state, next);
}

export { reachableTiles, attackableTiles, unitAt, playerHasTech, neighbors, chebyshev };
