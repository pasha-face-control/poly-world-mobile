import { C } from "@/src/theme";
import { ResourceType, TerrainType, TribeId, UnitType } from "./types";

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
}

export const UNIT_DEFS: Record<UnitType, UnitDef> = {
  warrior: { type: "warrior", name: "Warrior", icon: "sword", cost: 2, hp: 10, atk: 2, def: 2, move: 1, range: 1, requires: null },
  rider: { type: "rider", name: "Rider", icon: "horse-variant", cost: 3, hp: 10, atk: 2, def: 1, move: 2, range: 1, requires: "riding" },
  archer: { type: "archer", name: "Archer", icon: "bow-arrow", cost: 3, hp: 10, atk: 2, def: 1, move: 1, range: 2, requires: "archery" },
  swordsman: { type: "swordsman", name: "Swordsman", icon: "sword-cross", cost: 5, hp: 15, atk: 3, def: 3, move: 1, range: 1, requires: "smithery" },
};

export interface TechDef {
  id: string;
  name: string;
  tier: 1 | 2;
  cost: number;
  requires: string | null;
  icon: string;
  desc: string;
}

export const TECHS: TechDef[] = [
  { id: "hunting", name: "Hunting", tier: 1, cost: 5, requires: null, icon: "paw", desc: "Hunt forest animals for population." },
  { id: "organization", name: "Organization", tier: 1, cost: 5, requires: null, icon: "food-apple", desc: "Harvest fruit for population." },
  { id: "climbing", name: "Climbing", tier: 1, cost: 5, requires: null, icon: "image-filter-hdr", desc: "Traverse mountains; better vision." },
  { id: "fishing", name: "Fishing", tier: 1, cost: 5, requires: null, icon: "fish", desc: "Harvest fish from the sea." },
  { id: "riding", name: "Riding", tier: 1, cost: 5, requires: null, icon: "horse-variant", desc: "Unlock the fast Rider unit." },
  { id: "archery", name: "Archery", tier: 2, cost: 8, requires: "hunting", icon: "bow-arrow", desc: "Unlock the ranged Archer." },
  { id: "mining", name: "Mining", tier: 2, cost: 8, requires: "climbing", icon: "diamond-stone", desc: "Mine mountain ore (+2 pop)." },
  { id: "farming", name: "Farming", tier: 2, cost: 8, requires: "organization", icon: "barley", desc: "Farm crops (+2 pop)." },
  { id: "smithery", name: "Smithery", tier: 2, cost: 8, requires: "mining", icon: "sword-cross", desc: "Unlock the mighty Swordsman." },
  { id: "sailing", name: "Sailing", tier: 2, cost: 8, requires: "fishing", icon: "sail-boat", desc: "Move units across water as boats." },
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
  fruit: { type: "fruit", name: "Fruit", icon: "food-apple", cost: 2, pop: 1, tech: "organization", terrain: "grass" },
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
}

export const TRIBES: TribeDef[] = [
  { id: "nature", name: "Verdi", color: C.tribe_nature, startTech: "hunting", blurb: "Forest hunters. Start with Hunting.", icon: "pine-tree" },
  { id: "desert", name: "Sunja", color: C.tribe_desert, startTech: "riding", blurb: "Swift nomads. Start with Riding.", icon: "cactus" },
  { id: "volcanic", name: "Emberon", color: C.tribe_volcanic, startTech: "climbing", blurb: "Mountain folk. Start with Climbing.", icon: "image-filter-hdr" },
  { id: "snow", name: "Frostael", color: C.tribe_snow, startTech: "fishing", blurb: "Coastal seafarers. Start with Fishing.", icon: "snowflake" },
];

export const TRIBE_BY_ID: Record<TribeId, TribeDef> = Object.fromEntries(TRIBES.map((t) => [t.id, t])) as Record<TribeId, TribeDef>;

export const TERRAIN_COLOR: Record<TerrainType, string> = {
  grass: C.terrain_grass,
  forest: C.terrain_forest,
  mountain: C.terrain_mountain,
  water: C.terrain_water,
};

export const RESOURCE_ICON: Record<string, string> = {
  fruit: "food-apple",
  animal: "paw",
  fish: "fish",
  ore: "diamond-stone",
  crop: "barley",
};

// City growth: population needed to advance from `level` to `level+1`.
export const levelThreshold = (level: number) => level + 1;

export const START_STARS = 5;

export const MAP_SIZES: { label: string; size: number }[] = [
  { label: "Small", size: 11 },
  { label: "Medium", size: 14 },
  { label: "Large", size: 18 },
];
