import { RNG } from "./rng";
import { idx } from "./grid";
import { GameState, Tile, TribeId } from "./types";
import { START_STARS, TRIBE_BY_ID } from "./data";
import { newUnit, newCity } from "./factory";

function terrainNeighbors(x: number, y: number, w: number, h: number): number[] {
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

export function generateGame(config: {
  tribe: TribeId;
  opponents: number;
  mapSize: number;
  passAndPlay: boolean;
  seed?: number;
}): GameState {
  const seed = config.seed ?? Math.floor(Math.random() * 1e9);
  const rng = new RNG(seed);
  const w = config.mapSize;
  const h = config.mapSize;
  const n = w * h;

  // --- Terrain: cellular smoothing for water bodies ---
  let water = new Array<boolean>(n);
  for (let i = 0; i < n; i++) water[i] = rng.chance(0.32);
  for (let pass = 0; pass < 3; pass++) {
    const next = water.slice();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = idx(x, y, w);
        const nb = terrainNeighbors(x, y, w, h);
        const waterCount = nb.filter((k) => water[k]).length;
        next[i] = waterCount >= 5;
      }
    water = next;
  }

  const tiles: Tile[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = idx(x, y, w);
      let terrain: Tile["terrain"] = water[i] ? "water" : "grass";
      if (terrain === "grass") {
        const r = rng.next();
        if (r < 0.24) terrain = "forest";
        else if (r < 0.38) terrain = "mountain";
      }
      tiles.push({ id: i, x, y, terrain, resource: null, cityId: null, isVillage: false, explored: false });
    }

  // --- Resources ---
  for (const t of tiles) {
    if (t.terrain === "grass") {
      const r = rng.next();
      if (r < 0.28) t.resource = "fruit";
      else if (r < 0.4) t.resource = "crop";
    } else if (t.terrain === "forest") {
      if (rng.chance(0.5)) t.resource = "animal";
    } else if (t.terrain === "mountain") {
      if (rng.chance(0.4)) t.resource = "ore";
    } else if (t.terrain === "water") {
      const adjLand = terrainNeighbors(t.x, t.y, w, h).some((k) => tiles[k].terrain !== "water");
      if (adjLand && rng.chance(0.3)) t.resource = "fish";
    }
  }

  const landTiles = tiles.filter((t) => t.terrain !== "water");

  // --- Capitals: farthest-point spread ---
  const numPlayers = config.opponents + 1;
  const capitals: Tile[] = [];
  const firstCandidates = landTiles.filter((t) => t.x > 1 && t.y > 1 && t.x < w - 2 && t.y < h - 2);
  capitals.push(rng.pick(firstCandidates.length ? firstCandidates : landTiles));
  while (capitals.length < numPlayers) {
    let best: Tile | null = null;
    let bestDist = -1;
    for (const t of landTiles) {
      const minD = Math.min(...capitals.map((c) => Math.max(Math.abs(c.x - t.x), Math.abs(c.y - t.y))));
      if (minD > bestDist) {
        bestDist = minD;
        best = t;
      }
    }
    if (!best) break;
    capitals.push(best);
  }

  const players = [] as GameState["players"];
  const tribeOptions: TribeId[] = ["nature", "desert", "volcanic", "snow"];
  const usedTribes = new Set<TribeId>([config.tribe]);
  players.push({
    index: 0,
    tribe: config.tribe,
    name: TRIBE_BY_ID[config.tribe].name,
    isHuman: true,
    stars: START_STARS,
    techs: [TRIBE_BY_ID[config.tribe].startTech],
    eliminated: false,
  });
  for (let p = 1; p < numPlayers; p++) {
    let tribe = tribeOptions.find((t) => !usedTribes.has(t)) ?? rng.pick(tribeOptions);
    usedTribes.add(tribe);
    players.push({
      index: p,
      tribe,
      name: config.passAndPlay ? `Player ${p + 1}` : `${TRIBE_BY_ID[tribe].name} AI`,
      isHuman: config.passAndPlay,
      stars: START_STARS,
      techs: [TRIBE_BY_ID[tribe].startTech],
      eliminated: false,
    });
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

  // Place capitals: clear terrain, add city + starting warrior.
  capitals.forEach((cap, p) => {
    const tile = tiles[cap.id];
    tile.terrain = "grass";
    tile.resource = null;
    tile.isVillage = false;
    const city = newCity(p, cap.id, true);
    tile.cityId = city.id;
    state.cities.push(city);
    state.units.push(newUnit("warrior", p, cap.id));
  });

  // --- Neutral villages ---
  const villageTarget = Math.max(3, Math.round(landTiles.length * 0.06));
  const capIds = new Set(capitals.map((c) => c.id));
  const villageTiles: number[] = [];
  const shuffled = [...landTiles].sort(() => rng.next() - 0.5);
  for (const t of shuffled) {
    if (villageTiles.length >= villageTarget) break;
    if (t.terrain === "water" || t.cityId) continue;
    const tooClose = [...capIds, ...villageTiles].some((id) => {
      const o = tiles[id];
      return Math.max(Math.abs(o.x - t.x), Math.abs(o.y - t.y)) < 2;
    });
    if (tooClose) continue;
    tiles[t.id].isVillage = true;
    tiles[t.id].resource = null;
    villageTiles.push(t.id);
  }

  return state;
}
