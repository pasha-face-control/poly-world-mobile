import { UNIT_DEFS } from "./data";
import { City, Unit, UnitType } from "./types";

let counter = 0;
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;

// Pool of settlement names; each new city gets a random unused one (session-scoped).
const CITY_NAMES = [
  "Aveloria", "Brindale", "Caergwyn", "Dornhaven", "Emberfall", "Frostmere", "Galdris", "Havenwood",
  "Ironmoor", "Jolvik", "Kaldrun", "Larkspire", "Mistvale", "Norwick", "Oakenford", "Pelagorn",
  "Quenby", "Ravenholm", "Silverkeep", "Thornwall", "Umberholt", "Vaelport", "Wyndmere", "Xanthe",
  "Yorwick", "Zephyra", "Ashcombe", "Belhaven", "Coldwater", "Drakemount", "Elderglen", "Fenwick",
  "Greymoor", "Highford", "Amberlyn", "Blackrush", "Cindermaw", "Duskhollow", "Everreach", "Foxglade",
  "Goldbarrow", "Hollowmere", "Ironfen", "Karrowdeep", "Lonewatch", "Marrowvale", "Nightbrook", "Oldstone",
  "Pinehollow", "Redcliff", "Stormgate", "Tidewhisper", "Ullswater", "Vaultspire", "Whitethorn", "Yellowmire",
];
const usedNames = new Set<string>();

export function randomCityName(): string {
  const free = CITY_NAMES.filter((n) => !usedNames.has(n));
  if (free.length === 0) return `Settlement ${usedNames.size + 1}`;
  const name = free[Math.floor(Math.random() * free.length)];
  usedNames.add(name);
  return name;
}

export function newUnit(type: UnitType, owner: number, tileId: number): Unit {
  const def = UNIT_DEFS[type];
  const u: Unit = {
    id: uid("u"),
    type,
    owner,
    tileId,
    hp: def.hp,
    maxHp: def.hp,
    moved: false,
    attacked: false,
    boat: null,
  };
  if (type === "merchant") {
    u.cargo = Array.from({ length: 4 }, () => ({ good: null, qty: 0, price: 3 }));
  }
  return u;
}

export function newCity(owner: number, tileId: number, isCapital: boolean): City {
  return {
    id: uid("c"),
    name: randomCityName(),
    owner,
    tileId,
    level: 1,
    population: 0,
    production: 1,
    hasWall: isCapital,
    isCapital,
    citadelStage: 1,
    layout: { buildings: [], roads: [] },
  };
}
