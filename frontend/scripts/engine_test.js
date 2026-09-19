/* Headless engine logic test (run with: node scripts/engine_test.js) */
const path = require("path");
const Module = require("module");

// Resolve "@/..." alias to the frontend root.
const ROOT = path.resolve(__dirname, "..");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request.startsWith("@/")) request = path.join(ROOT, request.slice(2));
  return origResolve.call(this, request, ...args);
};

const babel = require("@babel/core");
require.extensions[".ts"] = require.extensions[".tsx"] = function (module, filename) {
  const { code } = babel.transformFileSync(filename, {
    presets: ["@babel/preset-typescript"],
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  });
  module._compile(code, filename);
};

const { generateGame } = require("../src/game/mapgen.ts");
const engine = require("../src/game/engine.ts");
const { unitStats } = require("../src/game/data.ts");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name); } };

// Deterministic seed — search for one where the capital is coastal (for naval test).
let s, cap;
for (let seed = 1; seed < 200; seed++) {
  s = generateGame({ tribe: "snow", opponents: 1, mapSize: 11, mapType: "archipelago", passAndPlay: false, seed });
  cap = s.cities.find((c) => c.owner === 0);
  const terr = [cap.tileId, ...engine.neighbors(s, cap.tileId)];
  const coastal = s.tiles.some((t) => t.terrain === "water" && engine.neighbors(s, t.id).some((n) => s.tiles[n].terrain !== "water" && terr.includes(n)));
  if (coastal) break;
}
const P = 0;
const player = s.players[P];
player.stars = 200;
player.techs = ["fishing", "sailing", "expedition", "trading", "roads", "construction", "climbing"];

// ---- Merchant training ----
// clear the capital tile so training works
s.units = s.units.filter((u) => !(u.owner === P && u.tileId === cap.tileId));
ok("train merchant", engine.trainUnit(s, P, cap.id, "merchant"));
const merch = s.units.find((u) => u.owner === P && u.type === "merchant");
ok("merchant created with cargo", !!merch && !!merch.cargo);
ok("merchant is ready to move the turn it's recruited", !!merch && merch.moved === false && merch.attacked === false);
ok("merchant has movement options", !!merch && engine.reachableTiles(s, merch).length > 0);

// ---- Merchant slots: load + per-slot price + trade ----
player.goods.wood = 20;
ok("merchant has 4 slots", merch.cargo.length === 4);
ok("load 16 wood into slot 0", engine.loadMerchant(s, merch.id, 0, "wood", 16) && merch.cargo[0].good === "wood" && merch.cargo[0].qty === 16);
ok("slot cap is 16 on land (cannot exceed)", !engine.loadMerchant(s, merch.id, 0, "wood", 5) || merch.cargo[0].qty === 16);
ok("stockpile reduced by 16", player.goods.wood === 4);
ok("unload 1 wood", engine.loadMerchant(s, merch.id, 0, "wood", -1) && merch.cargo[0].qty === 15);
ok("set slot-0 price to 5", engine.setMerchantPrice(s, merch.id, 0, 5) && merch.cargo[0].price === 5);
// second slot, different good + different price
player.goods.iron = 10;
ok("load iron into slot 1", engine.loadMerchant(s, merch.id, 1, "iron", 4) && merch.cargo[1].good === "iron" && merch.cargo[1].qty === 4);
ok("set slot-1 price to 9", engine.setMerchantPrice(s, merch.id, 1, 9) && merch.cargo[1].price === 9);
ok("slots hold independent goods & prices", merch.cargo[0].good === "wood" && merch.cargo[1].good === "iron" && merch.cargo[0].price === 5 && merch.cargo[1].price === 9);
// bot buys: give bot stars
const bot = s.players[1];
bot.stars = 100;
const ownerStarsBefore = player.stars;
const wood0 = merch.cargo[0].qty;
engine.resolveTrades(s);
ok("bot bought 1 unit from a slot", merch.cargo[0].qty === wood0 - 1);
ok("owner earned that slot's price", player.stars === ownerStarsBefore + 5);
ok("bot spent stars & got good", bot.stars === 95 && bot.goods.wood >= 1);

// ---- Human buys from another player's merchant (per slot) ----
{
  const { newUnit: mk } = require("../src/game/factory.ts");
  const botCity = s.cities.find((c) => c.owner === 1);
  const bm = mk("merchant", 1, botCity ? botCity.tileId : merch.tileId);
  bm.cargo[0].good = "iron"; bm.cargo[0].qty = 3; bm.cargo[0].price = 4;
  s.units.push(bm);
  s.tiles[bm.tileId].explored = true; // human has discovered it
  ok("can buy from other player's merchant", engine.canBuyFromMerchant(s, P, bm.id).ok);
  const humanStars = player.stars;
  const ownerStars = s.players[1].stars;
  const humanIron = player.goods.iron;
  ok("buy 2 iron from slot 0", engine.buyFromMerchant(s, P, bm.id, 0, 2));
  ok("human got iron", player.goods.iron === humanIron + 2);
  ok("human paid 8 stars", player.stars === humanStars - 8);
  ok("merchant owner earned 8 stars", s.players[1].stars === ownerStars + 8);
  ok("merchant slot reduced", bm.cargo[0].qty === 1);
  ok("cannot buy own merchant", !engine.canBuyFromMerchant(s, 1, bm.id).ok);
}

// ---- Merchant Ship: embark at a Trade Port (needs Trading Overseas) ----
{
  const grid = require("../src/game/grid.ts");
  let portT = s.tiles.find((t) => t.terrain === "water" && grid.neighbors(s, t.id).some((n) => s.tiles[n].terrain !== "water"));
  if (portT) {
    portT.tradePort = true;
    merch.tileId = portT.id;
    merch.boat = null;
    if (!player.techs.includes("trading_overseas")) player.techs.push("trading_overseas");
    // merchant cannot embark on a plain (military) main port
    portT.tradePort = false; portT.port = true;
    ok("merchant blocked on main port", !engine.canEmbark(s, merch.id).ok);
    portT.port = false; portT.tradePort = true;
    ok("embark merchant -> merchant ship", engine.embark(s, merch.id) && merch.boat === "sailing");
    ok("ship has 8 slots", merch.cargo.length === 8);
    ok("merchant ship can't upgrade", !engine.canUpgradeBoat(s, merch.id).ok);
    player.goods.wheat = 50;
    ok("load 32 wheat into a ship slot", engine.loadMerchant(s, merch.id, 4, "wheat", 32) && merch.cargo[4].qty === 32);
    ok("ship slot cap is 32", !engine.loadMerchant(s, merch.id, 4, "wheat", 1) || merch.cargo[4].qty === 32);
  } else { console.log("SKIP ship slots (no coastal water)"); }
}

// ---- Infrastructure: road ----
const nb = engine.neighbors(s, cap.tileId).map((id) => s.tiles[id]);
const landAdj = nb.find((t) => t.terrain === "grass" && !t.cityId && !t.building && !t.road);
if (landAdj) {
  ok("build road", engine.doInfra(s, P, landAdj.id, "road") && s.tiles[landAdj.id].road === true);
} else { console.log("SKIP road (no grass adj)"); }

// ---- Infrastructure: burn forest ----
const forestAdj = nb.find((t) => t.terrain === "forest" && !t.cityId);
if (forestAdj) {
  ok("burn forest -> grass", engine.doInfra(s, P, forestAdj.id, "burn_forest") && s.tiles[forestAdj.id].terrain === "grass" && s.tiles[forestAdj.id].resource === "crop");
} else { console.log("SKIP burn (no forest adj)"); }

// ---- Naval: build port + embark + upgrade ----
// find a water tile adjacent to owned land in the capital's territory (try seeds until coastal)
let portTile = null;
const capTerr = [cap.tileId, ...engine.neighbors(s, cap.tileId)];
for (const t of s.tiles) {
  if (t.terrain !== "water" || t.port) continue;
  const adj = engine.neighbors(s, t.id);
  if (adj.some((n) => s.tiles[n].terrain !== "water" && capTerr.includes(n))) { portTile = t; break; }
}
if (portTile) {
  if (!player.techs.includes("sailing")) player.techs.push("sailing");
  // Wood-cost enforcement: port needs 10★ + 12 wood
  player.stars = 50; player.goods.wood = 5;
  ok("main port blocked without enough wood", !engine.canInfra(s, P, portTile.id, "port").ok);
  ok("main port panel opens (ignoreStars) despite low wood", engine.canInfra(s, P, portTile.id, "port", { ignoreStars: true }).ok);
  player.goods.wood = 40;
  const woodBefore = player.goods.wood, starBefore = player.stars;
  cap.level = 6; cap.population = 0; // high level so the +3 pop won't trigger a level-up
  const built = engine.doInfra(s, P, portTile.id, "port");
  ok("build port", built && s.tiles[portTile.id].port === true);
  ok("main port gives +3 population", cap.population === 3 && cap.level === 6);
  ok("port deducted 12 wood", player.goods.wood === woodBefore - 12);
  ok("port deducted 10 stars", player.stars === starBefore - 10);
  // place a warrior on the port tile (simulate having moved there) and embark
  const { newUnit } = require("../src/game/factory.ts");
  const w = newUnit("warrior", P, portTile.id);
  s.units.push(w);
  ok("can embark on main port", engine.canEmbark(s, w.id).ok);
  ok("embark", engine.embark(s, w.id) && w.boat === "rowing");
  ok("boat move stat > land", unitStats(w).move === 2);
  w.moved = false;
  ok("upgrade to sailing", engine.canUpgradeBoat(s, w.id).ok && engine.upgradeBoat(s, w.id) && w.boat === "sailing");
  ok("upgrade to battleship", engine.upgradeBoat(s, w.id) && w.boat === "battleship");
  ok("battleship atk", unitStats(w).atk === 4);

  // A land unit standing next to the port can reach the port tile to embark.
  s.units = s.units.filter((u) => u.id !== w.id); // free the port tile
  const landNbr = engine.neighbors(s, portTile.id).find((n) => s.tiles[n].terrain !== "water" && s.tiles[n].terrain !== "mountain" && !engine.unitAt(s, n));
  if (landNbr != null) {
    const { newUnit: mk } = require("../src/game/factory.ts");
    const w2 = mk("warrior", P, landNbr);
    s.units.push(w2);
    ok("land unit can reach port tile", engine.reachableTiles(s, w2).includes(portTile.id));
  }
} else { console.log("SKIP naval (no coastal water near capital)"); }

// ---- Trade Port: distinct build + merchant-only embark + wood cost (8★ + 10 wood) ----
{
  let tpTile = null;
  const capTerr2 = [cap.tileId, ...engine.neighbors(s, cap.tileId)];
  for (const t of s.tiles) {
    if (t.terrain !== "water" || t.port || t.tradePort) continue;
    const adj = engine.neighbors(s, t.id);
    if (adj.some((n) => s.tiles[n].terrain !== "water" && capTerr2.includes(n))) { tpTile = t; break; }
  }
  if (tpTile) {
    if (!player.techs.includes("trading_overseas")) player.techs.push("trading_overseas");
    player.stars = 50; player.goods.wood = 3;
    ok("trade port blocked without enough wood", !engine.canInfra(s, P, tpTile.id, "trade_port").ok);
    player.goods.wood = 30;
    const wB = player.goods.wood, sB = player.stars;
    cap.level = 8; cap.population = 0; // high level so the +2 pop won't trigger a level-up
    ok("build trade port", engine.doInfra(s, P, tpTile.id, "trade_port") && s.tiles[tpTile.id].tradePort === true);
    ok("trade port gives +2 population", cap.population === 2 && cap.level === 8);
    ok("trade port deducted 10 wood", player.goods.wood === wB - 10);
    ok("trade port deducted 8 stars", player.stars === sB - 8);
    // a warrior cannot embark on a trade port (merchants only)
    const { newUnit: mk2 } = require("../src/game/factory.ts");
    const wt = mk2("warrior", P, tpTile.id);
    s.units.push(wt);
    if (!player.techs.includes("sailing")) player.techs.push("sailing");
    ok("warrior cannot embark on trade port", !engine.canEmbark(s, wt.id).ok);
    s.units = s.units.filter((u) => u.id !== wt.id);
  } else { console.log("SKIP trade port (no coastal water near capital)"); }
}


// ---- Land unit cannot enter open water ----
const anyWater = s.tiles.find((t) => t.terrain === "water" && !t.port);
if (anyWater) {
  const landUnit = s.units.find((u) => u.owner === P && !u.boat && u.type !== "merchant");
  if (landUnit) {
    const reach = engine.reachableTiles(s, landUnit);
    ok("land unit blocked from open water", !reach.includes(anyWater.id));
  }
}

// ---- City level-up reward (human enqueues a choice) ----
{
  const rcap = cap;
  const terr = [rcap.tileId, ...engine.neighbors(s, rcap.tileId)];
  // ensure organisation tech + a fruit tile in territory
  if (!player.techs.includes("organisation")) player.techs.push("organisation");
  const ftile = s.tiles[terr.find((id) => id !== rcap.tileId && s.tiles[id].terrain === "grass" && !s.tiles[id].cityId && !engine.unitAt(s, id)) ?? terr[1]];
  ftile.terrain = "grass";
  ftile.resource = "fruit";
  rcap.level = 1; // reset (earlier port tests bumped the capital's level)
  rcap.population = 1; // one harvest (levelThreshold(1)=2) will level it up
  player.stars = 50;
  const before = (s.pendingLevelUps || []).length;
  engine.harvest(s, P, ftile.id);
  ok("human city level up enqueued", s.pendingLevelUps.length > before && s.pendingLevelUps.includes(rcap.id));
  const prodBefore = rcap.production;
  ok("apply workshop reward", engine.applyLevelReward(s, rcap.id, "workshop") && rcap.production === prodBefore + 1);
  ok("pending cleared", !s.pendingLevelUps.includes(rcap.id));
}

// ---- Level-up reward choice is offered to ALL human players (not just player 0) ----
{
  const mkGame = () => {
    const g = generateGame({ tribe: "snow", opponents: 1, mapSize: 14, mapType: "continents", passAndPlay: true, seed: 9 });
    const c1 = g.cities.find((c) => c.owner === 1);
    g.players[1].techs = [...g.players[1].techs, "climbing", "mining", "mining_technology", "iron_mine"];
    g.players[1].stars = 200;
    const mt = engine.neighbors(g, c1.tileId).find((n) => g.tiles[n].terrain !== "water" && !engine.unitAt(g, n) && !g.tiles[n].cityId) ?? engine.neighbors(g, c1.tileId)[0];
    const tile = g.tiles[mt]; tile.terrain = "mountain"; tile.resource = "iron_ore"; tile.building = null;
    c1.level = 1; c1.population = 0;
    return { g, c1, mt };
  };
  // Human player #2 (index 1): should be queued for a reward pick.
  const a = mkGame();
  a.g.players[1].isHuman = true;
  engine.build(a.g, 1, a.mt, "iron_mine"); // +2 pop -> level up
  ok("human player #2 level up enqueued", (a.g.pendingLevelUps || []).includes(a.c1.id));
  // Non-human (AI) player: should NOT be queued (auto reward instead).
  const b = mkGame();
  b.g.players[1].isHuman = false;
  engine.build(b.g, 1, b.mt, "iron_mine");
  ok("AI player level up NOT enqueued", !(b.g.pendingLevelUps || []).includes(b.c1.id));
}


// ---- Tech pricing (trade line) ----
{
  const dataMod = require("../src/game/data.ts");
  ok("roads costs 2", dataMod.TECH_BY_ID.roads.cost === 2);
  ok("construction costs 5", dataMod.TECH_BY_ID.construction.cost === 5);
  ok("trading costs 4", dataMod.TECH_BY_ID.trading.cost === 4);
  ok("trading_overseas costs 15", dataMod.TECH_BY_ID.trading_overseas.cost === 15);
}

// ---- Difficulty: peaceful bots never strike first; only retaliate once provoked ----
{
  const ai = require("../src/game/ai.ts");
  const grid = require("../src/game/grid.ts");
  const engine = require("../src/game/engine.ts");
  const { newUnit: mk2 } = require("../src/game/factory.ts");
  const g2 = generateGame({ tribe: "nature", opponents: 1, mapSize: 11, mapType: "pangea", difficulty: "peaceful", passAndPlay: false, seed: 7 });
  ok("difficulty stored on state", g2.difficulty === "peaceful");
  // clear starting units so we control the scenario
  g2.units = [];
  const landOk = (t) => (t.terrain === "grass" || t.terrain === "forest" || t.terrain === "sand") && !t.cityId;
  let a = null, b = null;
  for (const t of g2.tiles) {
    if (!landOk(t)) continue;
    const cand = grid.neighbors(g2, t.id).find((n) => landOk(g2.tiles[n]));
    if (cand != null) { a = t.id; b = cand; break; }
  }
  if (a != null) {
    const human = mk2("warrior", 0, a);
    const bot = mk2("warrior", 1, b);
    bot.moved = false; bot.attacked = false;
    g2.units.push(human, bot);
    const hpBefore = human.hp;
    // Unprovoked: the peaceful bot must NOT attack the adjacent human unit.
    ai.runAiTurn(g2, 1);
    const afterPassive = g2.units.find((u) => u.id === human.id);
    ok("peaceful bot does NOT strike first", afterPassive && afterPassive.hp === hpBefore && !g2.players[1].provoked);
    // Now the human attacks the bot -> bot becomes provoked and retaliates next turn.
    const botUnit = g2.units.find((u) => u.id === bot.id);
    botUnit.moved = false; botUnit.attacked = false;
    engine.attackUnit(g2, human.id, botUnit.tileId);
    ok("attacking a peaceful bot provokes it", g2.players[1].provoked === true);
    const botAlive = g2.units.find((u) => u.id === bot.id);
    if (botAlive) {
      botAlive.moved = false; botAlive.attacked = false;
      const humanAlive = g2.units.find((u) => u.id === human.id);
      if (humanAlive) {
        const hp2 = humanAlive.hp;
        ai.runAiTurn(g2, 1);
        const afterProvoked = g2.units.find((u) => u.id === human.id);
        ok("provoked peaceful bot fights back", !afterProvoked || afterProvoked.hp < hp2);
      } else { console.log("SKIP provoked retaliation (human died to counter)"); }
    } else { console.log("SKIP provoked retaliation (bot died)"); }
  } else { console.log("SKIP peaceful defense (no adjacent grass)"); }
}

// ---- Buildings grant population to owning city ----
{
  const grid = require("../src/game/grid.ts");
  const g3 = generateGame({ tribe: "nature", opponents: 1, mapSize: 11, mapType: "pangea", difficulty: "normal", passAndPlay: false, seed: 3 });
  const pl = g3.players[0];
  pl.stars = 80;
  pl.techs = ["log_chopping", "farming", "bull_farming", "horse_farming"];
  const cap3 = g3.cities.find((c) => c.owner === 0);
  cap3.population = 0;
  cap3.level = 5; // high level so pop won't spill into a level-up during this test
  const terr = grid.neighbors(g3, cap3.tileId);
  // lumber hut on a forest tile -> +1 pop
  const forest = terr.map((id) => g3.tiles[id]).find((t) => t.terrain === "forest" && !t.cityId && !grid.unitAt(g3, t.id));
  if (forest) {
    const p0 = cap3.population;
    ok("build lumber hut", engine.build(g3, 0, forest.id, "lumber_hut"));
    ok("lumber hut +1 population", cap3.population === p0 + 1);
  } else { console.log("SKIP lumber (no forest adj)"); }
  // wheat farm on a grass tile -> +2 pop (force a neighbor to grass to guarantee coverage)
  const gid = terr.find((id) => !g3.tiles[id].cityId && !g3.tiles[id].building && g3.tiles[id].terrain !== "water" && !grid.unitAt(g3, id));
  if (gid != null) {
    g3.tiles[gid].terrain = "grass";
    g3.tiles[gid].building = null;
    const p0 = cap3.population;
    ok("build wheat farm", engine.build(g3, 0, gid, "wheat_farm"));
    ok("wheat farm +2 population", cap3.population === p0 + 2);
  } else { console.log("SKIP farm (no land adj)"); }
}

// ---- Fishing ----
{
  let g4, cap4, terr4, wid;
  for (let seed = 1; seed < 400; seed++) {
    g4 = generateGame({ tribe: "snow", opponents: 1, mapSize: 11, mapType: "archipelago", passAndPlay: false, seed });
    cap4 = g4.cities.find((c) => c.owner === 0);
    terr4 = [cap4.tileId, ...engine.neighbors(g4, cap4.tileId)];
    wid = terr4.find((id) => g4.tiles[id].terrain === "water" && !g4.tiles[id].cityId);
    if (wid != null) break;
  }
  g4.players[0].techs = ["fishing"];
  g4.players[0].stars = 50;
  if (wid != null) {
    g4.tiles[wid].resource = "fish";
    g4.tiles[wid].explored = true;
    ok("canFish inside borders with tech", engine.canFish(g4, 0, wid).ok);
    const p0 = cap4.population, st0 = g4.players[0].stars;
    ok("hireFisherman succeeds (-2 stars)", engine.hireFisherman(g4, 0, wid) && g4.players[0].stars === st0 - 2);
    ok("hireFisherman grants +1 pop", cap4.population === p0 + 1);
    ok("fish consumed after hiring", g4.tiles[wid].resource === null);
    ok("canFish false after fish consumed", !engine.canFish(g4, 0, wid).ok);
    const wid2 = terr4.find((id) => id !== wid && g4.tiles[id].terrain === "water" && !g4.tiles[id].cityId);
    if (wid2 != null) {
      g4.tiles[wid2].resource = "fish";
      g4.tiles[wid2].explored = true;
      const p1 = cap4.population;
      ok("fishSuccess grants +1 pop (free)", engine.fishSuccess(g4, 0, wid2) && cap4.population === p1 + 1);
    } else { console.log("SKIP fishSuccess (no 2nd water tile)"); }
  } else { console.log("SKIP fishing (no water adj to capital)"); }
  const g5 = g4;
  g5.players[0].techs = [];
  if (wid != null) {
    g5.tiles[wid].resource = "fish";
    g5.tiles[wid].explored = true;
    ok("canFish false without Fishing tech", !engine.canFish(g5, 0, wid).ok);
  } else { console.log("SKIP fishing-tech-gate (no water adj)"); }
}

// ---- Stalemate / Draw ----
{
  const mkTrapped = () => {
    const g = generateGame({ tribe: "snow", opponents: 1, mapSize: 11, mapType: "continents", passAndPlay: false, seed: 4 });
    g.units = [];
    const T = 5 * g.width + 5; // interior tile with 8 neighbours
    g.tiles[T].terrain = "grass";
    g.tiles[T].resource = null;
    g.tiles[T].building = null;
    g.units.push({ id: "hm1", type: "merchant", owner: 0, tileId: T, hp: 10, maxHp: 10, moved: false, attacked: false, boat: null, cargo: [] });
    const nb = engine.neighbors(g, T);
    nb.forEach((n, i) => {
      g.tiles[n].terrain = "grass";
      g.units.push({ id: "e" + i, type: "warrior", owner: 1, tileId: n, hp: 10, maxHp: 10, moved: false, attacked: false, boat: null });
    });
    g.status = "playing";
    g.stalemateTurns = 0;
    return { g, T };
  };

  const { g } = mkTrapped();
  ok("human is stalemated (boxed-in merchant, no military)", engine.isHumanStalemated(g));
  engine.startPlayerTurn(g, 0);
  ok("stalemate count 1, still playing", g.stalemateTurns === 1 && g.status === "playing");
  engine.startPlayerTurn(g, 0);
  engine.startPlayerTurn(g, 0);
  ok("survives 3 turns of stalemate", g.stalemateTurns === 3 && g.status === "playing");
  engine.startPlayerTurn(g, 0);
  ok("draw after 3 turns", g.status === "draw");

  // Change something during the countdown -> countdown resets, game continues.
  const { g: g2, T: T2 } = mkTrapped();
  engine.startPlayerTurn(g2, 0);
  engine.startPlayerTurn(g2, 0);
  ok("count 2 before change", g2.stalemateTurns === 2);
  // free a neighbouring cell (an enemy moves away)
  const freed = engine.neighbors(g2, T2)[0];
  g2.units = g2.units.filter((u) => u.tileId !== freed);
  engine.startPlayerTurn(g2, 0);
  ok("countdown resets when a cell frees up", g2.stalemateTurns === 0 && g2.status === "playing");

  // A military unit means never a stalemate.
  const { g: g3 } = mkTrapped();
  g3.units.push({ id: "hw", type: "warrior", owner: 0, tileId: g3.cities.find((c) => c.owner === 0).tileId, hp: 10, maxHp: 10, moved: false, attacked: false, boat: null });
  ok("not stalemated with a military unit", !engine.isHumanStalemated(g3));

  // No city => not a stalemate (that path is a normal loss/elimination).
  const { g: g4 } = mkTrapped();
  g4.cities = g4.cities.filter((c) => c.owner !== 0);
  ok("not stalemated without a city", !engine.isHumanStalemated(g4));
}

// ---- Knight (chivalry) chain kill ----
{
  const mk = () => {
    const g = generateGame({ tribe: "snow", opponents: 1, mapSize: 11, mapType: "continents", passAndPlay: false, seed: 6 });
    g.units = [];
    return g;
  };
  const T = (x, y) => y * 11 + x;
  const put = (g, x, y, owner, type, hp) => {
    const id = T(x, y);
    g.tiles[id].terrain = "grass";
    g.tiles[id].cityId = null;
    g.tiles[id].isVillage = false;
    const u = { id: `${owner}-${type}-${id}`, type, owner, tileId: id, hp, maxHp: type === "pikemen" ? 15 : 10, moved: false, attacked: false, boat: null, cargo: [] };
    g.units.push(u);
    return u;
  };

  // 1 + 2) chains through a line of 3 adjacent 10-HP enemies, 3) ending on the last tile
  let g = mk();
  let k = put(g, 5, 5, 0, "chivalry", 10);
  put(g, 6, 5, 1, "warrior", 10);
  put(g, 7, 5, 1, "warrior", 10);
  put(g, 8, 5, 1, "warrior", 10);
  ok("knight chain attack returns true", engine.attackUnit(g, k.id, T(6, 5)));
  ok("knight killed the whole line of 3", g.units.filter((u) => u.owner === 1).length === 0);
  ok("knight moved onto the last killed tile", k.tileId === T(8, 5));

  // a 1-cell gap stops the chain
  g = mk();
  k = put(g, 5, 5, 0, "chivalry", 10);
  put(g, 6, 5, 1, "warrior", 10);
  put(g, 8, 5, 1, "warrior", 10); // gap at (7,5)
  engine.attackUnit(g, k.id, T(6, 5));
  ok("chain stops at a gap (only 1 kill)", g.units.filter((u) => u.owner === 1).length === 1);
  ok("knight stopped on the first killed tile", k.tileId === T(6, 5));

  // an enemy above 10 HP stops the chain
  g = mk();
  k = put(g, 5, 5, 0, "chivalry", 10);
  put(g, 6, 5, 1, "warrior", 10);
  const pk1 = put(g, 7, 5, 1, "pikemen", 15);
  engine.attackUnit(g, k.id, T(6, 5));
  ok("chain stops before a >10 HP unit", g.units.some((u) => u.id === pk1.id && u.hp === 15));
  ok("knight killed only the 10 HP unit", g.units.filter((u) => u.owner === 1).length === 1 && k.tileId === T(6, 5));

  // a >10 HP first target => normal attack (no one-shot, no teleport)
  g = mk();
  k = put(g, 5, 5, 0, "chivalry", 10);
  const pk2 = put(g, 6, 5, 1, "pikemen", 15);
  engine.attackUnit(g, k.id, T(6, 5));
  ok("first >10 HP target survives normal combat", g.units.some((u) => u.id === pk2.id));
  ok("knight did not teleport onto a >10 HP target", k.tileId === T(5, 5));
  ok("knight dealt normal damage to the >10 HP target", pk2.hp < 15);
}

// ---- Territory expansion (purchasable rings) ----
{
  let g = generateGame({ tribe: "snow", opponents: 1, mapSize: 16, mapType: "continents", passAndPlay: false, seed: 7 });
  const c = g.cities.find((ci) => ci.owner === 0);
  g.players[0].stars = 500;
  const ct = g.tiles[c.tileId];
  const ring = (r) => g.tiles.filter((t) => Math.max(Math.abs(t.x - ct.x), Math.abs(t.y - ct.y)) === r).map((t) => t.id);
  const r2 = ring(2), r3 = ring(3);

  const r2buyable = r2.filter((tid) => engine.expansionOptionForTile(g, 0, tid));
  ok("tier 2 tiles are buyable at 5 stars", r2buyable.length > 0 && r2buyable.every((tid) => { const o = engine.expansionOptionForTile(g, 0, tid); return o.cost === 5 && o.tier === 2; }));
  ok("tier 3 tiles are LOCKED until tier 2 is fully bought", r3.every((tid) => engine.expansionOptionForTile(g, 0, tid) === null));

  const first = r2buyable[0];
  const before = g.players[0].stars;
  ok("buy a tier-2 tile", engine.expandTerritory(g, 0, first));
  ok("tier-2 purchase costs 5 stars", g.players[0].stars === before - 5);
  ok("bought tile joins the city territory", (c.expandedTiles || []).includes(first));
  ok("cannot buy a tile already owned", engine.expansionOptionForTile(g, 0, first) === null);

  for (const tid of r2buyable) if (tid !== first) engine.expandTerritory(g, 0, tid);
  const r3buyable = r3.filter((tid) => engine.expansionOptionForTile(g, 0, tid));
  ok("tier 3 unlocks once tier 2 is fully bought", r3buyable.length > 0 && r3buyable.every((tid) => engine.expansionOptionForTile(g, 0, tid).cost === 10));
}

// ---- Build panel opens even when the player cannot afford (price shown red) ----
{
  const data = require("../src/game/data.ts");
  let g = generateGame({ tribe: "snow", opponents: 1, mapSize: 16, mapType: "continents", passAndPlay: false, seed: 7 });
  const c = g.cities.find((ci) => ci.owner === 0);
  const p = g.players[0];
  p.techs = ["fishing", "sailing", "expedition", "trading", "roads", "construction", "climbing", "hunting", "forestry", "organization", "farming", "mining", "chivalry", "riding", "meditation", "philosophy", "mathematics", "shields", "aquatism", "navigation", "spiritualism", "chivalry"];
  p.stars = 999;
  const terr = [c.tileId, ...engine.neighbors(g, c.tileId)];
  const buildTile = terr.find((tid) => engine.buildableFor(g, 0, tid).length > 0);
  ok("a territory tile has a buildable option when affordable", buildTile != null);
  if (buildTile != null) {
    const bId = data.BUILDINGS.find((b) => engine.canBuild(g, 0, buildTile, b.id, { ignoreStars: true }).ok).id;
    p.stars = 0;
    ok("build panel still opens with 0 stars (tileHasActions true)", engine.tileHasActions(g, 0, buildTile) === true);
    ok("nothing is actually buildable at 0 stars", engine.buildableFor(g, 0, buildTile).length === 0);
    ok("strict canBuild fails only due to stars", engine.canBuild(g, 0, buildTile, bId).reason === "Not enough stars");
    ok("canBuild(ignoreStars) still passes for that building", engine.canBuild(g, 0, buildTile, bId, { ignoreStars: true }).ok === true);
    // a tile OUTSIDE the city's territory must NOT open the build panel, even ignoring stars
    const ct = g.tiles[c.tileId];
    const outside = g.tiles.find((t) => Math.max(Math.abs(t.x - ct.x), Math.abs(t.y - ct.y)) === 2);
    ok("a tile outside territory has no build actions", outside == null || engine.tileHasActions(g, 0, outside.id) === false);
  }
}

// ---- Economy ledger, goods income, and fog-gated purchases ----
{
  let g = generateGame({ tribe: "snow", opponents: 1, mapSize: 16, mapType: "continents", passAndPlay: true, seed: 7 });
  ok("players start with an economy ledger", g.players.every((p) => p.economy && p.economy.bought && p.economy.sold));

  // goodsIncome reflects building production on controlled tiles
  const c = g.cities.find((ci) => ci.owner === 0);
  const nb = engine.neighbors(g, c.tileId)[0];
  const t = g.tiles[nb];
  t.terrain = "forest"; t.building = "lumber_hut"; t.resource = null;
  ok("goodsIncome counts a lumber hut (+2 wood/turn)", engine.goodsIncome(g, 0).wood === 2);

  // Iron mine gives +2 population AND +2 iron income
  {
    let gm = generateGame({ tribe: "snow", opponents: 1, mapSize: 14, mapType: "continents", passAndPlay: false, seed: 4 });
    gm.players[0].stars = 200; gm.players[0].techs = [...gm.players[0].techs, "climbing", "mining", "mining_technology", "iron_mine"];
    const cm = gm.cities.find((ci) => ci.owner === 0);
    const mt = engine.neighbors(gm, cm.tileId).find((n) => gm.tiles[n].terrain === "mountain") ?? engine.neighbors(gm, cm.tileId)[0];
    const tile = gm.tiles[mt];
    tile.terrain = "mountain"; tile.resource = "iron_ore"; tile.building = null;
    cm.level = 5; cm.population = 0; // high level so +2 pop won't trigger a level-up
    const popBefore = cm.population, lvlBefore = cm.level;
    engine.build(gm, 0, mt, "iron_mine");
    ok("iron mine adds +2 city population", cm.population === popBefore + 2 && cm.level === lvlBefore);
    ok("iron mine produces iron income (+2/turn)", engine.goodsIncome(gm, 0).iron >= 2);
  }

  // Sell path: a bot buying from the human's merchant must record on the human's SOLD ledger
  const cityTile0 = g.cities.find((ci) => ci.owner === 0).tileId;
  g.units.push({ id: "mtest", type: "merchant", owner: 0, tileId: cityTile0, hp: 10, maxHp: 10, moved: false, attacked: false, boat: null, cargo: [{ good: "wood", qty: 3, price: 2 }, { good: null, qty: 0, price: 2 }, { good: null, qty: 0, price: 2 }, { good: null, qty: 0, price: 2 }] });
  g.players[1].isHuman = false; g.players[1].stars = 100;
  const soldStarsBefore = g.players[0].stars;
  engine.resolveTrades(g);
  ok("bot purchase records on human SOLD ledger", (g.players[0].economy.sold.wood?.qty ?? 0) >= 1);
  ok("human receives stars for the sale", g.players[0].stars > soldStarsBefore);

  // Pass-and-play case: a player buying via buyFromMerchant also records the owner's SOLD ledger
  {
    let gp = generateGame({ tribe: "snow", opponents: 1, mapSize: 14, mapType: "continents", passAndPlay: true, seed: 9 });
    const ct = gp.cities.find((ci) => ci.owner === 0).tileId;
    gp.units.push({ id: "mpp", type: "merchant", owner: 0, tileId: ct, hp: 10, maxHp: 10, moved: false, attacked: false, boat: null, cargo: [{ good: "iron", qty: 5, price: 3 }, { good: null, qty: 0, price: 3 }, { good: null, qty: 0, price: 3 }, { good: null, qty: 0, price: 3 }] });
    gp.players[1].stars = 50;
    gp.tiles[ct].explored = true; // buyer can see the merchant
    engine.buyFromMerchant(gp, 1, "mpp", 0, 2);
    ok("buyFromMerchant records owner SOLD ledger (pass-and-play)", (gp.players[0].economy.sold.iron?.qty ?? 0) === 2 && (gp.players[0].economy.sold.iron?.stars ?? 0) === 6);
    ok("buyFromMerchant records buyer BOUGHT ledger", (gp.players[1].economy.bought.iron?.qty ?? 0) === 2);
  }

  // End-to-end: merchant + full round via advanceTurn (market tick) -> SOLD ledger populated
  {
    let g2 = generateGame({ tribe: "snow", opponents: 1, mapSize: 14, mapType: "continents", passAndPlay: false, seed: 11 });
    const h = g2.players[0];
    const cap2 = g2.cities.find((ci) => ci.owner === 0);
    g2.units.push({ id: "me2e", type: "merchant", owner: 0, tileId: cap2.tileId, hp: 10, maxHp: 10, moved: false, attacked: false, boat: null, cargo: [{ good: "wood", qty: 3, price: 1 }, { good: null, qty: 0, price: 1 }, { good: null, qty: 0, price: 1 }, { good: null, qty: 0, price: 1 }] });
    g2.players[1].isHuman = false; g2.players[1].stars = 100;
    // advance a full round back to the human (startPlayerTurn(0) runs the market tick)
    let guard = 0;
    do { engine.advanceTurn(g2); guard++; } while (g2.currentPlayer !== 0 && guard < 12);
    ok("SOLD ledger populated after a full round (market tick)", (h.economy.sold.wood?.qty ?? 0) >= 1);
  }

  // Closed-game fog: a player cannot buy a village/city they have not discovered
  let cg = generateGame({ tribe: "snow", opponents: 1, mapSize: 18, mapType: "continents", passAndPlay: true, seed: 3 });
  cg.closed = true;
  for (const p of cg.players) engine.revealFor(cg, p.index);
  cg.players[1].stars = 100;
  const vil = cg.tiles.find((tl) => tl.isVillage && !tl.cityId && !(tl.seenBy || []).includes(1));
  ok("found an undiscovered village for player 1", vil != null);
  if (vil) {
    ok("cannot buy an UNDISCOVERED village (closed game)", engine.canBuyVillage(cg, 1, vil.id).reason === "Not discovered");
    if (!vil.seenBy) vil.seenBy = [];
    vil.seenBy.push(1);
    ok("CAN buy the village once discovered", engine.canBuyVillage(cg, 1, vil.id).ok === true);
  }

  // Closed-game fog: cannot buy an enemy CITY on an undiscovered tile
  const enemyCity = cg.cities.find((ci) => ci.owner !== 1 && !(cg.tiles[ci.tileId].seenBy || []).includes(1));
  if (enemyCity) {
    ok("cannot buy an UNDISCOVERED enemy city (closed game)", engine.canBuyCity(cg, 1, enemyCity.id).reason === "Not discovered");
    const ct = cg.tiles[enemyCity.tileId];
    if (!ct.seenBy) ct.seenBy = [];
    ct.seenBy.push(1);
    ok("CAN buy the enemy city once discovered (given stars)", engine.canBuyCity(cg, 1, enemyCity.id).ok === true);
  }
}


// ---- Citadel upgrade (City Screen) ----
{
  let g = generateGame({ tribe: "snow", opponents: 1, mapSize: 14, mapType: "continents", passAndPlay: false, seed: 4 });
  const c = g.cities.find((ci) => ci.owner === 0);
  ok("new city citadel stage 1", (c.citadelStage ?? 1) === 1);
  g.players[0].stars = 5; g.players[0].goods.planks = 10;
  ok("citadel upgrade blocked without resources", !engine.canUpgradeCitadel(g, 0, c.id).ok);
  g.players[0].stars = 100; g.players[0].goods.planks = 60;
  ok("citadel upgrade blocked below city level 4", !engine.canUpgradeCitadel(g, 0, c.id).ok);
  c.level = 4;
  ok("citadel upgrade ok", engine.canUpgradeCitadel(g, 0, c.id).ok);
  const sBefore = g.players[0].stars, pBefore = g.players[0].goods.planks;
  ok("upgrade to stage 5", engine.upgradeCitadel(g, 0, c.id) && c.citadelStage === 5);
  ok("upgrade spent 10 stars + 50 planks", g.players[0].stars === sBefore - 10 && g.players[0].goods.planks === pBefore - 50);
}


// ---- City building placement ----
{
  let g = generateGame({ tribe: "snow", opponents: 1, mapSize: 14, mapType: "continents", passAndPlay: false, seed: 4 });
  const c = g.cities.find((ci) => ci.owner === 0);
  g.players[0].stars = 200; g.players[0].goods.planks = 40;
  ok("place house ok at (2,2)", engine.canPlaceCityBuilding(g, 0, c.id, "house", 2, 2).ok);
  ok("house blocked over citadel center", !engine.canPlaceCityBuilding(g, 0, c.id, "house", 13, 13).ok);
  ok("house blocked off-map", !engine.canPlaceCityBuilding(g, 0, c.id, "house", 29, 29).ok);
  const pB = g.players[0].goods.planks;
  ok("build house deducts 8 planks + 5 stars", engine.placeCityBuilding(g, 0, c.id, "house", 2, 2) && c.layout.buildings.length === 1 && g.players[0].goods.planks === pB - 8);
  ok("house limit 1 at stage 1 blocks a 2nd house", !engine.canPlaceCityBuilding(g, 0, c.id, "house", 6, 6).ok);
  ok("cannot overlap existing house", !engine.canPlaceCityBuilding(g, 0, c.id, "house", 3, 3).ok);
}


// ---- City roads (cosmetic drawing) ----
{
  let g = generateGame({ tribe: "snow", opponents: 1, mapSize: 14, mapType: "continents", passAndPlay: false, seed: 4 });
  const c = g.cities.find((ci) => ci.owner === 0);
  ok("road ok at (1,1)", engine.canPlaceCityRoad(g, 0, c.id, 1 * 30 + 1));
  ok("road blocked under citadel center", !engine.canPlaceCityRoad(g, 0, c.id, 15 * 30 + 15));
  ok("road blocked off-map", !engine.canPlaceCityRoad(g, 0, c.id, 40 * 30 + 40));
  const added = engine.drawCityRoads(g, 0, c.id, [1 * 30 + 1, 1 * 30 + 2, 15 * 30 + 15]);
  ok("drawCityRoads adds 2 valid, skips citadel cell", added === 2 && c.layout.roads.length === 2);
  ok("cannot redraw existing road", !engine.canPlaceCityRoad(g, 0, c.id, 1 * 30 + 1));
  // road blocked under a building
  g.players[0].stars = 200; g.players[0].goods.planks = 10;
  engine.placeCityBuilding(g, 0, c.id, "house", 5, 5);
  ok("road blocked under a building", !engine.canPlaceCityRoad(g, 0, c.id, 5 * 30 + 5));
  // remove a road
  engine.drawCityRoads(g, 0, c.id, [7 * 30 + 7]);
  const rlen = c.layout.roads.length;
  ok("removeCityRoad deletes a road", engine.removeCityRoad(g, 0, c.id, 7 * 30 + 7) && c.layout.roads.length === rlen - 1);
  ok("removeCityRoad no-op on empty cell", !engine.removeCityRoad(g, 0, c.id, 9 * 30 + 9));
}


// ---- Edit: move & demolish buildings ----
{
  let g = generateGame({ tribe: "snow", opponents: 1, mapSize: 14, mapType: "continents", passAndPlay: false, seed: 4 });
  const c = g.cities.find((ci) => ci.owner === 0);
  c.citadelStage = 10; // higher building limits so a 2nd house is allowed
  g.players[0].stars = 200; g.players[0].goods.planks = 60;
  engine.placeCityBuilding(g, 0, c.id, "house", 2, 2);
  const h = c.layout.buildings[0];
  ok("move building to empty (4,4)", engine.moveCityBuilding(g, 0, c.id, h.id, 4, 4) && h.x === 4 && h.y === 4);
  ok("cannot move onto the citadel", !engine.moveCityBuilding(g, 0, c.id, h.id, 13, 13) && h.x === 4);
  // place a 2nd house, then moving onto it should fail (overlap), but moving self in place ok
  engine.placeCityBuilding(g, 0, c.id, "house", 8, 8);
  ok("cannot move onto another building", !engine.moveCityBuilding(g, 0, c.id, h.id, 8, 8));
  ok("moving a building ignores its own footprint (move in place)", engine.moveCityBuilding(g, 0, c.id, h.id, 4, 4));
  const before = c.layout.buildings.length;
  const planksBefore = g.players[0].goods.planks;
  ok("demolish removes the building", engine.demolishCityBuilding(g, 0, c.id, h.id) && c.layout.buildings.length === before - 1);
  ok("demolish refunds the full build cost (8 planks)", g.players[0].goods.planks === planksBefore + 8);
  ok("demolish unknown id is a no-op", !engine.demolishCityBuilding(g, 0, c.id, "nope"));
}


// ---- Material Factory production (per tribe) ----
{
  // Lesnoi (planks): 2 wood -> 1 plank, feed-limited.
  let g = generateGame({ tribe: "nature", opponents: 1, mapSize: 14, mapType: "continents", passAndPlay: false, seed: 4 });
  const c = g.cities.find((ci) => ci.owner === 0);
  c.layout.buildings.push({ id: "f1", type: "factory", x: 2, y: 2 });
  g.players[0].goods.wood = 10; g.players[0].goods.planks = 0;
  engine.setFactoryFeed(g, 0, c.id, "f1", 6);
  ok("feed set to 6 (even)", c.layout.buildings[0].feed === 6);
  engine.runCityFactories(g, 0);
  ok("planks factory: 6 wood -> 3 planks", g.players[0].goods.planks === 3 && g.players[0].goods.wood === 4);
  // odd feed rounds down to even; capped by stock
  g.players[0].goods.wood = 3;
  engine.setFactoryFeed(g, 0, c.id, "f1", 5);
  engine.runCityFactories(g, 0);
  ok("planks factory caps at stock (3 wood -> 1 plank)", g.players[0].goods.planks === 4 && g.players[0].goods.wood === 1);
}
{
  // He-he (stone): +2/turn.
  let g = generateGame({ tribe: "volcanic", opponents: 1, mapSize: 14, mapType: "continents", passAndPlay: false, seed: 4 });
  const c = g.cities.find((ci) => ci.owner === 0);
  c.layout.buildings.push({ id: "f1", type: "factory", x: 2, y: 2 });
  g.players[0].goods.stone = 0;
  engine.runCityFactories(g, 0);
  ok("stone factory +2/turn", g.players[0].goods.stone === 2);
}
{
  // Freemen (sand): +5/turn.
  let g = generateGame({ tribe: "desert", opponents: 1, mapSize: 14, mapType: "continents", passAndPlay: false, seed: 4 });
  const c = g.cities.find((ci) => ci.owner === 0);
  c.layout.buildings.push({ id: "f1", type: "factory", x: 2, y: 2 });
  g.players[0].goods.sand = 0;
  engine.runCityFactories(g, 0);
  ok("sand factory +5/turn", g.players[0].goods.sand === 5);
}
{
  // Fishmen (glass): 5 sand + (1 coal or 2 wood) -> 1 glass; starves when short.
  let g = generateGame({ tribe: "snow", opponents: 1, mapSize: 14, mapType: "continents", passAndPlay: false, seed: 4 });
  const c = g.cities.find((ci) => ci.owner === 0);
  c.layout.buildings.push({ id: "f1", type: "factory", x: 2, y: 2 });
  g.players[0].goods = { ...g.players[0].goods, sand: 5, coal: 1, wood: 0, glass: 0 };
  engine.runCityFactories(g, 0);
  ok("glass factory: 5 sand + 1 coal -> 1 glass", g.players[0].goods.glass === 1 && g.players[0].goods.sand === 0 && g.players[0].goods.coal === 0);
  ok("glass factory not starved when it ran", c.layout.buildings[0].starved === false);
  // now short on inputs -> starved, no production
  g.players[0].goods = { ...g.players[0].goods, sand: 2, coal: 0, wood: 0, glass: 1 };
  engine.runCityFactories(g, 0);
  ok("glass factory starves when short (no glass, no consumption)", g.players[0].goods.glass === 1 && g.players[0].goods.sand === 2 && c.layout.buildings[0].starved === true);
  // prefers coal but falls back to 2 wood
  g.players[0].goods = { ...g.players[0].goods, sand: 5, coal: 0, wood: 2, glass: 1 };
  engine.runCityFactories(g, 0);
  ok("glass factory falls back to 2 wood", g.players[0].goods.glass === 2 && g.players[0].goods.wood === 0 && g.players[0].goods.sand === 0);
}


// ---- Trade Tower (2x trade income) ----
{
  let g = generateGame({ tribe: "snow", opponents: 1, mapSize: 14, mapType: "continents", passAndPlay: false, seed: 4 });
  const c = g.cities.find((ci) => ci.owner === 0);
  ok("no trade tower by default", engine.tradeTowerCount(g, 0) === 0 && engine.tradeMultiplier(g, 0) === 1);
  c.layout.buildings.push({ id: "tt", type: "trade_tower", x: 2, y: 2 });
  ok("tradeTowerCount 1 after placement", engine.tradeTowerCount(g, 0) === 1);
  ok("tradeMultiplier is 2 with one tower", engine.tradeMultiplier(g, 0) === 2);
  c.layout.buildings.push({ id: "tt2", type: "trade_tower", x: 8, y: 8 });
  ok("two towers stack to 4x", engine.tradeTowerCount(g, 0) === 2 && engine.tradeMultiplier(g, 0) === 4);
  c.layout.buildings = c.layout.buildings.filter((b) => b.id !== "tt2");
  // sell via a pass-and-play buy: seller (0) earns 2x
  g.players[0].techs = ["trading"];
  g.units = g.units.filter((u) => !(u.owner === 0 && u.tileId === c.tileId));
  g.players[0].stars = 200; g.players[0].goods.wood = 20;
  engine.trainUnit(g, 0, c.id, "merchant");
  const m = g.units.find((u) => u.owner === 0 && u.type === "merchant");
  engine.loadMerchant(g, m.id, 0, "wood", 4);
  engine.setMerchantPrice(g, m.id, 0, 5);
  g.players[1].stars = 100;
  const sellerBefore = g.players[0].stars;
  engine.buyFromMerchant(g, 1, m.id, 0, 2); // buy 2 @5 = 10, tower doubles seller income to 20
  ok("trade tower doubles seller income (2x)", g.players[0].stars === sellerBefore + 20);
}


// ---- Economy projection (Income / Costs / Profit) ----
{
  const engine2 = engine;
  let g = generateGame({ tribe: "nature", opponents: 1, mapSize: 14, mapType: "continents", passAndPlay: false, seed: 4 });
  const c = g.cities.find((ci) => ci.owner === 0);
  c.layout.buildings.push({ id: "f1", type: "factory", x: 2, y: 2 });
  g.players[0].goods.wood = 20; g.players[0].goods.planks = 0;
  engine2.setFactoryFeed(g, 0, c.id, "f1", 6);
  const proj = engine2.economyProjection(g, 0);
  ok("projection planks income = 3", proj.income.planks === 3);
  ok("projection wood cost = 6", proj.costs.wood === 6);
  ok("projection planks profit = 3", proj.income.planks - proj.costs.planks === 3);
}
{
  let g = generateGame({ tribe: "volcanic", opponents: 1, mapSize: 14, mapType: "continents", passAndPlay: false, seed: 4 });
  const c = g.cities.find((ci) => ci.owner === 0);
  c.layout.buildings.push({ id: "f1", type: "factory", x: 2, y: 2 });
  const proj = engine.economyProjection(g, 0);
  ok("projection stone income 2, no cost", proj.income.stone === 2 && proj.costs.stone === 0);
}


// ---- Peaceful AI: capped militia, trades tribe material, garrisons at home ----
{
  const ai = require("../src/game/ai.ts");
  const { newUnit } = require("../src/game/factory.ts");
  let g = generateGame({ tribe: "nature", opponents: 1, mapSize: 16, mapType: "continents", passAndPlay: false, seed: 7 });
  g.difficulty = "peaceful";
  const bot = 1;
  g.players[bot].techs = ["organisation", "roads", "construction", "trading"]; // trade-capable
  g.players[bot].stars = 500;
  g.players[bot].provoked = false;
  // Run several peaceful bot turns.
  for (let i = 0; i < 12; i++) ai.runAiTurn(g, bot);
  const mil = g.units.filter((u) => u.owner === bot && u.type !== "merchant");
  const warriors = mil.filter((u) => u.type === "warrior").length;
  const riders = mil.filter((u) => u.type === "rider").length;
  const catapults = mil.filter((u) => u.type === "catapult").length;
  const others = mil.filter((u) => !["warrior", "rider", "catapult"].includes(u.type)).length;
  ok("peaceful bot warriors <= 3", warriors <= 3);
  ok("peaceful bot riders <= 1", riders <= 1);
  ok("peaceful bot catapults <= 1", catapults <= 1);
  ok("peaceful bot trains no other military", others === 0);
  // The bot generated & stocked its own tribe material for sale.
  const { TRIBE_MATERIAL } = require("../src/game/data.ts");
  const mat = TRIBE_MATERIAL[g.players[bot].tribe];
  const merch = g.units.find((u) => u.owner === bot && u.type === "merchant");
  const sellsMat = !!merch && (merch.cargo ?? []).some((s) => s.good === mat && s.qty > 0);
  ok("peaceful bot sells its tribe material", sellsMat);
}
{
  // Peaceful bots walk one merchant to the human's capital so the player can trade ASAP.
  // The caravan must reliably PARK adjacent to the capital even across water/mountains.
  const ai = require("../src/game/ai.ts");
  const grid = require("../src/game/grid.ts");
  for (const mapType of ["pangea", "continents"]) {
    let g = generateGame({ tribe: "nature", opponents: 1, mapSize: 12, mapType, passAndPlay: false, seed: 7 });
    g.difficulty = "peaceful";
    g.players[1].techs = ["organisation", "roads", "construction", "trading"];
    g.players[1].stars = 500;
    g.players[1].provoked = false;
    const humanCap = g.cities.find((c) => c.owner === 0 && c.isCapital);
    for (let i = 0; i < 40; i++) {
      g.units.filter((u) => u.owner === 1).forEach((u) => { u.moved = false; u.attacked = false; }); // simulate turn start (startPlayerTurn)
      ai.runAiTurn(g, 1);
    }
    const merch = g.units.find((u) => u.owner === 1 && u.type === "merchant");
    ok(`peaceful bot trains a merchant (${mapType})`, !!merch);
    if (merch) {
      const dist = grid.chebyshev(g.tiles[merch.tileId], g.tiles[humanCap.tileId]);
      ok(`peaceful bot merchant parks beside the human capital (${mapType})`, dist <= 1);
      ok(`peaceful bot keeps exactly one merchant (${mapType})`, g.units.filter((u) => u.owner === 1 && u.type === "merchant").length === 1);
    }
  }
}

{
  // With MULTIPLE peaceful bots, EVERY bot must reach `trading`, train a merchant, and send
  // it to the human capital — not just one. (Regression: bots stalled without the trade tech.)
  const ai = require("../src/game/ai.ts");
  const grid = require("../src/game/grid.ts");
  let g = generateGame({ tribe: "nature", opponents: 3, mapSize: 16, mapType: "continents", passAndPlay: false, seed: 5 });
  g.difficulty = "peaceful";
  const bots = [1, 2, 3];
  bots.forEach((p) => { g.players[p].provoked = false; });
  const humanCap = g.cities.find((c) => c.owner === 0 && c.isCapital);
  for (let i = 0; i < 80; i++) {
    for (const p of bots) {
      g.players[p].stars += 10; // mimic per-turn city income (harness skips produce())
      g.units.filter((u) => u.owner === p).forEach((u) => { u.moved = false; u.attacked = false; });
      ai.runAiTurn(g, p);
    }
  }
  let allHave = true, allParked = true, allSingle = true;
  for (const p of bots) {
    const ms = g.units.filter((u) => u.owner === p && u.type === "merchant");
    if (ms.length !== 1) { allHave = ms.length >= 1 ? allHave : false; allSingle = false; }
    if (ms.length === 0) allHave = false;
    if (!ms.some((m) => grid.chebyshev(g.tiles[m.tileId], g.tiles[humanCap.tileId]) <= 1)) allParked = false;
  }
  ok("every peaceful bot trains a merchant", allHave);
  ok("every peaceful bot keeps exactly one merchant", allSingle);
  ok("every peaceful bot's merchant parks beside the human capital", allParked);
}


{
  // Provoked peaceful bot is no longer capped (can train non-militia units like archers).
  const ai = require("../src/game/ai.ts");
  let g = generateGame({ tribe: "nature", opponents: 1, mapSize: 16, mapType: "continents", passAndPlay: false, seed: 7 });
  g.difficulty = "peaceful";
  g.players[1].techs = ["forest_exploration", "hunting"]; // can train an archer
  g.players[1].stars = 500;
  g.players[1].provoked = true; // player attacked this bot
  for (let i = 0; i < 4; i++) ai.runAiTurn(g, 1);
  const mil = g.units.filter((u) => u.owner === 1 && u.type !== "merchant");
  ok("provoked peaceful bot lifts militia caps (trains an archer)", mil.some((u) => u.type === "archer"));
}

{
  // Villages must be at least 3 cells apart from each other across generated maps.
  const grid = require("../src/game/grid.ts");
  let minGap = Infinity, total = 0;
  for (const seed of [1, 2, 3, 7, 11]) {
    for (const mapType of ["pangea", "continents"]) {
      const g = generateGame({ tribe: "nature", opponents: 2, mapSize: 16, mapType, passAndPlay: false, seed });
      const vills = g.tiles.filter((t) => t.isVillage);
      total += vills.length;
      for (let a = 0; a < vills.length; a++)
        for (let b = a + 1; b < vills.length; b++)
          minGap = Math.min(minGap, grid.chebyshev(vills[a], vills[b]));
    }
  }
  ok("maps actually place villages", total > 0);
  ok("villages are at least 3 cells apart", minGap >= 3);
}



// ---- New: house road-connection bonus, building limits, per-tribe factory sizes ----
{
  let g = generateGame({ tribe: "nature", opponents: 1, mapSize: 14, mapType: "continents", passAndPlay: false, seed: 4 });
  const c = g.cities.find((ci) => ci.owner === 0);
  c.citadelStage = 10; g.players[0].stars = 500; g.players[0].goods.planks = 200;
  // Citadel occupies cells [12,18). Place a house at (9,13) (cells x9-10) and connect via a road at (11,13).
  engine.placeCityBuilding(g, 0, c.id, "house", 9, 13);
  const h = c.layout.buildings[0];
  c.population = 0; c.level = 20; // high level so +2 pop won't cross a level threshold
  const popBefore = c.population;
  ok("house not connected without a road", engine.connectedHouseCount(c) === 0 && !h.connected);
  engine.drawCityRoads(g, 0, c.id, [13 * 30 + 11]); // x=11 sits between the house (x10) and citadel (x12)
  ok("house connects via road", engine.connectedHouseCount(c) === 1 && h.connected === true);
  ok("connecting grants +2 population", c.population === popBefore + 2);
  ok("connected house adds +1 to city star income", engine.cityStarIncome(c) === c.production + 1);
  // Parks add +5 stars/turn each.
  const beforePark = engine.cityStarIncome(c);
  c.layout.buildings.push({ id: "pk1", type: "park", x: 0, y: 0 });
  ok("one park adds +5 stars/turn", engine.cityStarIncome(c) === beforePark + 5);
  c.layout.buildings.push({ id: "pk2", type: "park", x: 3, y: 3 });
  ok("two parks add +10 stars/turn", engine.cityStarIncome(c) === beforePark + 10);
  c.layout.buildings = c.layout.buildings.filter((b) => b.type !== "park");
  const popAfter = c.population;
  engine.drawCityRoads(g, 0, c.id, [13 * 30 + 11]); // idempotent — no duplicate road/bonus
  ok("reconnect does not re-grant population", c.population === popAfter);
}
{
  // Building limits by citadel stage.
  let g = generateGame({ tribe: "nature", opponents: 1, mapSize: 14, mapType: "continents", passAndPlay: false, seed: 4 });
  const c = g.cities.find((ci) => ci.owner === 0);
  g.players[0].stars = 999; g.players[0].goods = { ...g.players[0].goods, planks: 999, glass: 999 };
  c.citadelStage = 1;
  ok("stage 1: trade tower locked", !engine.canPlaceCityBuilding(g, 0, c.id, "trade_tower", 1, 1).ok);
  ok("stage 1: park locked", !engine.canPlaceCityBuilding(g, 0, c.id, "park", 1, 1).ok);
  engine.placeCityBuilding(g, 0, c.id, "house", 1, 1);
  ok("stage 1: 2nd house over limit", !engine.canPlaceCityBuilding(g, 0, c.id, "house", 4, 4).ok);
  c.citadelStage = 5;
  ok("stage 5: 2nd house allowed", engine.canPlaceCityBuilding(g, 0, c.id, "house", 4, 4).ok);
  ok("stage 5: park unlocked", engine.canPlaceCityBuilding(g, 0, c.id, "park", 20, 1).ok);
}
{
  // Per-tribe factory footprint: quarries are 4×4, sawmill/glass are 3×3.
  const { buildingSize } = require("../src/game/data.ts");
  ok("nature factory (sawmill) is 3", buildingSize("factory", "nature") === 3);
  ok("snow factory (glass) is 3", buildingSize("factory", "snow") === 3);
  ok("volcanic factory (stone quarry) is 4", buildingSize("factory", "volcanic") === 4);
  ok("desert factory (sand quarry) is 4", buildingSize("factory", "desert") === 4);
  // A 4×4 quarry must fit within the map (footprint respected).
  let g = generateGame({ tribe: "desert", opponents: 1, mapSize: 14, mapType: "continents", passAndPlay: false, seed: 4 });
  const c = g.cities.find((ci) => ci.owner === 0);
  ok("4x4 quarry off-map at (27,27)", !engine.canPlaceCityBuilding(g, 0, c.id, "factory", 27, 27).ok);
  ok("4x4 quarry ok at (1,1)", engine.canPlaceCityBuilding(g, 0, c.id, "factory", 1, 1).ok);
}


console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);