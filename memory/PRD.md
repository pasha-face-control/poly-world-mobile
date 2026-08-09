# HexTribes — Polytopia-style 4X (Expo/React Native)

## Original Problem
Build a game similar to The Battle of Polytopia. Client-side, local persistence.

## Architecture
- Pure client-side game. Engine in `/app/frontend/src/game/` (types, data, rng, grid, combat, mapgen, factory, engine, ai, store). UI in `/app/frontend/src/components/`. Screens in `/app/frontend/app/`.
- 2.5D isometric SVG map (diamond tiles, pyramid mountains, 3D unit pawns/city houses/bulls), 4-angle rotation, pan/zoom.

## Implemented (latest)
- **Goods economy**: players hold wood/iron/wheat/meat/horses (shown as a second top-bar row). Unit training now requires goods per the table (archer 1 meat; beefeater 8 meat; catapult 8 wood; armored rider 2 wheat/2 iron/1 horse; knight 5 wheat/4 iron/1 horse; pikeman 2 meat/2 iron; swordsman 2 meat/3 iron). City panel chips show goods costs (red when short). Players start with a small stockpile until production buildings exist.
- Tribes: Lesnoi, Freemen, He-he, Fishmen (Fishmen icon = fish), each with a land-composition biome.
- World-gen: map divided into one biome region per tribe (Voronoi); map types Continents/Pangea/Lakes/Dryland/Archipelago; `sand` terrain (barren, unfarmable).
- **Tech tree redesign (instruction.docx):** ~29 techs in a branching radial graph UI (forest_exploration / organisation / climbing / fishing roots and their branches). Nodes show researched/available/locked + cost.
- **New units** (trainable via tech, stars-only cost for now): warrior, archer(hunting), beefeater(beef_eating), catapult(mathematics), rider(riding), armored_rider(armor_production), knight(chivalry), pikeman(pike), swordsman(sword_art). Stats per doc.
- City panel opens even when a unit occupies it (city takes tap priority; use Next to pick units).

## PHASED / NOT YET BUILT (from instruction.docx — large systems)
- Goods PRODUCTION: buildings that generate wood/iron/wheat/meat/horses each turn (goods are spent already; production is next).
- Buildings: Lumber Hut, Windmill, Forge, Coal/Iron/Gold Mines, Wheat/Bull/Horse Farms, Temple; tap-cell-to-build flow; per-turn production; 80% of grass = farmable land.
- Roads (build + movement bonus), burn-forest-to-farmland.
- Naval: Rowing Boat (auto-convert on port), Sailing Boat upgrade, Battleship; ports & trade ports.
- Merchant & Merchant Ship trading: 4/8 inventory slots, load goods, set prices, trade sign for other players; bots buy-only, can't attack merchants.
- Ore-site research (coal/iron/gold) revealing mine sites.

## Backlog / Next
- Build the goods economy + resource top-bar (foundation for buildings, unit costs, trading).
- Then buildings & per-turn production, then naval + upgrades, then merchant trading UI.
