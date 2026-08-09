import { unitStats } from "./data";
import { City, GameState, Tile, Unit } from "./types";

export interface CombatResult {
  attackerDamage: number; // dealt to defender
  defenderDamage: number; // retaliation to attacker (melee only)
  defenderDied: boolean;
  attackerDied: boolean;
}

export function defenseBonus(state: GameState, tile: Tile, city?: City): number {
  if (city) return city.hasWall ? 4 : 1.5;
  if (tile.terrain === "forest" || tile.terrain === "mountain") return 1.5;
  return 1;
}

export function resolveCombat(state: GameState, attacker: Unit, defender: Unit): CombatResult {
  const aDef = unitStats(attacker);
  const dDef = unitStats(defender);
  const tile = state.tiles[defender.tileId];
  const city = tile.cityId ? state.cities.find((c) => c.id === tile.cityId) : undefined;
  const bonus = defenseBonus(state, tile, city && city.owner === defender.owner ? city : undefined);

  const atkForce = aDef.atk * (attacker.hp / attacker.maxHp);
  const defForce = dDef.def * (defender.hp / defender.maxHp) * bonus;
  const total = atkForce + defForce || 1;

  const attackerDamage = Math.max(1, Math.round((atkForce / total) * aDef.atk * 4.5));
  const defenderDamage = Math.max(1, Math.round((defForce / total) * dDef.def * 4.5));

  const remainingDef = defender.hp - attackerDamage;
  const defenderDied = remainingDef <= 0;
  let attackerDied = false;

  // Melee attackers take retaliation only if defender survives.
  const isMelee = aDef.range === 1;
  const takesRetaliation = isMelee && !defenderDied;

  return {
    attackerDamage,
    defenderDamage: takesRetaliation ? defenderDamage : 0,
    defenderDied,
    attackerDied: takesRetaliation ? attacker.hp - defenderDamage <= 0 : false,
  };
}
