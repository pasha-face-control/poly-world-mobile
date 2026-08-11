# HexTribes — Polytopia-style 4X (Expo/React Native)

## Original Problem
Build a game similar to The Battle of Polytopia. Client-side, local persistence.

## Architecture
- Pure client-side game. Engine in `/app/frontend/src/game/` (types, data, rng, grid, combat, mapgen, factory, engine, ai, store). UI in `/app/frontend/src/components/`. Screens in `/app/frontend/app/`.
- 2.5D isometric SVG map (diamond tiles, pyramid mountains, 3D unit pawns/city houses/bulls), 4-angle rotation, pan/zoom.

## Implemented (latest)
- **Difficulty**: Setup selector — Peaceful / Easy / Normal / Hard. Peaceful bots prioritise trading and only fight defensively (attack when a player unit is adjacent/in range); Easy is timid; Normal balanced; Hard aggressive with bonus star income. Difficulty is stored on game state and drives `ai.ts`.
- **Trade-line tech pricing**: base costs set to Roads = 2, Construction = 5, Trading = 4, Trading Overseas = 15 (locked tech nodes now show their cost alongside the lock icon).
- **Quick Tutorial**: first-run 5-step overlay (Welcome → Move → Battle/Capture → Cities → Tech) with Next/Back/Skip and progress dots; auto-shows once (flag `hextribes_tutorial_seen_v1`) and re-openable from the pause menu → "How to Play".
- **Merchant UX fix**: units garrisoned on a city are now shown as a badge beside the city; tapping a city then tapping it again selects the garrisoned unit to move it out; Merchants are trained ready-to-move; single-tap a merchant = move options, double-tap a merchant = open its trade/inventory panel.
- **Unit move animation**: units glide tile→tile (~300ms); reachable/attackable tiles highlighted more boldly.
- **City level-up reward modal**: human cities enqueue a reward choice on level-up (Workshop / Treasury / Wall / Grand Park); AI auto-resolves.
- **Shareable victory card**: win/lose result renders a score card (tribe, turns, cities, techs, score) with a native Share button.
- **Naval & Ports (manual embark)**: build a Port on coastal water; land units embark → Rowing Boat → Sailing Boat → Battleship; auto-disembark on land.
- **Roads & Clear-Forest**: build **Roads** (needs Roads tech) on land — units chain along connected roads for free (fast travel); roads render as brown segments linking adjacent road tiles. **Clear Forest** (needs Construction) burns a forest tile into farmable grassland (adds a crop).
- **Merchants & Trading**: train a **Merchant** (needs Trading; **Merchant Ship** = embarked merchant, 8 slots vs 4 on land). Open its **Trade** panel to load goods and set a per-unit price (1–20★). Each round rival (bot) tribes buy your cargo — you earn the price in stars. You can also **buy from another player's merchant**: tap an enemy merchant to open its shop (BuyMerchantPanel) and choose **how many units** to buy per slot via a − / + / MAX stepper (capped by stock and what you can afford); the Buy button shows the live total cost, and purchasing pays stars to its owner. AI tribes with Trading train and stock a merchant. Merchants can't be attacked. **Sale notifications**: at the start of the human's turn, sales made by the player's merchant that round are aggregated and shown in a `SaleModal` — listing quantity sold per good and the total stars earned (engine tracks `state.pendingSale`; cleared via `doClearSale`).
- **Buildings & production**: tap a cell in your territory to build production structures that yield goods/stars each turn — Lumber Hut, Wheat/Bull/Horse Farm, Coal/Iron/Gold Mine. **Mountain ores**: each mountain rolls an ore on map-gen — 40% coal, 30% iron, 10% gold, 20% barren (no mine possible). A mine can only be built on a mountain carrying its matching ore (Coal Mine→coal / +2 pop, Iron Mine→iron ore / +2 iron/turn, Gold Mine→gold / +5 stars/turn); building the mine consumes the ore. Production credited at turn start; AI also builds. Buildings show as markers on the map.
- **Goods economy**: players hold wood/iron/wheat/meat/horses (second top-bar row). Unit training requires goods per the table; city chips show goods costs (red when short).
- Tribes: Lesnoi, Freemen, He-he, Fishmen; biome-specific procedural world-gen (Voronoi regions); map types Continents/Pangea/Lakes/Dryland/Archipelago. Map sizes: Small 12×12, Normal 24×24, Large 36×36. Capitals always spawn with ≥5 land cells around them; neutral villages never spawn on mountains.
- Branching radial tech tree (~29 techs). Units: warrior/archer/beefeater/catapult/rider/armored_rider/knight/pikeman/swordsman/merchant + naval tiers.
- City panel opens even when a unit occupies it.
- **Hunting wild animals**: tap a wild animal (Bull) tile in your territory to open a choice modal — **Hire a Hunter** (3★, instant +1 pop & +1 meat to nearest city) or **Hunt Yourself** (free 3D first-person archery mini-game). Mini-game (`HuntingMiniGame.tsx`, react-three-fiber + expo-gl, locked landscape): player 12 HP / 12 arrows; bull charges & gores for 4 HP (with strafing dodges); hitboxes — head = 1-shot kill, body = 4 hits, legs = 12 hits. Killing the bull grants +1 pop & +1 meat to the nearest city; dying or running out of arrows = no reward. Wired in `app/game.tsx` (`doHireHunter` / `doHuntSuccess`). Note: WebGL renders in preview but is best validated on a real device / Expo Go.

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
