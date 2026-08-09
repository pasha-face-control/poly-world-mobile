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

// ---- Merchant load + price + trade ----
player.goods.wood = 10;
ok("load 3 wood", engine.loadMerchant(s, merch.id, "wood", 3) && merch.cargo.wood === 3);
ok("stockpile reduced", player.goods.wood === 7);
ok("unload 1 wood", engine.loadMerchant(s, merch.id, "wood", -1) && merch.cargo.wood === 2);
engine.setMerchantPrice(s, merch.id, 5);
ok("price set", merch.price === 5);
// bot buys: give bot stars
const bot = s.players[1];
bot.stars = 100;
const ownerStarsBefore = player.stars;
engine.resolveTrades(s);
ok("bot bought (cargo down)", merch.cargo.wood === 1);
ok("owner earned stars", player.stars === ownerStarsBefore + 5);
ok("bot spent stars & got good", bot.stars === 95 && bot.goods.wood >= 1);

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

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
