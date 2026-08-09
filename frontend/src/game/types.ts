export type TerrainType = "water" | "grass" | "forest" | "mountain" | "sand";
export type ResourceType = "fruit" | "animal" | "fish" | "ore" | "crop" | null;
export type UnitType = "warrior" | "archer" | "beefeater" | "catapult" | "rider" | "armored_rider" | "chivalry" | "pikemen" | "swordsmen";
export type TribeId = "nature" | "desert" | "volcanic" | "snow";
export type MapType = "dryland" | "lakes" | "pangea" | "continents" | "archipelago";

export interface Tile {
  id: number;
  x: number;
  y: number;
  terrain: TerrainType;
  resource: ResourceType;
  cityId: string | null;
  isVillage: boolean; // neutral, uncaptured
  explored: boolean; // human fog of war
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
