export type TerrainType = "water" | "grass" | "forest" | "mountain" | "sand";
export type ResourceType = "fruit" | "animal" | "fish" | "ore" | "crop" | null;
export type UnitType = "warrior" | "archer" | "beefeater" | "catapult" | "rider" | "armored_rider" | "chivalry" | "pikemen" | "swordsmen" | "merchant";
export type TribeId = "nature" | "desert" | "volcanic" | "snow";
export type MapType = "dryland" | "lakes" | "pangea" | "continents" | "archipelago";
export type GoodType = "wood" | "iron" | "wheat" | "meat" | "horse";
export type NavalTier = "rowing" | "sailing" | "battleship";

export interface Tile {
  id: number;
  x: number;
  y: number;
  terrain: TerrainType;
  resource: ResourceType;
  cityId: string | null;
  isVillage: boolean; // neutral, uncaptured
  explored: boolean; // human fog of war
  building: string | null; // building def id
  road: boolean; // road infrastructure
  port: boolean; // dock built on a water tile
}

export interface Unit {
  id: string;
  type: UnitType;
  owner: number;
  tileId: number;
  hp: number;
  maxHp: number;
  moved: boolean;
  attacked: boolean;
  boat: NavalTier | null; // set when embarked onto water; null on land
  cargo?: Record<GoodType, number>; // merchant inventory
  price?: number; // merchant asking price (stars per good unit)
}

export interface City {
  id: string;
  owner: number;
  tileId: number;
  level: number;
  population: number;
  production: number;
  hasWall: boolean;
  isCapital: boolean;
}

export interface Player {
  index: number;
  tribe: TribeId;
  name: string;
  isHuman: boolean;
  stars: number;
  goods: Record<GoodType, number>;
  techs: string[];
  eliminated: boolean;
}

export interface GameState {
  id: string;
  width: number;
  height: number;
  tiles: Tile[];
  units: Unit[];
  cities: City[];
  players: Player[];
  currentPlayer: number;
  turn: number;
  seed: number;
  status: "playing" | "won" | "lost";
  log: string[];
  createdAt: string;
}

export interface NewGameConfig {
  tribe: TribeId;
  opponents: number; // 1..3
  mapSize: number; // width==height
  mapType: MapType;
  passAndPlay: boolean;
}
