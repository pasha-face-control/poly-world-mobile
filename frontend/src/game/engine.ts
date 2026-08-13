import {
  BOAT_DEFS,
  BUILDINGS,
  BUILDING_BY_ID,
  BUILDING_POP,
  INFRA_BY_ID,
  RESOURCE_DEFS,
  TECH_BY_ID,
  UNIT_DEFS,
  levelThreshold,
  slotCapacity,
} from "./data";
import { resolveCombat } from "./combat";
import { newCity, newUnit } from "./factory";
import { attackableTiles, chebyshev, neighbors, playerHasTech, reachableTiles, unitAt } from "./grid";
import { City, GameState, GoodType, NavalTier, ResourceType, UnitType } from "./types";

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
export interface RewardDef { id: string; name: string; icon: string; desc: string }

// Reward options offered to the human when a city levels up.
export function levelRewardOptions(city: City): RewardDef[] {
  const opts: RewardDef[] = [
    { id: "workshop", name: "Workshop", icon: "factory", desc: "+1 star income each turn" },
    { id: "treasury", name: "Treasury", icon: "treasure-chest", desc: "+8 stars right now" },
  ];
  if (!city.hasWall) opts.push({ id: "wall", name: "City Wall", icon: "wall", desc: "Strong defense when attacked" });
  else opts.push({ id: "growth", name: "Grand Park", icon: "tree", desc: "+2 population" });
  return opts;
}

function grantLevelReward(state: GameState, city: City) {
  // AI / default reward (the base +1 star/turn per level is applied in addPopulation).
  if (city.level % 2 === 0) state.players[city.owner].stars += 5;
  else city.hasWall = true;
}

export function applyLevelReward(state: GameState, cityId: string, rewardId: string): boolean {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return false;
  const i = (state.pendingLevelUps ?? []).indexOf(cityId);
  if (i < 0) return false;
  switch (rewardId) {
    case "workshop": city.production += 1; break;
    case "treasury": state.players[city.owner].stars += 8; break;
    case "wall": city.hasWall = true; break;
    case "growth": addPopulation(state, city, 2); break;
    default: return false;
  }
  state.pendingLevelUps.splice(i, 1);
  return true;
}

function addPopulation(state: GameState, city: City, amount: number) {
  city.population += amount;
  while (city.population >= levelThreshold(city.level)) {
    city.population -= levelThreshold(city.level);
    city.level += 1;
    city.production += 1; // every new level yields +1 star per turn
    if (city.owner === 0) {
      if (!state.pendingLevelUps) state.pendingLevelUps = [];
      state.pendingLevelUps.push(city.id); // human picks a reward via the UI
    } else {
      grantLevelReward(state, city);
    }
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

// Any city (any owner) controlling the tile.
function cityControllingTile(state: GameState, tileId: number): City | undefined {
  return state.cities.find((c) => cityTerritory(state, c).includes(tileId));
}

// ---------- Buildings ----------
export function canBuild(state: GameState, player: number, tileId: number, buildingId: string): { ok: boolean; reason?: string } {
  const def = BUILDING_BY_ID[buildingId];
  if (!def) return { ok: false, reason: "Unknown building" };
  const tile = state.tiles[tileId];
  if (tile.building) return { ok: false, reason: "Already built" };
  if (tile.cityId) return { ok: false, reason: "City tile" };
  if (tile.terrain !== def.terrain) return { ok: false, reason: `Needs ${def.terrain}` };
  if (def.requiresResource && tile.resource !== def.requiresResource) return { ok: false, reason: "No matching ore" };
  if (!playerHasTech(state, player, def.tech)) return { ok: false, reason: `Requires ${TECH_BY_ID[def.tech].name}` };
  if (!owningCityForTile(state, player, tileId)) return { ok: false, reason: "Not in your territory" };
  if (unitAt(state, tileId)) return { ok: false, reason: "Tile occupied" };
  if (state.players[player].stars < def.cost) return { ok: false, reason: "Not enough stars" };
  return { ok: true };
}

export function build(state: GameState, player: number, tileId: number, buildingId: string): boolean {
  if (!canBuild(state, player, tileId, buildingId).ok) return false;
  const def = BUILDING_BY_ID[buildingId];
  state.players[player].stars -= def.cost;
  state.tiles[tileId].building = buildingId;
  if (def.requiresResource) state.tiles[tileId].resource = null; // ore consumed by the mine
  // Farms & lumber huts grow the owning city's population.
  const popGain = BUILDING_POP[buildingId] ?? 0;
  if (popGain > 0) {
    const owner = owningCityForTile(state, player, tileId);
    if (owner) addPopulation(state, owner, popGain);
  }
  if (player === 0) computeVisibility(state, 0);
  log(state, `${state.players[player].name} built a ${def.name}`);
  return true;
}

export function buildableFor(state: GameState, player: number, tileId: number): string[] {
  return BUILDINGS.filter((b) => canBuild(state, player, tileId, b.id).ok).map((b) => b.id);
}

// ---------- Infrastructure (roads / ports / burn-forest) ----------
export function canInfra(state: GameState, player: number, tileId: number, infraId: string): { ok: boolean; reason?: string } {
  const def = INFRA_BY_ID[infraId];
  if (!def) return { ok: false, reason: "Unknown" };
  const tile = state.tiles[tileId];
  if (!playerHasTech(state, player, def.tech)) return { ok: false, reason: `Requires ${TECH_BY_ID[def.tech].name}` };
  if (state.players[player].stars < def.cost) return { ok: false, reason: "Not enough stars" };
  if (infraId === "road") {
    if (tile.terrain === "water" || tile.terrain === "mountain") return { ok: false, reason: "Cannot road here" };
    if (tile.road) return { ok: false, reason: "Already a road" };
    if (!owningCityForTile(state, player, tileId)) return { ok: false, reason: "Not in your territory" };
  } else if (infraId === "port") {
    if (tile.terrain !== "water") return { ok: false, reason: "Needs water" };
    if (tile.port) return { ok: false, reason: "Already a port" };
    // must border land in one of your cities' territory
    const adjOwned = neighbors(state, tileId).some((n) => state.tiles[n].terrain !== "water" && owningCityForTile(state, player, n));
    if (!adjOwned) return { ok: false, reason: "Must border your land" };
  } else if (infraId === "burn_forest") {
    if (tile.terrain !== "forest") return { ok: false, reason: "Needs forest" };
    if (!owningCityForTile(state, player, tileId)) return { ok: false, reason: "Not in your territory" };
    if (unitAt(state, tileId)) return { ok: false, reason: "Tile occupied" };
  }
  return { ok: true };
}

export function doInfra(state: GameState, player: number, tileId: number, infraId: string): boolean {
  if (!canInfra(state, player, tileId, infraId).ok) return false;
  const def = INFRA_BY_ID[infraId];
  state.players[player].stars -= def.cost;
  const tile = state.tiles[tileId];
  if (infraId === "road") tile.road = true;
  else if (infraId === "port") tile.port = true;
  else if (infraId === "burn_forest") {
    tile.terrain = "grass";
    tile.resource = "crop";
    tile.building = null;
  }
  if (player === 0) computeVisibility(state, 0);
  log(state, `${state.players[player].name} built a ${def.name}`);
  return true;
}

export function infraFor(state: GameState, player: number, tileId: number): string[] {
  return Object.keys(INFRA_BY_ID).filter((id) => canInfra(state, player, tileId, id).ok);
}

// Any actionable option (building or infra) for the tile — used to decide the tap panel.
export function tileHasActions(state: GameState, player: number, tileId: number): boolean {
  return buildableFor(state, player, tileId).length > 0 || infraFor(state, player, tileId).length > 0;
}

// ---------- Naval (embark / disembark / upgrade) ----------
export function canEmbark(state: GameState, unitId: string): { ok: boolean; reason?: string } {
  const u = state.units.find((x) => x.id === unitId);
  if (!u) return { ok: false, reason: "No unit" };
  if (u.boat) return { ok: false, reason: "Already at sea" };
  if (!playerHasTech(state, u.owner, "sailing")) return { ok: false, reason: "Requires Sailing" };
  if (!state.tiles[u.tileId].port) return { ok: false, reason: "Must be on a port" };
  return { ok: true };
}

export function embark(state: GameState, unitId: string): boolean {
  if (!canEmbark(state, unitId).ok) return false;
  const u = state.units.find((x) => x.id === unitId)!;
  u.boat = "rowing";
  // Merchant ships have 8 cargo slots — grow the inventory when embarking.
  if (u.type === "merchant" && u.cargo) {
    while (u.cargo.length < 8) u.cargo.push({ good: null, qty: 0, price: 3 });
  }
  u.moved = true;
  u.attacked = true;
  log(state, `${state.players[u.owner].name} embarked a ${UNIT_DEFS[u.type].name}`);
  return true;
}

export function nextBoatTier(tier: NavalTier): NavalTier | null {
  if (tier === "rowing") return "sailing";
  if (tier === "sailing") return "battleship";
  return null;
}

export function canUpgradeBoat(state: GameState, unitId: string): { ok: boolean; reason?: string } {
  const u = state.units.find((x) => x.id === unitId);
  if (!u || !u.boat) return { ok: false, reason: "Not a boat" };
  if (u.type === "merchant") return { ok: false, reason: "Merchant ships can't be armed" };
  const next = nextBoatTier(u.boat);
  if (!next) return { ok: false, reason: "Max tier" };
  const def = BOAT_DEFS[next];
  if (def.requires && !playerHasTech(state, u.owner, def.requires)) return { ok: false, reason: `Requires ${TECH_BY_ID[def.requires].name}` };
  if (state.players[u.owner].stars < def.upgradeCost) return { ok: false, reason: "Not enough stars" };
  return { ok: true };
}

export function upgradeBoat(state: GameState, unitId: string): boolean {
  if (!canUpgradeBoat(state, unitId).ok) return false;
  const u = state.units.find((x) => x.id === unitId)!;
  const next = nextBoatTier(u.boat!)!;
  const def = BOAT_DEFS[next];
  state.players[u.owner].stars -= def.upgradeCost;
  u.boat = next;
  log(state, `${state.players[u.owner].name} upgraded to a ${def.name}`);
  return true;
}

// ---------- Merchant trading (slot-based) ----------
// Load/unload a specific cargo slot from the owner's stockpile.
export function loadMerchant(state: GameState, unitId: string, slotIndex: number, good: GoodType, amount: number): boolean {
  const u = state.units.find((x) => x.id === unitId);
  if (!u || u.type !== "merchant" || !u.cargo) return false;
  const slot = u.cargo[slotIndex];
  if (!slot) return false;
  const player = state.players[u.owner];
  if (amount > 0) {
    const g = slot.good ?? good;
    if (!g) return false;
    if (slot.good && slot.good !== g) return false; // slot already holds a different good
    const room = slotCapacity(u) - slot.qty;
    const take = Math.min(amount, room, player.goods[g]);
    if (take <= 0) return false;
    player.goods[g] -= take;
    slot.good = g;
    slot.qty += take;
  } else {
    if (!slot.good) return false;
    const give = Math.min(-amount, slot.qty);
    if (give <= 0) return false;
    slot.qty -= give;
    player.goods[slot.good] += give;
    if (slot.qty <= 0) slot.good = null;
  }
  return true;
}

export function setMerchantPrice(state: GameState, unitId: string, slotIndex: number, price: number): boolean {
  const u = state.units.find((x) => x.id === unitId);
  if (!u || u.type !== "merchant" || !u.cargo) return false;
  const slot = u.cargo[slotIndex];
  if (!slot) return false;
  slot.price = Math.max(1, Math.min(99, Math.round(price)));
  return true;
}

const cargoTotal = (u: { cargo?: import("./types").CargoSlot[] }) => (u.cargo ? u.cargo.reduce((s, sl) => s + sl.qty, 0) : 0);

// A player buys goods directly from another player's merchant (pays stars to the owner).
export function canBuyFromMerchant(state: GameState, buyer: number, merchantId: string): { ok: boolean; reason?: string } {
  const m = state.units.find((u) => u.id === merchantId);
  if (!m || m.type !== "merchant" || !m.cargo) return { ok: false, reason: "Not a merchant" };
  if (m.owner === buyer) return { ok: false, reason: "Your own merchant" };
  if (buyer === 0 && !state.tiles[m.tileId].explored) return { ok: false, reason: "Not discovered" };
  if (cargoTotal(m) <= 0) return { ok: false, reason: "Nothing for sale" };
  return { ok: true };
}

export function buyFromMerchant(state: GameState, buyer: number, merchantId: string, slotIndex: number, amount: number): boolean {
  if (!canBuyFromMerchant(state, buyer, merchantId).ok) return false;
  const m = state.units.find((u) => u.id === merchantId)!;
  const slot = m.cargo![slotIndex];
  if (!slot || !slot.good || slot.qty <= 0) return false;
  const affordable = Math.floor(state.players[buyer].stars / slot.price);
  const take = Math.min(amount, slot.qty, affordable);
  if (take <= 0) return false;
  const g = slot.good;
  state.players[buyer].stars -= take * slot.price;
  state.players[buyer].goods[g] += take;
  slot.qty -= take;
  state.players[m.owner].stars += take * slot.price;
  recordSale(state, m.owner, g, take, take * slot.price);
  if (slot.qty <= 0) slot.good = null;
  log(state, `${state.players[buyer].name} bought ${take} ${g} from ${state.players[m.owner].name}'s merchant`);
  return true;
}

// Records a sale made by a HUMAN player's merchant so their turn-start notification can show it.
function recordSale(state: GameState, owner: number, good: GoodType, qty: number, stars: number) {
  if (qty <= 0 || !state.players[owner]?.isHuman) return;
  if (!state.pendingSales) state.pendingSales = {};
  if (!state.pendingSales[owner]) state.pendingSales[owner] = { goods: {}, stars: 0 };
  const bucket = state.pendingSales[owner];
  bucket.goods[good] = (bucket.goods[good] ?? 0) + qty;
  bucket.stars += stars;
}

// Bots are buy-only; each round they buy 1 unit from an affordable stocked slot.
export function resolveTrades(state: GameState) {
  for (const m of state.units) {
    if (m.type !== "merchant" || !m.cargo) continue;
    const cargo = m.cargo;
    for (const buyer of state.players) {
      if (buyer.index === m.owner || buyer.eliminated || buyer.isHuman) continue;
      const slot = cargo.find((sl) => sl.good && sl.qty > 0 && buyer.stars >= sl.price);
      if (!slot || !slot.good) continue;
      const good = slot.good;
      buyer.stars -= slot.price;
      buyer.goods[good] += 1;
      slot.qty -= 1;
      state.players[m.owner].stars += slot.price;
      recordSale(state, m.owner, good, 1, slot.price);
      if (slot.qty <= 0) slot.good = null;
    }
  }
}

// ---------- Economy income (turn start) ----------
// Stars a player gains at the start of each of their turns (cities + star-producing buildings).
export function starIncome(state: GameState, player: number): number {
  let income = state.cities.filter((c) => c.owner === player).reduce((s, c) => s + c.production, 0);
  for (const tile of state.tiles) {
    if (!tile.building) continue;
    const city = cityControllingTile(state, tile.id);
    if (!city || city.owner !== player) continue;
    const def = BUILDING_BY_ID[tile.building];
    if (!def) continue;
    income += def.produces.stars ?? 0;
  }
  return income;
}

export function startPlayerTurn(state: GameState, player: number) {
  const income = state.cities.filter((c) => c.owner === player).reduce((s, c) => s + c.production, 0);
  state.players[player].stars += income;
  // Building production for tiles the player's cities control.
  for (const tile of state.tiles) {
    if (!tile.building) continue;
    const city = cityControllingTile(state, tile.id);
    if (!city || city.owner !== player) continue;
    const def = BUILDING_BY_ID[tile.building];
    if (!def) continue;
    for (const [key, amt] of Object.entries(def.produces)) {
      if (key === "stars") state.players[player].stars += amt ?? 0;
      else state.players[player].goods[key as GoodType] += amt ?? 0;
    }
  }
  for (const u of state.units) {
    if (u.owner === player) {
      u.moved = false;
      u.attacked = false;
    }
  }
  completeVillageClaims(state, player);
  if (player === 0) {
    resolveTrades(state); // market tick each round on the human's turn
    computeVisibility(state, 0);
  }
}

// ---------- Player actions ----------
export function canHarvest(state: GameState, player: number, tileId: number): { ok: boolean; reason?: string } {
  const tile = state.tiles[tileId];
  if (!tile.resource) return { ok: false, reason: "No resource" };
  const def = RESOURCE_DEFS[tile.resource];
  if (!def) return { ok: false, reason: "Not harvestable" };
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

// ---------- Hunting (wild animals) ----------
function nearestPlayerCity(state: GameState, player: number, tileId: number): City | undefined {
  const t = state.tiles[tileId];
  let best: City | undefined;
  let bestD = Infinity;
  for (const c of state.cities) {
    if (c.owner !== player) continue;
    const ct = state.tiles[c.tileId];
    const d = Math.max(Math.abs(ct.x - t.x), Math.abs(ct.y - t.y));
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function canHunt(state: GameState, player: number, tileId: number): { ok: boolean; reason?: string } {
  const tile = state.tiles[tileId];
  if (tile.resource !== "animal") return { ok: false, reason: "No animal here" };
  if (player === 0 && !tile.explored) return { ok: false, reason: "Not discovered" };
  if (!playerHasTech(state, player, "hunting")) return { ok: false, reason: "Requires Hunting" };
  const city = cityControllingTile(state, tileId);
  if (!city || city.owner !== player) return { ok: false, reason: "Outside your borders" };
  return { ok: true };
}

function grantHuntReward(state: GameState, player: number, tileId: number) {
  const tile = state.tiles[tileId];
  tile.resource = null; // animal consumed
  state.players[player].goods.meat += 1;
  const city = nearestPlayerCity(state, player, tileId);
  if (city) addPopulation(state, city, 1);
  if (player === 0) computeVisibility(state, 0);
}

export function hireHunter(state: GameState, player: number, tileId: number): boolean {
  if (!canHunt(state, player, tileId).ok) return false;
  if (state.players[player].stars < 3) return false;
  state.players[player].stars -= 3;
  grantHuntReward(state, player, tileId);
  log(state, `${state.players[player].name} hired a hunter (+1 pop, +1 meat)`);
  return true;
}

export function huntSuccess(state: GameState, player: number, tileId: number): boolean {
  if (!canHunt(state, player, tileId).ok) return false;
  grantHuntReward(state, player, tileId);
  log(state, `${state.players[player].name} hunted the wild bull (+1 pop, +1 meat)`);
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
  if (type === "merchant") {
    // Merchants are peaceful trade units — usable the turn they're recruited.
    u.moved = false;
    u.attacked = false;
  } else {
    u.moved = true;
    u.attacked = true; // trained combat units act next turn
  }
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
    // Villages are not taken instantly — entering one starts a claim that completes next turn.
    if (tile.claimBy !== player) {
      tile.claimBy = player;
      tile.claimTurn = state.turn;
      log(state, `${state.players[player].name} is claiming a village (captures next turn)`);
    }
  } else if (tile.cityId) {
    const city = state.cities.find((c) => c.id === tile.cityId);
    if (city && city.owner !== player) {
      city.owner = player;
      city.hasWall = false;
      log(state, `${state.players[player].name} captured a city!`);
    }
  }
}

// Completes any village claims for this player that have waited a full turn.
function completeVillageClaims(state: GameState, player: number) {
  for (const tile of state.tiles) {
    if (!tile.isVillage || tile.cityId || tile.claimBy !== player) continue;
    if ((tile.claimTurn ?? state.turn) >= state.turn) continue; // not yet a turn old
    const occupant = unitAt(state, tile.id);
    if (occupant && occupant.owner === player) {
      const city = newCity(player, tile.id, false);
      tile.cityId = city.id;
      tile.isVillage = false;
      tile.claimBy = null;
      tile.claimTurn = undefined;
      state.cities.push(city);
      log(state, `${state.players[player].name} captured a village`);
    } else {
      // The claimant left before the capture could complete; village stays neutral.
      tile.claimBy = null;
      tile.claimTurn = undefined;
    }
  }
}

// ---------- Peaceful acquisition (buy villages & enemy cities) ----------
export function villageBuyPrice(): number {
  return 15;
}

export function cityBuyPrice(city: City): number {
  return 25 * city.level;
}

export function canBuyVillage(state: GameState, player: number, tileId: number): { ok: boolean; reason?: string; price: number } {
  const price = villageBuyPrice();
  const tile = state.tiles[tileId];
  if (!tile || !tile.isVillage || tile.cityId) return { ok: false, reason: "Not a village", price };
  if (player === 0 && !tile.explored) return { ok: false, reason: "Not discovered", price };
  const occ = unitAt(state, tileId);
  if (occ && occ.owner !== player) return { ok: false, reason: "Occupied by an enemy", price };
  if (state.players[player].stars < price) return { ok: false, reason: "Not enough stars", price };
  return { ok: true, price };
}

export function buyVillage(state: GameState, player: number, tileId: number): boolean {
  const check = canBuyVillage(state, player, tileId);
  if (!check.ok) return false;
  const tile = state.tiles[tileId];
  state.players[player].stars -= check.price;
  const city = newCity(player, tileId, false);
  tile.cityId = city.id;
  tile.isVillage = false;
  tile.claimBy = null;
  tile.claimTurn = undefined;
  state.cities.push(city);
  log(state, `${state.players[player].name} bought a village for ${check.price} stars`);
  if (player === 0) computeVisibility(state, 0);
  return true;
}

export function canBuyCity(state: GameState, player: number, cityId: string): { ok: boolean; reason?: string; price: number } {
  const city = state.cities.find((c) => c.id === cityId);
  if (!city) return { ok: false, reason: "No city", price: 0 };
  const price = cityBuyPrice(city);
  if (city.owner === player) return { ok: false, reason: "Already yours", price };
  if (player === 0 && !state.tiles[city.tileId].explored) return { ok: false, reason: "Not discovered", price };
  // A city can be bought even while a garrisoned unit sits inside — buying is peaceful,
  // the occupying unit is left untouched (it is NOT attacked or removed).
  if (state.players[player].stars < price) return { ok: false, reason: "Not enough stars", price };
  return { ok: true, price };
}

export function buyCity(state: GameState, player: number, cityId: string): boolean {
  const check = canBuyCity(state, player, cityId);
  if (!check.ok) return false;
  const city = state.cities.find((c) => c.id === cityId)!;
  const seller = city.owner;
  state.players[player].stars -= check.price;
  state.players[seller].stars += check.price; // the previous owner is paid for the sale
  city.owner = player;
  city.hasWall = false;
  log(state, `${state.players[player].name} bought a city for ${check.price} stars`);
  if (player === 0 || seller === 0) computeVisibility(state, 0);
  return true;
}

// Attempt to buy a city. If the seller is another HUMAN player, this instead escrows the
// buyer's stars and queues an OFFER for that human to accept or decline on their turn.
// Bot-owned cities are sold instantly (bots implicitly accept and are paid).
export function requestBuyCity(state: GameState, buyer: number, cityId: string): { ok: boolean; pending: boolean; reason?: string } {
  const check = canBuyCity(state, buyer, cityId);
  if (!check.ok) return { ok: false, pending: false, reason: check.reason };
  const city = state.cities.find((c) => c.id === cityId)!;
  const seller = city.owner;
  if (state.players[seller].isHuman && seller !== buyer) {
    if (!state.pendingOffers) state.pendingOffers = [];
    if (state.pendingOffers.some((o) => o.cityId === cityId && o.buyer === buyer)) return { ok: false, pending: false, reason: "Offer already sent" };
    state.players[buyer].stars -= check.price; // escrow until the seller responds
    state.pendingOffers.push({ cityId, buyer, seller, price: check.price, level: city.level });
    log(state, `${state.players[buyer].name} offered ${check.price} stars to buy ${state.players[seller].name}'s city`);
    return { ok: true, pending: true };
  }
  return { ok: buyCity(state, buyer, cityId), pending: false };
}

// The human seller accepts or declines a pending city-purchase offer.
export function resolveCityOffer(state: GameState, cityId: string, accept: boolean): boolean {
  if (!state.pendingOffers) return false;
  const i = state.pendingOffers.findIndex((o) => o.cityId === cityId);
  if (i < 0) return false;
  const offer = state.pendingOffers[i];
  state.pendingOffers.splice(i, 1);
  const city = state.cities.find((c) => c.id === cityId);
  // Refund the buyer if declined, or if the city is gone / no longer the seller's (e.g. captured meanwhile).
  if (!accept || !city || city.owner !== offer.seller) {
    state.players[offer.buyer].stars += offer.price;
    if (accept) log(state, `The deal for the city could not be completed — ${offer.price} stars refunded`);
    else log(state, `${state.players[offer.seller].name} declined the offer — ${offer.price} stars refunded`);
    return true;
  }
  state.players[offer.seller].stars += offer.price; // seller receives payment
  city.owner = offer.buyer;
  city.hasWall = false;
  log(state, `${state.players[offer.seller].name} sold a city to ${state.players[offer.buyer].name} for ${offer.price} stars`);
  if (offer.buyer === 0 || offer.seller === 0) computeVisibility(state, 0);
  return true;
}

export function moveUnit(state: GameState, unitId: string, targetTileId: number): boolean {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || unit.moved) return false;
  if (!reachableTiles(state, unit).includes(targetTileId)) return false;
  unit.tileId = targetTileId;
  unit.moved = true;
  // Disembark: a boat that lands on non-water reverts to its land form.
  if (unit.boat && state.tiles[targetTileId].terrain !== "water") {
    unit.boat = null;
    // A merchant ship shrinks back to 4 slots (cap 16); overflow returns to the stockpile.
    if (unit.type === "merchant" && unit.cargo) {
      const owner = state.players[unit.owner];
      for (let i = 0; i < unit.cargo.length; i++) {
        const sl = unit.cargo[i];
        if (i >= 4) {
          if (sl.good) owner.goods[sl.good] += sl.qty;
        } else if (sl.good && sl.qty > 16) {
          owner.goods[sl.good] += sl.qty - 16;
          sl.qty = 16;
        }
      }
      unit.cargo.length = 4;
    }
  }
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
  const aRange = attacker.boat ? BOAT_DEFS[attacker.boat].range : aDef.range;
  if (result.defenderDied) {
    state.units = state.units.filter((u) => u.id !== defender.id);
    log(state, `${state.players[attacker.owner].name}'s ${aDef.name} destroyed a unit`);
    // Melee move-in to the now-empty tile.
    if (aRange === 1 && !unitAt(state, targetTileId)) {
      attacker.tileId = targetTileId;
      if (attacker.boat && state.tiles[targetTileId].terrain !== "water") attacker.boat = null;
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
  // Peaceful (economic) victory: the human owns every city on the map while at
  // least one rival still has units. Nobody is destroyed — everyone gets a capital win.
  const totalCities = state.cities.length;
  const humanOwnsAll = totalCities > 0 && state.cities.every((c) => c.owner === 0);
  const rivalHasUnits = state.players.some((p) => p.index !== 0 && !p.eliminated && state.units.some((u) => u.owner === p.index));
  if (humanOwnsAll && rivalHasUnits) {
    state.status = "won";
    state.peacefulWin = true;
    return;
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
