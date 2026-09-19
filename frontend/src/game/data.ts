import { C } from "@/src/theme";
import { CityBuildingType, GoodType, ResourceType, TerrainType, TribeId, UnitType } from "./types";

export interface UnitDef {
  type: UnitType;
  name: string;
  icon: string; // MaterialCommunityIcons name
  cost: number;
  hp: number;
  atk: number;
  def: number;
  move: number;
  range: number;
  requires: string | null; // tech id
  goods?: Partial<Record<GoodType, number>>;
}

export const GOODS: { id: GoodType; name: string; icon: string; color: string }[] = [
  { id: "wood", name: "Wood", icon: "tree", color: "#7A5230" },
  { id: "meat", name: "Meat", icon: "food-drumstick", color: "#BC4749" },
  { id: "wheat", name: "Wheat", icon: "barley", color: "#E5A93A" },
  { id: "iron", name: "Iron", icon: "img:ingot", color: "#7F8896" },
  { id: "horse", name: "Horse", icon: "horse-variant", color: "#8A5A34" },
];

// Crafted / city-builder resources (global, shared across a player's cities).
export const CITY_GOODS: { id: GoodType; name: string; icon: string; color: string }[] = [
  ...GOODS,
  { id: "planks", name: "Planks", icon: "wall", color: "#B08040" },
  { id: "stone", name: "Stone", icon: "cube", color: "#9AA0A6" },
  { id: "sand", name: "Sand", icon: "grain", color: "#E8CE8A" },
  { id: "glass", name: "Glass", icon: "diamond-stone", color: "#7FC6D6" },
  { id: "coal", name: "Coal", icon: "img:coal_ore", color: "#3A3A3A" },
];

// Goods a Merchant / Merchant Ship can carry & trade. Includes the crafted
// city materials (planks, stone, sand, glass); coal is not tradable.
export const TRADE_GOODS = CITY_GOODS.filter((g) => g.id !== "coal");

// Modest starting stockpile so goods-costed units are usable before production buildings exist.
export const START_GOODS: Record<GoodType, number> = { wood: 12, meat: 10, wheat: 6, iron: 8, horse: 2, planks: 0, stone: 0, sand: 0, glass: 0, coal: 0 };

export interface BuildingDef {
  id: string;
  name: string;
  icon: string;
  terrain: TerrainType;
  tech: string;
  cost: number; // stars
  produces: Partial<Record<GoodType | "stars", number>>;
  color: string;
  requiresResource?: ResourceType; // must sit on a tile carrying this ore/resource
}

export const BUILDINGS: BuildingDef[] = [
  { id: "lumber_hut", name: "Lumber Hut", icon: "home-roof", terrain: "forest", tech: "log_chopping", cost: 3, produces: { wood: 2 }, color: "#7A5230" },
  { id: "wheat_farm", name: "Wheat Farm", icon: "barley", terrain: "grass", tech: "farming", cost: 3, produces: { wheat: 2 }, color: "#E5A93A" },
  { id: "bull_farm", name: "Bull Farm", icon: "cow", terrain: "grass", tech: "bull_farming", cost: 4, produces: { meat: 2 }, color: "#BC4749" },
  { id: "horse_farm", name: "Horse Farm", icon: "horseshoe", terrain: "grass", tech: "horse_farming", cost: 4, produces: { horse: 1 }, color: "#8A5A34" },
  { id: "coal_mine", name: "Coal Mine", icon: "img:coal_mine", terrain: "mountain", tech: "mining", cost: 4, produces: {}, color: "#6E747B", requiresResource: "coal" },
  { id: "iron_mine", name: "Iron Mine", icon: "img:mine", terrain: "mountain", tech: "iron_mine", cost: 5, produces: { iron: 2 }, color: "#7F8896", requiresResource: "iron_ore" },
  { id: "gold_mine", name: "Gold Mine", icon: "gold", terrain: "mountain", tech: "gold_mine", cost: 6, produces: { stars: 5 }, color: "#E5A93A", requiresResource: "gold" },
];

export const BUILDING_BY_ID: Record<string, BuildingDef> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

// Population a building adds to its owning city when built.
export const BUILDING_POP: Record<string, number> = { lumber_hut: 1, wheat_farm: 2, bull_farm: 2, horse_farm: 2, coal_mine: 2, iron_mine: 2 };

export const UNIT_DEFS: Record<UnitType, UnitDef> = {
  warrior: { type: "warrior", name: "Warrior", icon: "sword", cost: 2, hp: 10, atk: 1, def: 1, move: 1, range: 1, requires: null, goods: { meat: 1 } },
  archer: { type: "archer", name: "Archer", icon: "bow-arrow", cost: 3, hp: 10, atk: 1, def: 1, move: 1, range: 2, requires: "hunting", goods: { meat: 1 } },
  beefeater: { type: "beefeater", name: "Beefeater", icon: "food-drumstick", cost: 5, hp: 12, atk: 1.5, def: 2, move: 1, range: 1, requires: "beef_eating", goods: { meat: 8 } },
  catapult: { type: "catapult", name: "Catapult", icon: "bomb", cost: 8, hp: 10, atk: 2, def: 0, move: 1, range: 4, requires: "mathematics", goods: { wood: 16 } },
  rider: { type: "rider", name: "Rider", icon: "horse-variant", cost: 3, hp: 10, atk: 1, def: 0.5, move: 2, range: 1, requires: "riding", goods: { horse: 1, wheat: 1 } },
  armored_rider: { type: "armored_rider", name: "Armored Rider", icon: "horse", cost: 3, hp: 10, atk: 1, def: 1.5, move: 2, range: 1, requires: "armor_production", goods: { wheat: 2, iron: 2, horse: 1 } },
  chivalry: { type: "chivalry", name: "Knight", icon: "shield-cross", cost: 8, hp: 10, atk: 2, def: 2, move: 3, range: 2, requires: "chivalry", goods: { wheat: 5, iron: 4, horse: 1 } },
  pikemen: { type: "pikemen", name: "Pikeman", icon: "chess-rook", cost: 5, hp: 15, atk: 1.5, def: 1.5, move: 1, range: 1, requires: "pike", goods: { meat: 2, iron: 2 } },
  swordsmen: { type: "swordsmen", name: "Swordsman", icon: "sword-cross", cost: 5, hp: 15, atk: 1.5, def: 1.5, move: 1, range: 1, requires: "sword_art", goods: { meat: 2, iron: 3 } },
  merchant: { type: "merchant", name: "Merchant", icon: "cart", cost: 4, hp: 10, atk: 0, def: 1, move: 1, range: 0, requires: "trading" },
};

// ---------- Naval (embarked) unit stats ----------
export interface BoatDef {
  tier: import("./types").NavalTier;
  name: string;
  icon: string;
  atk: number;
  def: number;
  move: number;
  range: number;
  upgradeCost: number; // stars to reach this tier from the previous one
  requires: string | null; // tech needed to upgrade to this tier
}

export const BOAT_DEFS: Record<import("./types").NavalTier, BoatDef> = {
  rowing: { tier: "rowing", name: "Rowing Boat", icon: "rowing", atk: 1, def: 1, move: 2, range: 1, upgradeCost: 0, requires: null },
  sailing: { tier: "sailing", name: "Sailing Boat", icon: "sail-boat", atk: 2, def: 1, move: 3, range: 2, upgradeCost: 5, requires: "sailing" },
  battleship: { tier: "battleship", name: "Frigate", icon: "ferry", atk: 4, def: 3, move: 3, range: 2, upgradeCost: 15, requires: "expedition" },
};

// Effective combat/movement stats for a unit, accounting for its embarked boat tier.
export interface EffStats { atk: number; def: number; move: number; range: number; maxHp: number }
export function unitStats(unit: import("./types").Unit): EffStats {
  const base = UNIT_DEFS[unit.type];
  const out: EffStats = { atk: base.atk, def: base.def, move: base.move, range: base.range, maxHp: base.hp };
  if (unit.boat) {
    const b = BOAT_DEFS[unit.boat];
    out.move = b.move;
    if (unit.type === "merchant") {
      out.def = b.def; // merchant ships stay peaceful (no attack)
    } else {
      out.atk = b.atk;
      out.def = b.def;
      out.range = b.range;
    }
  }
  return out;
}

// Merchant inventory: 4 slots on land / 8 as a ship; each slot holds one good
// type up to a per-slot cap (16 on land, 32 as a ship).
export const merchantSlots = (unit: import("./types").Unit) => (unit.boat ? 8 : 4);
export const slotCapacity = (unit: import("./types").Unit) => (unit.boat ? 32 : 16);

// ---------- Infrastructure (roads / ports / burn-forest) ----------
export interface InfraDef {
  id: "road" | "port" | "trade_port" | "burn_forest";
  name: string;
  icon: string;
  tech: string;
  cost: number; // stars
  woodCost?: number; // wood required alongside stars
  color: string;
  desc: string;
}

export const INFRA: InfraDef[] = [
  { id: "road", name: "Road", icon: "road-variant", tech: "roads", cost: 2, color: "#8A7B5C", desc: "Move freely along connected roads." },
  { id: "port", name: "Main Port", icon: "sail-boat", tech: "sailing", cost: 10, woodCost: 12, color: "#5C7A8A", desc: "Embark military & civilian units (not merchants). +3 pop. 10★ + 12 wood." },
  { id: "trade_port", name: "Trade Port", icon: "ferry", tech: "trading_overseas", cost: 8, woodCost: 10, color: "#4A8A6A", desc: "Embark Merchants onto Merchant Ships. +2 pop. 8★ + 10 wood." },
  { id: "burn_forest", name: "Clear Forest", icon: "fire", tech: "construction", cost: 3, color: "#B5651D", desc: "Burn forest into farmable grassland." },
];

export const INFRA_BY_ID: Record<string, InfraDef> = Object.fromEntries(INFRA.map((i) => [i.id, i]));

export interface TechDef {
  id: string;
  name: string;
  tier: number;
  cost: number;
  requires: string | null;
  icon: string;
  desc: string;
}

const T = (id: string, name: string, tier: number, requires: string | null, icon: string, desc: string, costOverride?: number): TechDef => ({
  id,
  name,
  tier,
  requires,
  icon,
  cost: costOverride ?? 4 + (tier - 1) * 3,
  desc,
});

export const TECHS: TechDef[] = [
  // Roots (branch from the center)
  T("forest_exploration", "Forest Exploration", 1, null, "tree", "Move units onto forest cells."),
  T("organisation", "Organisation", 1, null, "food-apple", "Harvest fruit for population."),
  T("climbing", "Climbing", 1, null, "image-filter-hdr", "Move units onto mountains."),
  T("fishing", "Fishing", 1, null, "fish", "Catch fish for +1 population."),

  // Forest branch
  T("hunting", "Hunting", 2, "forest_exploration", "bow-arrow", "Unlock Archer; hunt wild animals."),
  T("beef_eating", "Beef Eating", 3, "hunting", "food-drumstick", "Unlock the Beefeater unit."),
  T("log_chopping", "Log Chopping", 2, "forest_exploration", "axe", "Build Lumber Hut (+2 wood/turn)."),
  T("mathematics", "Mathematics", 3, "log_chopping", "bomb", "Unlock the Catapult unit."),
  T("riding", "Riding", 2, "forest_exploration", "horse-variant", "Unlock the Rider unit."),
  T("armor_production", "Armor Production", 3, "riding", "horse", "Unlock the Armored Rider."),
  T("pike", "Pike", 4, "armor_production", "chess-rook", "Unlock the Pikeman unit."),
  T("chivalry", "Chivalry", 5, "pike", "shield-cross", "Unlock the Knight unit."),
  T("devotion", "Devotion", 2, "forest_exploration", "hexagram", "Build Temples on grass (+population)."),
  T("forest_care", "Forest Care", 3, "devotion", "sprout", "Plant new forest; forest gives units ×1.5 defense."),

  // Organisation branch
  T("roads", "Roads", 2, "organisation", "road-variant", "Build roads: a unit on a road moves twice as far.", 2),
  T("construction", "Construction", 3, "roads", "home-city", "Build Windmills; burn forest to farmland.", 5),
  T("trading", "Trading", 4, "construction", "cart", "Unlock the Merchant unit.", 4),
  T("trading_overseas", "Trading Overseas", 5, "trading", "ferry", "Unlock Merchant Ship & Trade Port.", 15),
  T("farming", "Farming", 2, "organisation", "barley", "Build Wheat Farms on farmland."),
  T("bull_farming", "Bull Farming", 3, "farming", "cow", "Build Bull Farms (+2 meat/turn)."),
  T("horse_farming", "Horse Farming", 3, "farming", "horseshoe", "Build Horse Farms (+1 horse/turn)."),

  // Climbing branch
  T("forgery", "Forgery", 2, "climbing", "anvil", "Build Forge next to mines (+population)."),
  T("sword_art", "Sword Art", 3, "forgery", "sword-cross", "Unlock the Swordsman unit."),
  T("mining", "Mining", 2, "climbing", "img:coal_mine_line", "Build Coal Mine (+2 population)."),
  T("mining_technology", "Mining Technology", 3, "mining", "pickaxe", "Reveal Iron & Gold mine sites."),
  T("iron_mine", "Iron Mine", 4, "mining_technology", "img:ingot_line", "Build Iron Mines (+2 iron/turn)."),
  T("gold_mine", "Gold Mine", 4, "mining_technology", "gold", "Build Gold Mines (+5 stars/turn)."),

  // Fishing branch
  T("sailing", "Sailing", 2, "fishing", "sail-boat", "Build ports; upgrade to Sailing Boats."),
  T("expedition", "Expedition", 3, "sailing", "ferry", "Upgrade Sailing Boats to Frigates."),
];

export const TECH_BY_ID: Record<string, TechDef> = Object.fromEntries(TECHS.map((t) => [t.id, t]));

export interface ResourceDef {
  type: Exclude<ResourceType, null>;
  name: string;
  icon: string;
  cost: number;
  pop: number;
  tech: string;
  terrain: TerrainType;
}

export const RESOURCE_DEFS: Record<string, ResourceDef> = {
  fruit: { type: "fruit", name: "Fruit", icon: "food-apple", cost: 2, pop: 1, tech: "organisation", terrain: "grass" },
  animal: { type: "animal", name: "Game", icon: "paw", cost: 2, pop: 1, tech: "hunting", terrain: "forest" },
  ore: { type: "ore", name: "Ore", icon: "diamond-stone", cost: 5, pop: 2, tech: "mining", terrain: "mountain" },
  crop: { type: "crop", name: "Crop", icon: "barley", cost: 5, pop: 2, tech: "farming", terrain: "grass" },
};

export interface TribeDef {
  id: TribeId;
  name: string;
  color: string;
  startTech: string;
  blurb: string;
  icon: string;
  landComposition: { terrain: TerrainType; weight: number }[];
}

export const TRIBES: TribeDef[] = [
  {
    id: "nature",
    name: "Lesnoi",
    color: C.tribe_nature,
    startTech: "forest_exploration",
    blurb: "Deep-forest hunters. Start with Forest Exploration.",
    icon: "pine-tree",
    landComposition: [
      { terrain: "forest", weight: 0.8 },
      { terrain: "mountain", weight: 0.2 },
    ],
  },
  {
    id: "desert",
    name: "Freemen",
    color: C.tribe_desert,
    startTech: "riding",
    blurb: "Desert nomads. Start with Riding.",
    icon: "cactus",
    landComposition: [
      { terrain: "sand", weight: 0.6 },
      { terrain: "mountain", weight: 0.2 },
      { terrain: "forest", weight: 0.1 },
      { terrain: "grass", weight: 0.1 },
    ],
  },
  {
    id: "volcanic",
    name: "He-he",
    color: C.tribe_volcanic,
    startTech: "climbing",
    blurb: "Highland climbers. Start with Climbing.",
    icon: "image-filter-hdr",
    landComposition: [
      { terrain: "mountain", weight: 0.8 },
      { terrain: "forest", weight: 0.1 },
      { terrain: "grass", weight: 0.1 },
    ],
  },
  {
    id: "snow",
    name: "Fishmen",
    color: C.tribe_snow,
    startTech: "fishing",
    blurb: "Coastal fishers. Start with Fishing.",
    icon: "fish",
    landComposition: [
      { terrain: "mountain", weight: 0.3 },
      { terrain: "forest", weight: 0.3 },
      { terrain: "grass", weight: 0.4 },
    ],
  },
];

export const TRIBE_BY_ID: Record<TribeId, TribeDef> = Object.fromEntries(TRIBES.map((t) => [t.id, t])) as Record<TribeId, TribeDef>;

export const TERRAIN_COLOR: Record<TerrainType, string> = {
  grass: C.terrain_grass,
  forest: C.terrain_forest,
  mountain: C.terrain_mountain,
  water: C.terrain_water,
  sand: "#D8C48F",
};

export const RESOURCE_ICON: Record<string, string> = {
  fruit: "food-apple",
  animal: "paw",
  fish: "fish",
  ore: "diamond-stone",
  crop: "barley",
  coal: "img:coal_ore",
  iron_ore: "img:ingot_line",
  gold: "gold",
};

// City growth: population needed to advance from `level` to `level+1`.
export const levelThreshold = (level: number) => level + 1;

export const START_STARS = 5;

export const MAP_SIZES: { label: string; size: number }[] = [
  { label: "Small", size: 12 },
  { label: "Normal", size: 24 },
  { label: "Large", size: 36 },
];

export const MAP_TYPES: { id: import("./types").MapType; label: string; icon: string }[] = [
  { id: "continents", label: "Continents", icon: "map" },
  { id: "pangea", label: "Pangea", icon: "earth" },
  { id: "lakes", label: "Lakes", icon: "waves" },
  { id: "dryland", label: "Dryland", icon: "terrain" },
  { id: "archipelago", label: "Archipelago", icon: "island" },
];

// ---------- City Screen (city-builder) ----------

export const DIFFICULTIES: { id: import("./types").Difficulty; label: string; icon: string; blurb: string }[] = [
  { id: "peaceful", label: "Peaceful", icon: "peace", blurb: "Rivals trade; fight only if attacked" },
  { id: "easy", label: "Easy", icon: "emoticon-happy", blurb: "Timid tribes, gentle challenge" },
  { id: "normal", label: "Normal", icon: "sword-cross", blurb: "A balanced fight" },
  { id: "hard", label: "Hard", icon: "skull", blurb: "Aggressive, resourceful tribes" },
];

export const CITY_GRID = 30; // city map is always 30×30 cells
export const CITADEL_SIZE = 6; // centered citadel footprint

// Citadel model stage → sprite key (used by CityMap). Stage advances via upgrades.
export const CITADEL_STAGES = [1, 5, 10, 15];
export function citadelAssetKey(stage: number): string {
  const s = CITADEL_STAGES.filter((x) => x <= (stage || 1)).pop() ?? 1;
  return `citadel_${s}_tm`;
}

export interface CitadelUpgradeDef { toStage: number; stars: number; cost: Partial<Record<GoodType, number>>; requiresLevel: number }
export const CITADEL_UPGRADES: CitadelUpgradeDef[] = [
  { toStage: 5, stars: 10, cost: { planks: 50 }, requiresLevel: 4 },
  { toStage: 10, stars: 30, cost: { stone: 150, planks: 25 }, requiresLevel: 9 },
  { toStage: 15, stars: 40, cost: { stone: 100, glass: 10, planks: 40 }, requiresLevel: 14 },
];

export interface CityBuildingDef { id: CityBuildingType; name: string; icon: string; size: number; stars: number; cost: Partial<Record<GoodType, number>>; desc: string }
export const CITY_BUILDINGS: CityBuildingDef[] = [
  { id: "house", name: "House", icon: "home", size: 2, stars: 5, cost: { planks: 8 }, desc: "Connect it to the citadel by road for +2 population and +1★/turn." },
  { id: "factory", name: "Material Factory", icon: "factory", size: 3, stars: 0, cost: {}, desc: "Produces your tribe's unique material." },
  { id: "trade_tower", name: "Trade Tower", icon: "bank", size: 4, stars: 100, cost: { glass: 320 }, desc: "Doubles income from trade (stacks per tower)." },
  { id: "park", name: "Park", icon: "tree", size: 2, stars: 15, cost: { glass: 5 }, desc: "+5 stars per turn." },
];
export const CITY_BUILDING_BY_ID: Record<string, CityBuildingDef> = Object.fromEntries(CITY_BUILDINGS.map((b) => [b.id, b]));

// A tribe's Material Factory footprint: Lesnoi sawmill & Fishmen glass factory are 3×3;
// He-he stone quarry & Freemen sand quarry are 4×4.
export const FACTORY_SIZE_BY_TRIBE: Record<string, number> = { nature: 3, snow: 3, volcanic: 4, desert: 4 };
export function buildingSize(type: CityBuildingType, tribe: string): number {
  if (type === "factory") return FACTORY_SIZE_BY_TRIBE[tribe] ?? 3;
  return CITY_BUILDING_BY_ID[type].size;
}

// Max number of each building a city may hold at a given citadel stage (15 = unlimited).
export const BUILDING_LIMITS: Record<number, Partial<Record<CityBuildingType, number>>> = {
  1: { house: 1, factory: 1, trade_tower: 0, park: 0 },
  5: { house: 4, factory: 2, trade_tower: 1, park: 2 },
  10: { house: 8, factory: 2, trade_tower: 2, park: 4 },
  15: {},
};
export function buildingLimit(stage: number, type: CityBuildingType): number {
  const eff = CITADEL_STAGES.filter((x) => x <= (stage || 1)).pop() ?? 1;
  if (eff >= 15) return Infinity;
  return BUILDING_LIMITS[eff]?.[type] ?? 0;
}

// Each tribe's Material Factory makes a different resource.
export const TRIBE_MATERIAL: Record<TribeId, GoodType> = { nature: "planks", desert: "sand", volcanic: "stone", snow: "glass" };

