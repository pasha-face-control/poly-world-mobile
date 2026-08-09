# HexTribes — Polytopia-style 4X (Expo/React Native)

## Original Problem
Build a game similar to The Battle of Polytopia. Client-side, local persistence.

## Architecture
- Pure client-side game. Engine in `/app/frontend/src/game/` (types, data, rng, grid, combat, mapgen, factory, engine, ai, store). UI in `/app/frontend/src/components/`. Screens in `/app/frontend/app/`.
- 2.5D isometric SVG map (diamond tiles, pyramid mountains, 3D unit pawns/city houses/bulls), 4-angle rotation, pan/zoom.

## Implemented (latest)
- **Naval & Ports (manual embark)**: build a **Port** on a coastal water tile bordering your territory (needs Sailing). Land units may step onto a port tile and press **Embark** to become a **Rowing Boat**; boats sail on water and disembark automatically when they land. Boats upgrade Rowing → **Sailing Boat** (5★) → **Battleship** (15★, needs Expedition) with rising atk/def/move/range. Land units can't cross open water. Boats/docks render in the isometric SVG map.
- **Roads & Clear-Forest**: build **Roads** (needs Roads tech) on land — units chain along connected roads for free (fast travel); roads render as brown segments linking adjacent road tiles. **Clear Forest** (needs Construction) burns a forest tile into farmable grassland (adds a crop).
- **Merchants & Trading**: train a **Merchant** (needs Trading; **Merchant Ship** = embarked merchant, 8 slots vs 4 on land). Open its **Trade** panel to load goods from your stockpile, set a per-unit price (1–20★). Each round rival (bot) tribes buy your cargo — you earn the price in stars; bots are buy-only and merchants can't be attacked.
- **Buildings & production**: tap a cell in your territory to build production structures that yield goods/stars each turn — Lumber Hut, Wheat/Bull/Horse Farm, Iron/Gold Mine. Production credited at turn start; AI also builds. Buildings show as markers on the map.
- **Goods economy**: players hold wood/iron/wheat/meat/horses (second top-bar row). Unit training requires goods per the table; city chips show goods costs (red when short).
- Tribes: Lesnoi, Freemen, He-he, Fishmen; biome-specific procedural world-gen (Voronoi regions); map types Continents/Pangea/Lakes/Dryland/Archipelago.
- Branching radial tech tree (~29 techs). Units: warrior/archer/beefeater/catapult/rider/armored_rider/knight/pikeman/swordsman/merchant + naval tiers.
- City panel opens even when a unit occupies it.

## Engine verification
- `frontend/scripts/engine_test.js` — 20 headless assertions pass (merchant train/load/price/trade, road build, burn-forest, port build, embark, boat upgrades & stats, water blocking, road reachability). Run: `node scripts/engine_test.js`.

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
