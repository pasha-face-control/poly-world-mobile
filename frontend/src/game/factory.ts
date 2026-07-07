import { UNIT_DEFS } from "./data";
import { City, Unit, UnitType } from "./types";

let counter = 0;
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;

export function newUnit(type: UnitType, owner: number, tileId: number): Unit {
  const def = UNIT_DEFS[type];
  return {
    id: uid("u"),
    type,
    owner,
    tileId,
    hp: def.hp,
    maxHp: def.hp,
    moved: false,
    attacked: false,
  };
}

export function newCity(owner: number, tileId: number, isCapital: boolean): City {
  return {
    id: uid("c"),
    owner,
    tileId,
    level: 1,
    population: 0,
    production: 1,
    hasWall: isCapital,
    isCapital,
  };
}
