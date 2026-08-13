import { unitStats } from "./data";
import { City, GameState, Tile, Unit } from "./types";

export interface CombatResult {
  attackerDamage: number; // dealt to defender
  defenderDamage: number; // retaliation to attacker (melee only)
  defenderDied: boolean;
  attackerDied: boolean;
}

// Defensive multiplier applied to a defender's DEF, based on terrain and (for cities)
// the defender's unit class. Knights are the dedicated defensive unit.
export function defenseBonus(state: GameState, tile: Tile, defender: Unit, city?: City): number {
  const isDefensive = defender.type === "chivalry"; // Knight
  if (city) {
    if (isDefensive) return city.hasWall ? 4 : 2;
    return city.hasWall ? 2 : 1;
  }
  if (tile.terrain === "forest") {
    return state.players[defender.owner].techs.includes("forest_care") ? 1.5 : 1;
  }
  if (tile.terrain === "mountain") return 1.25;
  return 1;
}

export function resolveCombat(state: GameState, attacker: Unit, defender: Unit): CombatResult {
  const aDef = unitStats(attacker);
  const dDef = unitStats(defender);
  const tile = state.tiles[defender.tileId];
  const city = tile.cityId ? state.cities.find((c) => c.id === tile.cityId) : undefined;
  const ownCity = city && city.owner === defender.owner ? city : undefined;
  const bonus = defenseBonus(state, tile, defender, ownCity);

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
