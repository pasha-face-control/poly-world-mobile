import { RNG } from "./rng";
import { idx } from "./grid";
import { Difficulty, GameState, MapType, TerrainType, Tile, TribeId } from "./types";
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

// Max mountains allowed per 3x3 chunk for each tribe's landscape.
const MOUNTAIN_CAP: Record<TribeId, number> = { nature: 1, desert: 2, volcanic: 3, snow: 1 };

// The terrain a demoted (excess) mountain becomes — the tribe's dominant non-mountain terrain.
function fallbackTerrain(tribe: TribeId): TerrainType {
  const comp = TRIBE_BY_ID[tribe].landComposition.filter((c) => c.terrain !== "mountain");
  if (!comp.length) return "grass";
  return comp.reduce((a, b) => (b.weight > a.weight ? b : a)).terrain;
}

export function generateGame(config: {
  tribe: TribeId;
  opponents: number;
  mapSize: number;
  mapType: MapType;
  passAndPlay: boolean;
  difficulty?: Difficulty;
  seed?: number;
  tribes?: TribeId[];
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
      tiles.push({ id: i, x, y, terrain: water[i] ? "water" : "grass", resource: null, cityId: null, isVillage: false, explored: false, building: null, road: false, port: false });
    }

  const landTiles = tiles.filter((t) => t.terrain !== "water");
  const numPlayers = config.tribes?.length ?? config.opponents + 1;

  // Players (human first) — each player's tribe defines its region's biome.
  // In pass & play the tribes are chosen explicitly, one per human player.
  const players = [] as GameState["players"];
  const tribeOptions: TribeId[] = ["nature", "desert", "volcanic", "snow"];
  const usedTribes = new Set<TribeId>();
  for (let p = 0; p < numPlayers; p++) {
    let tribe: TribeId;
    if (config.tribes) tribe = config.tribes[p];
    else if (p === 0) tribe = config.tribe;
    else tribe = tribeOptions.find((t) => !usedTribes.has(t)) ?? rng.pick(tribeOptions);
    usedTribes.add(tribe);
    const isHuman = p === 0 ? true : !!config.passAndPlay;
    const name = config.passAndPlay ? `Player ${p + 1}` : p === 0 ? TRIBE_BY_ID[tribe].name : `${TRIBE_BY_ID[tribe].name} AI`;
    players.push({ index: p, tribe, name, isHuman, stars: START_STARS, goods: { ...START_GOODS }, techs: [TRIBE_BY_ID[tribe].startTech], eliminated: false });
  }

  // Region seeds (= capitals): farthest-point spread across land.
  // Capitals must have at least 5 land cells around them (out of 8 neighbours).
  const landNbrCount = (t: Tile) => nbrs(t.x, t.y, w, h).filter((k) => !water[k]).length;
  const inner = landTiles.filter((t) => t.x > 1 && t.y > 1 && t.x < w - 2 && t.y < h - 2);
  const valid = landTiles.filter((t) => landNbrCount(t) >= 5);
  const innerValid = inner.filter((t) => landNbrCount(t) >= 5);
  // Prefer well-surrounded tiles; gracefully relax on very fragmented maps.
  const pool = valid.length >= numPlayers ? valid : landTiles;
  const firstPool = innerValid.length ? innerValid : valid.length ? valid : inner.length ? inner : landTiles;
  const seeds: Tile[] = [rng.pick(firstPool)];
  while (seeds.length < numPlayers) {
    let best: Tile | null = null;
    let bestDist = -1;
    for (const t of pool) {
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
  const regionOf = new Array<number>(tiles.length).fill(-1);
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
    regionOf[t.id] = region;
    const comp = TRIBE_BY_ID[players[region].tribe].landComposition;
    tiles[t.id].terrain = pickTerrain(rng, comp);
  }

  // Enforce per-tribe mountain density: scan the map in non-overlapping 3x3 chunks and
  // demote surplus mountains to the controlling tribe's dominant non-mountain terrain.
  for (let by = 0; by < h; by += 3) {
    for (let bx = 0; bx < w; bx += 3) {
      const mtns: number[] = [];
      const tribeVotes: Record<number, number> = {};
      for (let dy = 0; dy < 3 && by + dy < h; dy++) {
        for (let dx = 0; dx < 3 && bx + dx < w; dx++) {
          const id = idx(bx + dx, by + dy, w);
          const region = regionOf[id];
          if (region < 0) continue; // water
          tribeVotes[region] = (tribeVotes[region] ?? 0) + 1;
          if (tiles[id].terrain === "mountain") mtns.push(id);
        }
      }
      if (mtns.length === 0) continue;
      // Dominant region (tribe) governing this chunk.
      let domRegion = 0;
      let domVotes = -1;
      for (const [r, v] of Object.entries(tribeVotes)) {
        if (v > domVotes) {
          domVotes = v;
          domRegion = Number(r);
        }
      }
      const tribe = players[domRegion].tribe;
      const cap = MOUNTAIN_CAP[tribe] ?? 2;
      if (mtns.length <= cap) continue;
      // Keep `cap` mountains (shuffled), demote the rest.
      mtns.sort(() => rng.next() - 0.5);
      for (let m = cap; m < mtns.length; m++) tiles[mtns[m]].terrain = fallbackTerrain(tribe);
    }
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
      // Ore distribution: 40% coal, 30% iron, 10% gold, 20% barren (no mine).
      const r = rng.next();
      if (r < 0.4) t.resource = "coal";
      else if (r < 0.7) t.resource = "iron_ore";
      else if (r < 0.8) t.resource = "gold";
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
    pendingLevelUps: [],
    difficulty: config.difficulty ?? "normal",
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
    if (tiles[t.id].terrain === "water" || tiles[t.id].terrain === "mountain" || tiles[t.id].cityId) continue;
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
