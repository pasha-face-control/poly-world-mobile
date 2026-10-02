import { TECH_BY_ID } from "./data";
import { neighbors } from "./engine";
import { City, GameState } from "./types";

// Points awarded per tech, by the tech's tier (1 = cheapest first-level techs .. 5 = deepest).
const TECH_TIER_POINTS: Record<number, number> = { 1: 15, 2: 25, 3: 50, 4: 100, 5: 200 };

// Map scoring
const PTS_PER_EXPLORED = 5;
const PTS_PORT = 10;
const PTS_FARM = 10;
const PTS_GOLD_MINE = 25;
const PTS_TERRITORY_CELL = 150;
const PTS_CITY_LEVEL = 100; // per level gained beyond the starting level (1)

function territoryTiles(state: GameState, city: City): number[] {
  return [city.tileId, ...neighbors(state, city.tileId), ...(city.expandedTiles ?? [])];
}

// The set of cells a player is credited with having "explored".
// Closed games track this per player (seenBy); the human (0) uses cumulative fog; open-game
// bots (omniscient in the engine) are approximated by their known footprint so they aren't
// gifted the entire map on the leaderboard.
function exploredSet(state: GameState, p: number): Set<number> {
  const s = new Set<number>();
  if (state.closed) {
    for (const t of state.tiles) if (t.seenBy?.includes(p)) s.add(t.id);
    return s;
  }
  if (p === 0) {
    for (const t of state.tiles) if (t.explored) s.add(t.id);
    return s;
  }
  for (const c of state.cities) {
    if (c.owner !== p) continue;
    for (const tid of territoryTiles(state, c)) s.add(tid);
    s.add(c.tileId);
    for (const n of neighbors(state, c.tileId)) s.add(n);
  }
  for (const u of state.units) {
    if (u.owner !== p) continue;
    s.add(u.tileId);
    for (const n of neighbors(state, u.tileId)) s.add(n);
  }
  return s;
}

export interface PointsBreakdown {
  explored: number;
  buildings: number;
  territory: number;
  cityLevels: number;
  tech: number;
  temples: number;
  total: number;
}

export function playerPointsBreakdown(state: GameState, p: number): PointsBreakdown {
  const explored = exploredSet(state, p).size * PTS_PER_EXPLORED;

  const terr = new Set<number>();
  let cityLevels = 0;
  for (const c of state.cities) {
    if (c.owner !== p) continue;
    for (const tid of territoryTiles(state, c)) terr.add(tid);
    cityLevels += PTS_CITY_LEVEL * Math.max(0, c.level - 1);
  }
  const territory = terr.size * PTS_TERRITORY_CELL;

  let buildings = 0;
  for (const tid of terr) {
    const t = state.tiles[tid];
    if (!t) continue;
    if (t.port) buildings += PTS_PORT;
    if (t.tradePort) buildings += PTS_PORT;
    if (t.building) {
      if (t.building.endsWith("_farm")) buildings += PTS_FARM;
      else if (t.building === "gold_mine") buildings += PTS_GOLD_MINE;
    }
  }

  let tech = 0;
  for (const tk of state.players[p].techs) {
    const def = TECH_BY_ID[tk];
    if (def) tech += TECH_TIER_POINTS[def.tier] ?? 0;
  }

  // Ongoing temple bonus accumulated over the game (+100/turn per temple).
  const temples = state.players[p].templePoints ?? 0;

  return { explored, buildings, territory, cityLevels, tech, temples, total: explored + buildings + territory + cityLevels + tech + temples };
}

export function playerPoints(state: GameState, p: number): number {
  return playerPointsBreakdown(state, p).total;
}

export interface LbRow {
  player: number;
  name: string;
  color: string;
  eliminated: boolean;
  value: number;
}

export type LbKind = "points" | "cities" | "cityLevel";

import { TRIBE_BY_ID } from "./data";

export function computeLeaderboards(state: GameState): Record<LbKind, LbRow[]> {
  const base = state.players.map((pl) => {
    const owned = state.cities.filter((c) => c.owner === pl.index);
    return {
      player: pl.index,
      name: pl.name,
      color: TRIBE_BY_ID[pl.tribe].color,
      eliminated: pl.eliminated,
      points: playerPoints(state, pl.index),
      cities: owned.length,
      // Highest individual city level (not the sum of all cities' levels).
      cityLevel: owned.reduce((a, c) => Math.max(a, c.level), 0),
    };
  });
  const rank = (key: "points" | "cities" | "cityLevel"): LbRow[] =>
    base
      .map((r) => ({ player: r.player, name: r.name, color: r.color, eliminated: r.eliminated, value: r[key] }))
      .sort((a, b) => b.value - a.value);
  return { points: rank("points"), cities: rank("cities"), cityLevel: rank("cityLevel") };
}
