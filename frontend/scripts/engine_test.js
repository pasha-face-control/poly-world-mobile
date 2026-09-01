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

// ---- Merchant Ship: 8 slots, 32/slot ----
{
  // ensure merch is on a port so it can embark
  const grid = require("../src/game/grid.ts");
  let portT = s.tiles.find((t) => t.terrain === "water" && grid.neighbors(s, t.id).some((n) => s.tiles[n].terrain !== "water"));
  if (portT) {
    portT.port = true;
    merch.tileId = portT.id;
    merch.boat = null;
    if (!player.techs.includes("sailing")) player.techs.push("sailing");
    ok("embark merchant -> ship", engine.embark(s, merch.id) && merch.boat === "rowing");
    ok("ship has 8 slots", merch.cargo.length === 8);
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
  const built = engine.doInfra(s, P, portTile.id, "port");
  ok("build port", built && s.tiles[portTile.id].port === true);
  // place a warrior on the port tile (simulate having moved there) and embark
  const { newUnit } = require("../src/game/factory.ts");
  const w = newUnit("warrior", P, portTile.id);
  s.units.push(w);
  ok("can embark on port", engine.canEmbark(s, w.id).ok);
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
  rcap.population = 1; // one harvest (levelThreshold(1)=2) will level it up
  player.stars = 50;
  const before = (s.pendingLevelUps || []).length;
  engine.harvest(s, P, ftile.id);
  ok("human city level up enqueued", s.pendingLevelUps.length > before && s.pendingLevelUps.includes(rcap.id));
  const prodBefore = rcap.production;
  ok("apply workshop reward", engine.applyLevelReward(s, rcap.id, "workshop") && rcap.production === prodBefore + 1);
  ok("pending cleared", !s.pendingLevelUps.includes(rcap.id));
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

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);