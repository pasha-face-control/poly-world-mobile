import { C } from "@/src/theme";
import { GoodType, ResourceType, TerrainType, TribeId, UnitType } from "./types";

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
  { id: "iron", name: "Iron", icon: "anvil", color: "#7F8896" },
  { id: "horse", name: "Horse", icon: "horse-variant", color: "#8A5A34" },
];

// Modest starting stockpile so goods-costed units are usable before production buildings exist.
export const START_GOODS: Record<GoodType, number> = { wood: 12, meat: 10, wheat: 6, iron: 8, horse: 2 };

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
  { id: "coal_mine", name: "Coal Mine", icon: "fire", terrain: "mountain", tech: "mining", cost: 4, produces: {}, color: "#3A3A3A", requiresResource: "coal" },
  { id: "iron_mine", name: "Iron Mine", icon: "pickaxe", terrain: "mountain", tech: "iron_mine", cost: 5, produces: { iron: 2 }, color: "#7F8896", requiresResource: "iron_ore" },
  { id: "gold_mine", name: "Gold Mine", icon: "cash-multiple", terrain: "mountain", tech: "gold_mine", cost: 6, produces: { stars: 5 }, color: "#E5A93A", requiresResource: "gold" },
];

export const BUILDING_BY_ID: Record<string, BuildingDef> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

// Population a building adds to its owning city when built.
export const BUILDING_POP: Record<string, number> = { lumber_hut: 1, wheat_farm: 2, bull_farm: 2, horse_farm: 2, coal_mine: 2 };

export const UNIT_DEFS: Record<UnitType, UnitDef> = {
  warrior: { type: "warrior", name: "Warrior", icon: "sword", cost: 2, hp: 10, atk: 1, def: 1, move: 1, range: 1, requires: null },
  archer: { type: "archer", name: "Archer", icon: "bow-arrow", cost: 3, hp: 10, atk: 1, def: 1, move: 1, range: 2, requires: "hunting", goods: { meat: 1 } },
  beefeater: { type: "beefeater", name: "Beefeater", icon: "food-drumstick", cost: 5, hp: 12, atk: 1.5, def: 2, move: 1, range: 1, requires: "beef_eating", goods: { meat: 8 } },
  catapult: { type: "catapult", name: "Catapult", icon: "bomb", cost: 8, hp: 10, atk: 2, def: 0, move: 1, range: 4, requires: "mathematics", goods: { wood: 8 } },
  rider: { type: "rider", name: "Rider", icon: "horse-variant", cost: 5, hp: 10, atk: 1, def: 0.5, move: 2, range: 1, requires: "riding" },
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
  battleship: { tier: "battleship", name: "Battleship", icon: "ferry", atk: 4, def: 3, move: 3, range: 2, upgradeCost: 15, requires: "expedition" },
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
  id: "road" | "port" | "burn_forest";
  name: string;
  icon: string;
  tech: string;
  cost: number;
  color: string;
  desc: string;
}

export const INFRA: InfraDef[] = [
  { id: "road", name: "Road", icon: "road-variant", tech: "roads", cost: 2, color: "#8A7B5C", desc: "Move freely along connected roads." },
  { id: "port", name: "Port", icon: "sail-boat", tech: "sailing", cost: 4, color: "#5C7A8A", desc: "Embark land units onto boats here." },
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
  T("forest_care", "Forest Care", 3, "devotion", "sprout", "Plant new forest."),

  // Organisation branch
  T("roads", "Roads", 2, "organisation", "road-variant", "Build roads for faster movement.", 2),
  T("construction", "Construction", 3, "roads", "home-city", "Build Windmills; burn forest to farmland.", 5),
  T("trading", "Trading", 4, "construction", "cart", "Unlock the Merchant unit.", 4),
  T("trading_overseas", "Trading Overseas", 5, "trading", "ferry", "Unlock Merchant Ship & Trade Port.", 15),
  T("farming", "Farming", 2, "organisation", "barley", "Build Wheat Farms on farmland."),
  T("bull_farming", "Bull Farming", 3, "farming", "cow", "Build Bull Farms (+2 meat/turn)."),
  T("horse_farming", "Horse Farming", 3, "farming", "horseshoe", "Build Horse Farms (+1 horse/turn)."),

  // Climbing branch
  T("forgery", "Forgery", 2, "climbing", "anvil", "Build Forge next to mines (+population)."),
  T("sword_art", "Sword Art", 3, "forgery", "sword-cross", "Unlock the Swordsman unit."),
  T("mining", "Mining", 2, "climbing", "diamond-stone", "Build Coal Mine (+2 population)."),
  T("mining_technology", "Mining Technology", 3, "mining", "pickaxe", "Reveal Iron & Gold mine sites."),
  T("iron_mine", "Iron Mine", 4, "mining_technology", "gold", "Build Iron Mines (+2 iron/turn)."),
  T("gold_mine", "Gold Mine", 4, "mining_technology", "cash-multiple", "Build Gold Mines (+5 stars/turn)."),

  // Fishing branch
  T("sailing", "Sailing", 2, "fishing", "sail-boat", "Build ports; upgrade to Sailing Boats."),
  T("expedition", "Expedition", 3, "sailing", "ferry", "Upgrade Sailing Boats to Battleships."),
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
  fish: { type: "fish", name: "Fish", icon: "fish", cost: 2, pop: 1, tech: "fishing", terrain: "water" },
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
  coal: "fire",
  iron_ore: "anvil",
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

export const DIFFICULTIES: { id: import("./types").Difficulty; label: string; icon: string; blurb: string }[] = [
  { id: "peaceful", label: "Peaceful", icon: "peace", blurb: "Rivals trade; fight only if attacked" },
  { id: "easy", label: "Easy", icon: "emoticon-happy", blurb: "Timid tribes, gentle challenge" },
  { id: "normal", label: "Normal", icon: "sword-cross", blurb: "A balanced fight" },
  { id: "hard", label: "Hard", icon: "skull", blurb: "Aggressive, resourceful tribes" },
];

