import { unitStats } from "./data";
import { GameState, Tile, Unit } from "./types";

export const idx = (x: number, y: number, w: number) => y * w + x;

export function neighbors(state: GameState, tileId: number): number[] {
  const { width, height } = state;
  const t = state.tiles[tileId];
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = t.x + dx;
      const ny = t.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      out.push(idx(nx, ny, width));
    }
  }
  return out;
}

export function chebyshev(a: Tile, b: Tile): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function unitAt(state: GameState, tileId: number): Unit | undefined {
  return state.units.find((u) => u.tileId === tileId);
}

export function playerHasTech(state: GameState, player: number, tech: string): boolean {
  return state.players[player].techs.includes(tech);
}

// Which terrain a unit can step onto. Land units can't enter water (embark at a
// port instead); embarked boats travel on water and may step onto land (disembark).
function canEnter(state: GameState, unit: Unit, tile: Tile): boolean {
  if (unit.boat) {
    if (tile.terrain === "mountain") return false; // can't sail up a mountain
    return true; // water = sail, land = disembark
  }
  // Land units may only step onto water tiles that hold a port (to embark there).
  if (tile.terrain === "water") return tile.port;
  if (tile.terrain === "mountain") return playerHasTech(state, unit.owner, "climbing");
  return true;
}

// Reachable movement tiles for a unit (excludes its own tile & occupied tiles).
// Roads let a unit chain along connected road tiles for free.
export function reachableTiles(state: GameState, unit: Unit, ignoreRoadBonus = false): number[] {
  let move = unitStats(unit).move;
  const start = unit.tileId;
  // Standing on a road doubles a land unit's movement range this turn.
  if (!ignoreRoadBonus && !unit.boat && state.tiles[start].road) move *= 2;
  const cost: Record<number, number> = { [start]: 0 };
  const queue: number[] = [start];
  const result: number[] = [];
  while (queue.length) {
    queue.sort((a, b) => cost[a] - cost[b]);
    const cur = queue.shift()!;
    if (cost[cur] >= move) continue;
    for (const n of neighbors(state, cur)) {
      const tile = state.tiles[n];
      if (!canEnter(state, unit, tile)) continue;
      if (unitAt(state, n)) continue; // blocked by any unit
      const nd = cost[cur] + 1;
      if (nd > move) continue;
      if (cost[n] === undefined || nd < cost[n]) {
        cost[n] = nd;
        if (!result.includes(n)) result.push(n);
        // Entering rough terrain ends movement unless a road carries the unit through.
        const rough = tile.terrain === "forest" || tile.terrain === "mountain";
        if (!rough || tile.road) queue.push(n);
      }
    }
  }
  return Array.from(new Set(result));
}

// Enemy-occupied tiles this unit can attack. Merchants are peaceful (never fight).
export function attackableTiles(state: GameState, unit: Unit): number[] {
  if (unit.attacked) return [];
  const stats = unitStats(unit);
  if (stats.range < 1) return [];
  const from = state.tiles[unit.tileId];
  const out: number[] = [];
  for (const other of state.units) {
    if (other.owner === unit.owner) continue;
    if (other.type === "merchant") continue; // merchants can't be attacked
    const tt = state.tiles[other.tileId];
    if (chebyshev(from, tt) <= stats.range) out.push(other.tileId);
  }
  return out;
}
