# HexTribes — Polytopia-style 4X (Expo/React Native)

## Original Problem
Build a game similar to The Battle of Polytopia. Client-side, local persistence.

## Architecture
- Pure client-side game. Engine in `/app/frontend/src/game/` (types, data, rng, grid, combat, mapgen, factory, engine, ai, store). UI in `/app/frontend/src/components/`. Screens in `/app/frontend/app/`.
- 2.5D isometric SVG map (diamond tiles, pyramid mountains, 3D unit pawns/city houses/bulls), 4-angle rotation, pan/zoom.

## Implemented (latest)
- **Buildings & production**: tap a cell in your territory to build production structures that yield goods/stars each turn — Lumber Hut (forest → +2 wood), Wheat Farm (grass → +2 wheat), Bull Farm (grass → +2 meat), Horse Farm (grass → +1 horse), Iron Mine (mountain → +2 iron), Gold Mine (mountain → +5 stars). Each requires its tech, costs stars, one per tile, must be in a city's territory. Production is credited at the start of each turn; AI also builds. Buildings show as markers on the map.
- **Goods economy**: players hold wood/iron/wheat/meat/horses (second top-bar row). Unit training requires goods per the table; city chips show goods costs (red when short).
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
