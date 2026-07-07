import { UNIT_DEFS } from "./data";
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

function canEnterTerrain(state: GameState, player: number, tile: Tile): boolean {
  if (tile.terrain === "water") return playerHasTech(state, player, "sailing");
  if (tile.terrain === "mountain") return playerHasTech(state, player, "climbing");
  return true;
}

// Reachable movement tiles for a unit (excludes its own tile & occupied tiles).
export function reachableTiles(state: GameState, unit: Unit): number[] {
  const def = UNIT_DEFS[unit.type];
  const dist: Record<number, number> = { [unit.tileId]: 0 };
  const queue: number[] = [unit.tileId];
  const result: number[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    if (dist[cur] >= def.move) continue;
    for (const n of neighbors(state, cur)) {
      const tile = state.tiles[n];
      if (!canEnterTerrain(state, unit.owner, tile)) continue;
      if (unitAt(state, n)) continue; // blocked by any unit
      const nd = dist[cur] + 1;
      if (dist[n] === undefined || nd < dist[n]) {
        dist[n] = nd;
        result.push(n);
        // Entering rough terrain ends movement (Polytopia-style).
        if (tile.terrain !== "forest" && tile.terrain !== "mountain") queue.push(n);
      }
    }
  }
  return Array.from(new Set(result));
}

// Enemy-occupied tiles this unit can attack.
export function attackableTiles(state: GameState, unit: Unit): number[] {
  if (unit.attacked) return [];
  const def = UNIT_DEFS[unit.type];
  const from = state.tiles[unit.tileId];
  const out: number[] = [];
  for (const other of state.units) {
    if (other.owner === unit.owner) continue;
    const tt = state.tiles[other.tileId];
    if (chebyshev(from, tt) <= def.range) out.push(other.tileId);
  }
  return out;
}
