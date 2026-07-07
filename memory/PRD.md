# HexTribes — Low-Poly 4X Turn-Based Strategy (Polytopia-like)

## Original Problem Statement
Build a game very similar to The Battle of Polytopia (2016 4X turn-based strategy by Midjiwan AB).

## User Choices
- Modes: Single-player vs AI **and** local pass-and-play.
- Mechanics: Full — tile map, cities, unit movement, combat, capturing cities, tech tree, resource/stars economy, multiple tribes with unique bonuses.
- Maps: Procedurally generated, player-selectable size.
- Style: Clean low-poly / minimalist tribal look.
- Persistence: Local only (save/resume + stats).

## Architecture
- **Client-side game** (Expo React Native, expo-router). No backend used.
- Game engine in `/app/frontend/src/game/`: `types`, `data` (tribes/techs/units/terrain/resources), `rng`, `grid` (8-neighbor, reachable/attack), `combat` (Polytopia-style force formula), `mapgen` (cellular water + farthest-point capitals + villages), `factory`, `engine` (actions, economy, visibility, turn flow, victory), `ai`, `store.tsx` (React context + local persistence via `@/src/utils/storage`).
- UI components in `/app/frontend/src/components/`: `GameMap` (gesture pan/zoom board, tiles, tokens, move/attack overlays, fog), `TopHUD` (glass pill), `BottomBar`, `TechTreeModal`, `CityPanel`, `UnitPanel`, `Button`.
- Screens in `/app/frontend/app/`: `index` (menu), `setup`, `game`, `stats`, `how-to-play`.
- Design system from `design_guidelines.json` (Tactile/Playful LIGHT), theme in `src/theme.ts`.

## Implemented (2026-07-07)
- Main menu with Continue/New Game/Stats/How-to-Play + auto-save detection.
- New Game setup: 4 tribes (Verdi/Sunja/Emberon/Frostael) with starting-tech bonuses, 1–3 opponents, 3 map sizes (11/14/18), vs-AI or Pass&Play toggle.
- Procedural map (water/grass/forest/mountain + resources fruit/animal/fish/ore/crop), fog of war (vs-AI).
- Units: Warrior, Rider (Riding), Archer (Archery, ranged 2), Swordsman (Smithery). Movement (rough-terrain stop), melee retaliation + move-in, ranged no-retaliation.
- Cities: population growth via harvesting, level-up (production + wall/stars reward), star income per turn, capturing enemy cities & founding on neutral villages.
- Tech tree: 10 techs across 2 tiers with dependencies, empire-scaled cost.
- AI opponent (research/harvest/train/move/attack toward objectives) + Pass&Play.
- Domination victory/defeat, stats tracking, save/resume — all verified by testing agent (13/13 flows pass).

## Backlog
- P1: Level-up reward **choice** modal (Polytopia signature); per-tile move animations; unit veteran/heal; more tribes & unique units.
- P1: Per-player fog in pass-and-play; camera "double-tap to zoom".
- P2: More techs (Sailing boats visuals/ports, roads/trade), tribe-specific terrain bias, sound/music, score-based time-limit victory, difficulty levels.
- P2: Per-tile testIDs for deterministic automated testing.

## Next Tasks
- Add level-up reward selection modal and move animations for extra polish.
