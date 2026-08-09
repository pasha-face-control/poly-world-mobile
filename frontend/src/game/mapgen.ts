import { RNG } from "./rng";
import { idx } from "./grid";
import { GameState, MapType, TerrainType, Tile, TribeId } from "./types";
import { START_STARS, START_GOODS, TRIBE_BY_ID } from "./data";
import { newUnit, newCity } from "./factory";

function nbrs(x: number, y: number, w: number, h: number): number[] {
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      out.push(idx(nx, ny, w));
    }
  return out;
}

function smooth(water: boolean[], w: number, h: number, passes: number, thresh = 5): boolean[] {
  let cur = water;
  for (let p = 0; p < passes; p++) {
    const next = cur.slice();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = idx(x, y, w);
        const c = nbrs(x, y, w, h).filter((k) => cur[k]).length;
        next[i] = c >= thresh;
      }
    cur = next;
  }
  return cur;
}

function generateWater(rng: RNG, w: number, h: number, type: MapType): boolean[] {
  const n = w * h;
  const water = new Array<boolean>(n).fill(false);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const norm = (x: number, y: number, ox: number, oy: number) => Math.hypot((x - ox) / (w / 2), (y - oy) / (h / 2));

  if (type === "pangea") {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const d = norm(x, y, cx, cy);
        water[idx(x, y, w)] = d > 0.82 + (rng.next() - 0.5) * 0.22;
      }
    return smooth(water, w, h, 1);
  }

  if (type === "continents") {
    const k = w <= 12 ? 2 : 3;
    const centers: [number, number][] = [];
    for (let c = 0; c < k; c++) centers.push([2 + rng.int(w - 4), 2 + rng.int(h - 4)]);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dmin = Math.min(...centers.map(([ox, oy]) => norm(x, y, ox, oy)));
        water[idx(x, y, w)] = dmin > 0.5 + (rng.next() - 0.5) * 0.22;
      }
    return smooth(water, w, h, 1);
  }

  // Cellular-automata based types.
  const initProb = type === "archipelago" ? 0.56 : type === "lakes" ? 0.32 : 0.12; // dryland default
  const passes = type === "archipelago" ? 2 : 3;
  for (let i = 0; i < n; i++) water[i] = rng.chance(initProb);
  return smooth(water, w, h, passes);
}

function pickTerrain(rng: RNG, comp: { terrain: TerrainType; weight: number }[]): TerrainType {
  const r = rng.next();
  let acc = 0;
  for (const c of comp) {
    acc += c.weight;
    if (r <= acc) return c.terrain;
  }
  return comp[comp.length - 1].terrain;
}

export function generateGame(config: {
  tribe: TribeId;
  opponents: number;
  mapSize: number;
  mapType: MapType;
  passAndPlay: boolean;
  seed?: number;
}): GameState {
  const seed = config.seed ?? Math.floor(Math.random() * 1e9);
  const rng = new RNG(seed);
  const w = config.mapSize;
  const h = config.mapSize;

  const water = generateWater(rng, w, h, config.mapType);

  const tiles: Tile[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = idx(x, y, w);
      tiles.push({ id: i, x, y, terrain: water[i] ? "water" : "grass", resource: null, cityId: null, isVillage: false, explored: false });
    }

  const landTiles = tiles.filter((t) => t.terrain !== "water");
  const numPlayers = config.opponents + 1;

  // Players (human first) — each player's tribe defines its region's biome.
  const players = [] as GameState["players"];
  const tribeOptions: TribeId[] = ["nature", "desert", "volcanic", "snow"];
  const usedTribes = new Set<TribeId>([config.tribe]);
  players.push({ index: 0, tribe: config.tribe, name: TRIBE_BY_ID[config.tribe].name, isHuman: true, stars: START_STARS, goods: { ...START_GOODS }, techs: [TRIBE_BY_ID[config.tribe].startTech], eliminated: false });
  for (let p = 1; p < numPlayers; p++) {
    const tribe = tribeOptions.find((t) => !usedTribes.has(t)) ?? rng.pick(tribeOptions);
    usedTribes.add(tribe);
    players.push({ index: p, tribe, name: config.passAndPlay ? `Player ${p + 1}` : `${TRIBE_BY_ID[tribe].name} AI`, isHuman: config.passAndPlay, stars: START_STARS, goods: { ...START_GOODS }, techs: [TRIBE_BY_ID[tribe].startTech], eliminated: false });
  }

  // Region seeds (= capitals): farthest-point spread across land.
  const inner = landTiles.filter((t) => t.x > 1 && t.y > 1 && t.x < w - 2 && t.y < h - 2);
  const seeds: Tile[] = [rng.pick(inner.length ? inner : landTiles)];
  while (seeds.length < numPlayers) {
    let best: Tile | null = null;
    let bestDist = -1;
    for (const t of landTiles) {
      const minD = Math.min(...seeds.map((s) => Math.max(Math.abs(s.x - t.x), Math.abs(s.y - t.y))));
      if (minD > bestDist) {
        bestDist = minD;
        best = t;
      }
    }
    if (!best) break;
    seeds.push(best);
  }

  // Assign each land tile to nearest seed's region, then sample terrain from that tribe's composition.
  for (const t of landTiles) {
    let region = 0;
    let bestD = Infinity;
    for (let s = 0; s < seeds.length; s++) {
      const d = Math.max(Math.abs(seeds[s].x - t.x), Math.abs(seeds[s].y - t.y));
      if (d < bestD) {
        bestD = d;
        region = s;
      }
    }
    const comp = TRIBE_BY_ID[players[region].tribe].landComposition;
    tiles[t.id].terrain = pickTerrain(rng, comp);
  }

  // Resources.
  for (const t of tiles) {
    if (t.terrain === "grass") {
      const r = rng.next();
      if (r < 0.28) t.resource = "fruit";
      else if (r < 0.4) t.resource = "crop"; // farmland (only grass can be farmed)
    } else if (t.terrain === "forest") {
      if (rng.chance(0.25)) t.resource = "animal";
    } else if (t.terrain === "mountain") {
      if (rng.chance(0.4)) t.resource = "ore";
    } else if (t.terrain === "water") {
      const adjLand = nbrs(t.x, t.y, w, h).some((k) => tiles[k].terrain !== "water");
      if (adjLand && rng.chance(0.3)) t.resource = "fish";
    }
    // sand: intentionally barren (cannot be farmed).
  }

  const state: GameState = {
    id: `game_${seed}`,
    width: w,
    height: h,
    tiles,
    units: [],
    cities: [],
    players,
    currentPlayer: 0,
    turn: 1,
    seed,
    status: "playing",
    log: [],
    createdAt: new Date().toISOString(),
  };

  // Capitals at seeds (cleared to grass) + starting warrior.
  seeds.forEach((cap, p) => {
    const tile = tiles[cap.id];
    tile.terrain = "grass";
    tile.resource = null;
    tile.isVillage = false;
    const city = newCity(p, cap.id, true);
    tile.cityId = city.id;
    state.cities.push(city);
    state.units.push(newUnit("warrior", p, cap.id));
  });

  // Neutral villages.
  const villageTarget = Math.max(3, Math.round(landTiles.length * 0.06));
  const capIds = new Set(seeds.map((c) => c.id));
  const placed: number[] = [];
  const shuffled = [...landTiles].sort(() => rng.next() - 0.5);
  for (const t of shuffled) {
    if (placed.length >= villageTarget) break;
    if (tiles[t.id].terrain === "water" || tiles[t.id].cityId) continue;
    const tooClose = [...capIds, ...placed].some((id) => {
      const o = tiles[id];
      return Math.max(Math.abs(o.x - t.x), Math.abs(o.y - t.y)) < 2;
    });
    if (tooClose) continue;
    tiles[t.id].isVillage = true;
    tiles[t.id].resource = null;
    placed.push(t.id);
  }

  return state;
}
