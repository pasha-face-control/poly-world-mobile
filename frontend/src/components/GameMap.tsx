import React, { useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Ellipse, Line, Polygon } from "react-native-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, shadow } from "@/src/theme";
import { BOAT_DEFS, BUILDING_BY_ID, RESOURCE_ICON, TERRAIN_COLOR, TRIBE_BY_ID, UNIT_DEFS } from "@/src/game/data";
import { canFish, canHunt } from "@/src/game/engine";
import { GameState } from "@/src/game/types";

// Pre-rendered low-poly 3D unit sprites, one per tribe colour.
const MODEL_SPRITES: Record<string, Record<string, number>> = {
  warrior: {
    nature: require("../../assets/images/warrior/warrior_nature.png"),
    desert: require("../../assets/images/warrior/warrior_desert.png"),
    volcanic: require("../../assets/images/warrior/warrior_volcanic.png"),
    snow: require("../../assets/images/warrior/warrior_snow.png"),
  },
  swordsmen: {
    nature: require("../../assets/images/swordsmen/swordsmen_nature.png"),
    desert: require("../../assets/images/swordsmen/swordsmen_desert.png"),
    volcanic: require("../../assets/images/swordsmen/swordsmen_volcanic.png"),
    snow: require("../../assets/images/swordsmen/swordsmen_snow.png"),
  },
  archer: {
    nature: require("../../assets/images/archer/archer_nature.png"),
    desert: require("../../assets/images/archer/archer_desert.png"),
    volcanic: require("../../assets/images/archer/archer_volcanic.png"),
    snow: require("../../assets/images/archer/archer_snow.png"),
  },
  rider: {
    nature: require("../../assets/images/rider/rider_nature.png"),
    desert: require("../../assets/images/rider/rider_desert.png"),
    volcanic: require("../../assets/images/rider/rider_volcanic.png"),
    snow: require("../../assets/images/rider/rider_snow.png"),
  },
  chivalry: {
    nature: require("../../assets/images/chivalry/chivalry_nature.png"),
    desert: require("../../assets/images/chivalry/chivalry_desert.png"),
    volcanic: require("../../assets/images/chivalry/chivalry_volcanic.png"),
    snow: require("../../assets/images/chivalry/chivalry_snow.png"),
  },
  pikemen: {
    nature: require("../../assets/images/pikemen/pikemen_nature.png"),
    desert: require("../../assets/images/pikemen/pikemen_desert.png"),
    volcanic: require("../../assets/images/pikemen/pikemen_volcanic.png"),
    snow: require("../../assets/images/pikemen/pikemen_snow.png"),
  },
  merchant: {
    nature: require("../../assets/images/merchant/merchant_nature.png"),
    desert: require("../../assets/images/merchant/merchant_desert.png"),
    volcanic: require("../../assets/images/merchant/merchant_volcanic.png"),
    snow: require("../../assets/images/merchant/merchant_snow.png"),
  },
  catapult: {
    nature: require("../../assets/images/catapult/catapult_nature.png"),
    desert: require("../../assets/images/catapult/catapult_desert.png"),
    volcanic: require("../../assets/images/catapult/catapult_volcanic.png"),
    snow: require("../../assets/images/catapult/catapult_snow.png"),
  },
  armored_rider: {
    nature: require("../../assets/images/armored_rider/armored_rider_nature.png"),
    desert: require("../../assets/images/armored_rider/armored_rider_desert.png"),
    volcanic: require("../../assets/images/armored_rider/armored_rider_volcanic.png"),
    snow: require("../../assets/images/armored_rider/armored_rider_snow.png"),
  },
  beefeater: {
    nature: require("../../assets/images/beefeater/beefeater_nature.png"),
    desert: require("../../assets/images/beefeater/beefeater_desert.png"),
    volcanic: require("../../assets/images/beefeater/beefeater_volcanic.png"),
    snow: require("../../assets/images/beefeater/beefeater_snow.png"),
  },
};

// Isometric (2.5D) metrics.
export const TILE = 76;
const HW = TILE / 2;
const HH = TILE / 4;
const PAD = TILE * 1.4;
const MH = 46; // mountain pyramid height

interface Props {
  state: GameState;
  fog: boolean;
  selectedUnitId: string | null;
  selectedTileId: number | null;
  reachable: number[];
  roadExtra?: number[];
  attackable: number[];
  centerTileId: number | null;
  focusTileId: number | null;
  focusKey: number;
  territory: Set<number>;
  territoryColor: string;
  moveAnim: { unitId: string; fromTileId: number; toTileId: number; key: number } | null;
  onTileTap: (tileId: number) => void;
  onTileDoubleTap: (tileId: number) => void;
}

function playerColor(state: GameState, owner: number): string {
  return TRIBE_BY_ID[state.players[owner].tribe].color;
}
function modelSprite(state: GameState, owner: number, type: string): number | null {
  const set = MODEL_SPRITES[type];
  if (!set) return null;
  return set[state.players[owner].tribe] ?? set.nature;
}
function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.substring(0, 2), 16)},${parseInt(h.substring(2, 4), 16)},${parseInt(h.substring(4, 6), 16)},${a})`;
}
function darken(hex: string, f: number): string {
  const h = hex.replace("#", "");
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${cl(parseInt(h.substring(0, 2), 16))},${cl(parseInt(h.substring(2, 4), 16))},${cl(parseInt(h.substring(4, 6), 16))})`;
}
type Pt = [number, number];
const pts = (arr: Pt[]) => arr.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

// Low-poly 3D unit pawn (tribe-colored gem on a disc base).
function drawUnit(arr: React.ReactNode[], bx: number, by: number, color: string, k: string | number) {
  const dk = darken(color, 0.66);
  const lt = darken(color, 1.18);
  const UB = 11;
  const UH = 28;
  const apex: Pt = [bx, by - 2 - UH];
  const ls: Pt = [bx - UB, by - 2 - UH * 0.5];
  const rs: Pt = [bx + UB, by - 2 - UH * 0.5];
  const waist: Pt = [bx, by - 4];
  arr.push(<Ellipse key={`ush${k}`} cx={bx} cy={by + 3} rx={12} ry={5} fill="rgba(0,0,0,0.22)" />);
  arr.push(<Ellipse key={`ubs${k}`} cx={bx} cy={by - 1} rx={11} ry={5} fill="#F8F6F0" stroke="rgba(0,0,0,0.18)" strokeWidth={1} />);
  arr.push(<Polygon key={`ul${k}`} points={pts([apex, ls, waist])} fill={dk} />);
  arr.push(<Polygon key={`ur${k}`} points={pts([apex, rs, waist])} fill={lt} />);
  arr.push(<Polygon key={`uo${k}`} points={pts([apex, ls, waist, rs])} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={1} />);
}

// Low-poly 3D building (walls + tribe-colored roof; flag if capital).
function drawCity(arr: React.ReactNode[], bx: number, by: number, color: string, capital: boolean, k: string | number) {
  const CB = 17;
  const cd = 9;
  const CH = 15;
  const roofH = 16;
  const fRight: Pt = [bx + CB, by];
  const fBottom: Pt = [bx, by + cd];
  const fLeft: Pt = [bx - CB, by];
  const tTop: Pt = [bx, by - cd - CH];
  const tRight: Pt = [bx + CB, by - CH];
  const tBottom: Pt = [bx, by + cd - CH];
  const tLeft: Pt = [bx - CB, by - CH];
  arr.push(<Ellipse key={`csh${k}`} cx={bx} cy={by + 3} rx={22} ry={8} fill="rgba(0,0,0,0.22)" />);
  arr.push(<Polygon key={`clw${k}`} points={pts([fLeft, fBottom, tBottom, tLeft])} fill="#DCD7C8" />);
  arr.push(<Polygon key={`crw${k}`} points={pts([fRight, fBottom, tBottom, tRight])} fill="#F8F6F0" stroke="rgba(0,0,0,0.12)" strokeWidth={1} />);
  arr.push(<Polygon key={`ct${k}`} points={pts([tTop, tRight, tBottom, tLeft])} fill="#FBFAF5" stroke="rgba(0,0,0,0.1)" strokeWidth={1} />);
  const apex: Pt = [bx, by - cd - CH - roofH];
  arr.push(<Polygon key={`rbl${k}`} points={pts([apex, tTop, tLeft])} fill={darken(color, 0.82)} />);
  arr.push(<Polygon key={`rbr${k}`} points={pts([apex, tTop, tRight])} fill={darken(color, 1.0)} />);
  arr.push(<Polygon key={`rl${k}`} points={pts([apex, tLeft, tBottom])} fill={darken(color, 0.66)} />);
  arr.push(<Polygon key={`rr${k}`} points={pts([apex, tRight, tBottom])} fill={darken(color, 1.12)} />);
  if (capital) {
    const poleTopY = apex[1] - 16;
    arr.push(<Polygon key={`cp${k}`} points={pts([[bx - 1.2, apex[1]], [bx + 1.2, apex[1]], [bx + 1.2, poleTopY], [bx - 1.2, poleTopY]])} fill="#6b6b6b" />);
    arr.push(<Polygon key={`cf${k}`} points={pts([[bx + 1.2, poleTopY], [bx + 15, poleTopY + 5], [bx + 1.2, poleTopY + 10]])} fill={color} />);
  }
}

// Simple isometric box (3 visible faces).
function isoBox(arr: React.ReactNode[], bx: number, byBottom: number, halfW: number, halfD: number, height: number, top: string, leftC: string, rightC: string, key: string) {
  const fRight: Pt = [bx + halfW, byBottom];
  const fBottom: Pt = [bx, byBottom + halfD];
  const fLeft: Pt = [bx - halfW, byBottom];
  const tTop: Pt = [bx, byBottom - halfD - height];
  const tRight: Pt = [bx + halfW, byBottom - height];
  const tBottom: Pt = [bx, byBottom + halfD - height];
  const tLeft: Pt = [bx - halfW, byBottom - height];
  arr.push(<Polygon key={`${key}L`} points={pts([fLeft, fBottom, tBottom, tLeft])} fill={leftC} />);
  arr.push(<Polygon key={`${key}R`} points={pts([fRight, fBottom, tBottom, tRight])} fill={rightC} />);
  arr.push(<Polygon key={`${key}T`} points={pts([tTop, tRight, tBottom, tLeft])} fill={top} />);
}

// Low-poly 3D bull (wild animal).
function drawBull(arr: React.ReactNode[], bx: number, by: number, k: string | number) {
  const S = 0.5;
  const P = (dx: number, dy: number): Pt => [bx + dx * S, by + dy * S];
  const bodyT = "#9A6A3E";
  const bodyL = "#5C3A20";
  const bodyR = "#7A4E2C";
  const headT = "#8A5A34";
  const headL = "#4E3220";
  const headR = "#6E4526";
  const horn = "#ECE4CE";
  const hoof = "#33231A";
  arr.push(<Ellipse key={`ash${k}`} cx={bx} cy={by + 2 * S} rx={20 * S} ry={6 * S} fill="rgba(0,0,0,0.22)" />);
  // legs
  const legs: Pt[] = [[-10, -3], [8, -3], [-4, 5], [12, 5]];
  legs.forEach((o, i) => {
    arr.push(<Polygon key={`al${k}_${i}`} points={pts([P(o[0] - 2.5, o[1]), P(o[0] + 2.5, o[1]), P(o[0] + 2.5, o[1] - 11), P(o[0] - 2.5, o[1] - 11)])} fill={hoof} />);
  });
  // body
  isoBox(arr, bx - 3 * S, by - 10 * S, 18 * S, 10 * S, 14 * S, bodyT, bodyL, bodyR, `ab${k}`);
  // head (front-right)
  isoBox(arr, bx + 17 * S, by - 9 * S, 9 * S, 6 * S, 10 * S, headT, headL, headR, `ahd${k}`);
  // horns
  arr.push(<Polygon key={`ahl${k}`} points={pts([P(11, -24), P(4, -35), P(16, -28)])} fill={horn} />);
  arr.push(<Polygon key={`ahr${k}`} points={pts([P(23, -24), P(30, -35), P(18, -28)])} fill={horn} />);
  // snout
  arr.push(<Polygon key={`asn${k}`} points={pts([P(26, -11), P(31, -13), P(31, -6), P(26, -4)])} fill="#3A2A1D" />);
}

// Low-poly 3D boat (hull + tribe-colored sail). Bigger/darker for higher tiers.
function drawBoat(arr: React.ReactNode[], bx: number, by: number, color: string, tier: string, k: string | number) {
  const hullTop = tier === "battleship" ? "#3A2E22" : "#6B4A2A";
  const hullSide = tier === "battleship" ? "#241C14" : "#4A3320";
  const w = tier === "rowing" ? 15 : 18;
  const d = 6;
  arr.push(<Ellipse key={`bsh${k}`} cx={bx} cy={by + 3} rx={w + 3} ry={5} fill="rgba(0,0,0,0.22)" />);
  // hull (boat-shaped trapezoid, isometric)
  const hl: Pt = [bx - w, by - 3];
  const hr: Pt = [bx + w, by - 3];
  const bl: Pt = [bx - w * 0.6, by + d];
  const br: Pt = [bx + w * 0.6, by + d];
  arr.push(<Polygon key={`bh${k}`} points={pts([hl, hr, br, bl])} fill={hullTop} stroke="rgba(0,0,0,0.2)" strokeWidth={1} />);
  arr.push(<Polygon key={`bhs${k}`} points={pts([bl, br, [bx + w * 0.6, by + d + 4], [bx - w * 0.6, by + d + 4]])} fill={hullSide} />);
  // mast + sail
  const mastTop = by - 3 - (tier === "rowing" ? 20 : 26);
  arr.push(<Polygon key={`bm${k}`} points={pts([[bx - 1, by - 3], [bx + 1, by - 3], [bx + 1, mastTop], [bx - 1, mastTop]])} fill="#5a4632" />);
  arr.push(<Polygon key={`bsl${k}`} points={pts([[bx + 1.5, mastTop + 2], [bx + 1.5, by - 6], [bx + 13, by - 10]])} fill={color} stroke="rgba(255,255,255,0.5)" strokeWidth={1} />);
  if (tier === "battleship") {
    arr.push(<Polygon key={`bg${k}`} points={pts([[bx - w, by - 3], [bx - w - 6, by - 6], [bx - w, by - 7]])} fill="#222" />);
  }
}

// Wooden dock (port) on a water tile.
function drawDock(arr: React.ReactNode[], bx: number, by: number, k: string | number) {
  isoBox(arr, bx, by + 2, 10, 5, 5, "#9A7B4F", "#5C4326", "#7A5A34", `dk${k}`);
  arr.push(<Polygon key={`dpost${k}`} points={pts([[bx + 7, by - 2], [bx + 9, by - 2], [bx + 9, by - 14], [bx + 7, by - 14]])} fill="#5C4326" />);
}

export default function GameMap({ state, fog, selectedUnitId, selectedTileId, reachable, roadExtra = [], attackable, centerTileId, focusTileId, focusKey, territory, territoryColor, moveAnim, onTileTap, onTileDoubleTap }: Props) {
  const [rotation, setRotation] = useState(0); // 0..3 camera angle
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(0.9);
  const viewport = useRef({ w: 0, h: 0 });
  const centered = useRef(false);

  // Unit move animation (glides the moving token from its old tile to the new one).
  const animOffX = useSharedValue(0);
  const animOffY = useSharedValue(0);
  const animPos = useRef({ x: 0, y: 0 });
  const [animUnit, setAnimUnit] = useState<{ id: string; color: string; icon: string; boat: string | null; sprite: number | null } | null>(null);

  // Gentle pulse for the "huntable" glow around wild animals inside your borders.
  const glowPulse = useSharedValue(0);
  useEffect(() => {
    glowPulse.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
  }, [glowPulse]);
  const huntGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + glowPulse.value * 0.45,
    transform: [{ scale: 0.85 + glowPulse.value * 0.3 }],
  }));

  const w = state.width;
  const h = state.height;
  const even = rotation % 2 === 0;
  const Wv = even ? w : h;
  const Hv = even ? h : w;

  // Grid (x,y) -> rotated view coords (vx,vy).
  const toView = (x: number, y: number): Pt => {
    switch (rotation) {
      case 1: return [y, w - 1 - x];
      case 2: return [w - 1 - x, h - 1 - y];
      case 3: return [h - 1 - y, x];
      default: return [x, y];
    }
  };
  // Inverse: view (vx,vy) -> grid (x,y).
  const fromView = (vx: number, vy: number): Pt => {
    switch (rotation) {
      case 1: return [w - 1 - vy, vx];
      case 2: return [w - 1 - vx, h - 1 - vy];
      case 3: return [vy, h - 1 - vx];
      default: return [vx, vy];
    }
  };

  const originX = (Hv - 1) * HW + PAD;
  const originY = PAD;
  const boardW = (Wv + Hv) * HW + PAD * 2;
  const boardH = (Wv + Hv) * HH + PAD * 2 + MH;

  const project = (vx: number, vy: number): Pt => [(vx - vy) * HW + originX, (vx + vy) * HH + originY];

  const centerOn = (tileId: number) => {
    const t = state.tiles[tileId];
    const [vx, vy] = toView(t.x, t.y);
    const [cx, cy] = project(vx, vy);
    const s = scale.value;
    tx.value = withTiming(viewport.current.w / 2 - cx * s);
    ty.value = withTiming(viewport.current.h / 2 - cy * s);
  };

  useEffect(() => {
    centered.current = false;
  }, [state.id]);

  useEffect(() => {
    if (focusKey > 0 && focusTileId != null && viewport.current.w > 0) centerOn(focusTileId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  // Glide the moving unit from its old tile to the new one.
  useEffect(() => {
    if (!moveAnim) return;
    const unit = state.units.find((u) => u.id === moveAnim.unitId);
    const from = state.tiles[moveAnim.fromTileId];
    const to = state.tiles[moveAnim.toTileId];
    if (!unit || !from || !to) return;
    const [fvx, fvy] = toView(from.x, from.y);
    const [fx, fy] = project(fvx, fvy);
    const [tvx, tvy] = toView(to.x, to.y);
    const [txp, typ] = project(tvx, tvy);
    animPos.current = { x: txp, y: typ };
    animOffX.value = fx - txp;
    animOffY.value = fy - typ;
    setAnimUnit({ id: unit.id, color: playerColor(state, unit.owner), icon: unit.boat ? BOAT_DEFS[unit.boat].icon : UNIT_DEFS[unit.type].icon, boat: unit.boat, sprite: !unit.boat ? modelSprite(state, unit.owner, unit.type) : null });
    animOffX.value = withTiming(0, { duration: 300 });
    animOffY.value = withTiming(0, { duration: 300 }, (fin) => {
      if (fin) runOnJS(setAnimUnit)(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveAnim?.key]);

  useEffect(() => {
    if (viewport.current.w > 0 && centerTileId != null) centerOn(centerTileId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotation]);

  const onLayout = (e: LayoutChangeEvent) => {
    viewport.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
    if (!centered.current && centerTileId != null) {
      centered.current = true;
      centerOn(centerTileId);
    }
  };

  const handleView = (vx: number, vy: number) => {
    const [x, y] = fromView(vx, vy);
    if (x >= 0 && y >= 0 && x < w && y < h) onTileTap(y * w + x);
  };

  const handleViewDouble = (vx: number, vy: number) => {
    const [x, y] = fromView(vx, vy);
    if (x >= 0 && y >= 0 && x < w && y < h) onTileDoubleTap(y * w + x);
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.min(2.2, Math.max(0.4, startScale.value * e.scale));
    });

  const rotate = Gesture.Rotation().onEnd((e) => {
    if (e.rotation > 0.45) runOnJS(setRotation)((rotation + 1) % 4);
    else if (e.rotation < -0.45) runOnJS(setRotation)((rotation + 3) % 4);
  });

  const oX = originX;
  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e) => {
      const a = (e.x - oX) / HW;
      const b = (e.y - originY) / HH;
      const vx = Math.round((a + b) / 2);
      const vy = Math.round((b - a) / 2);
      runOnJS(handleView)(vx, vy);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd((e) => {
      const a = (e.x - oX) / HW;
      const b = (e.y - originY) / HH;
      const vx = Math.round((a + b) / 2);
      const vy = Math.round((b - a) / 2);
      runOnJS(handleViewDouble)(vx, vy);
    });

  const composed = Gesture.Race(Gesture.Simultaneous(pan, pinch, rotate), Gesture.Exclusive(doubleTap, tap));
  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));
  const animTokenStyle = useAnimatedStyle(() => ({ transform: [{ translateX: animOffX.value }, { translateY: animOffY.value }] }));

  const reachableSet = useMemo(() => new Set(reachable), [reachable]);
  const roadExtraSet = useMemo(() => new Set(roadExtra), [roadExtra]);
  const attackableSet = useMemo(() => new Set(attackable), [attackable]);
  const terFill = useMemo(() => hexToRgba(territoryColor, 0.32), [territoryColor]);

  const inTer = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && territory.has(y * w + x);

  // Depth-sorted tiles (far -> near) for the current rotation.
  const ordered = useMemo(() => {
    return state.tiles
      .map((t) => {
        const [vx, vy] = toView(t.x, t.y);
        return { t, vx, vy };
      })
      .sort((p, q) => p.vx + p.vy - (q.vx + q.vy));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, rotation]);

  // Build SVG terrain polygons.
  const terrainShapes: React.ReactNode[] = [];
  for (const { t, vx, vy } of ordered) {
    const [cx, cy] = project(vx, vy);
    const top: Pt = [cx, cy - HH];
    const right: Pt = [cx + HW, cy];
    const bottom: Pt = [cx, cy + HH];
    const left: Pt = [cx - HW, cy];
    const hidden = fog && !t.explored;
    const col = hidden ? C.surfaceInverse : TERRAIN_COLOR[t.terrain];
    const k = t.id;

    if (hidden) {
      terrainShapes.push(<Polygon key={`g${k}`} points={pts([top, right, bottom, left])} fill={col} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />);
      continue;
    }

    if (t.terrain === "mountain") {
      // Ground base
      terrainShapes.push(<Polygon key={`b${k}`} points={pts([top, right, bottom, left])} fill={darken(col, 0.72)} stroke="rgba(0,0,0,0.2)" strokeWidth={1} />);
      const apex: Pt = [cx, cy - HH - MH];
      // Back faces (subtle) then front faces
      terrainShapes.push(<Polygon key={`mbl${k}`} points={pts([apex, top, left])} fill={darken(col, 0.85)} />);
      terrainShapes.push(<Polygon key={`mbr${k}`} points={pts([apex, top, right])} fill={darken(col, 1.05)} />);
      terrainShapes.push(<Polygon key={`ml${k}`} points={pts([apex, left, bottom])} fill={darken(col, 0.7)} />);
      terrainShapes.push(<Polygon key={`mr${k}`} points={pts([apex, right, bottom])} fill={darken(col, 0.95)} />);
      // Snow cap
      const capY = cy - HH - MH * 0.5;
      terrainShapes.push(<Polygon key={`mc${k}`} points={pts([apex, [cx - HW * 0.26, capY], [cx + HW * 0.26, capY]])} fill="#F4F4F2" />);
    } else {
      // grass, water & forest are all flat ground (forest shows trees on top)
      terrainShapes.push(<Polygon key={`g${k}`} points={pts([top, right, bottom, left])} fill={col} stroke="rgba(0,0,0,0.15)" strokeWidth={1} />);
    }

    // Surface overlays (territory / move / attack / selected)
    const sTop: Pt = [cx, cy - HH];
    const sRight: Pt = [cx + HW, cy];
    const sBottom: Pt = [cx, cy + HH];
    const sLeft: Pt = [cx - HW, cy];
    const surface = [sTop, sRight, sBottom, sLeft];
    if (territory.has(k)) {
      const boundary = !inTer(t.x, t.y - 1) || !inTer(t.x, t.y + 1) || !inTer(t.x - 1, t.y) || !inTer(t.x + 1, t.y);
      terrainShapes.push(<Polygon key={`ter${k}`} points={pts(surface)} fill={terFill} stroke={boundary ? territoryColor : "transparent"} strokeWidth={3} />);
    }
    if (reachableSet.has(k)) {
      const road = roadExtraSet.has(k);
      terrainShapes.push(
        <Polygon
          key={`rc${k}`}
          points={pts(surface)}
          fill={road ? "rgba(255,236,150,0.9)" : "rgba(229,169,58,0.62)"}
          stroke={road ? "#FFFFFF" : "#FFD24A"}
          strokeWidth={road ? 5 : 4}
        />
      );
    }
    if (attackableSet.has(k)) terrainShapes.push(<Polygon key={`at${k}`} points={pts(surface)} fill="rgba(188,71,73,0.6)" stroke="#FF5A5C" strokeWidth={4} />);
    if (selectedTileId === k) terrainShapes.push(<Polygon key={`sel${k}`} points={pts(surface)} fill="transparent" stroke="#FFFFFF" strokeWidth={3} />);

    // Roads: bed diamond + segments to adjacent road tiles.
    if (t.road) {
      terrainShapes.push(<Polygon key={`road${k}`} points={pts([[cx, cy - HH * 0.5], [cx + HW * 0.5, cy], [cx, cy + HH * 0.5], [cx - HW * 0.5, cy]])} fill="#8A7B5C" />);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = t.x + dx;
          const ny = t.y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nid = ny * w + nx;
          if (nid <= t.id) continue;
          const nt = state.tiles[nid];
          if (!nt.road || (fog && !nt.explored)) continue;
          const [nvx, nvy] = toView(nx, ny);
          const [ncx, ncy] = project(nvx, nvy);
          terrainShapes.push(<Line key={`rl${k}_${nid}`} x1={cx} y1={cy} x2={ncx} y2={ncy} stroke="#8A7B5C" strokeWidth={7} strokeLinecap="round" />);
        }
    }

    // 3D pieces (drawn in depth order with terrain)
    const tokLift = t.terrain === "mountain" ? HH + MH * 0.55 : 0;
    const surfY = cy - tokLift;
    const city = t.cityId ? state.cities.find((c) => c.id === t.cityId) : undefined;
    const unit = state.units.find((u) => u.tileId === t.id);
    if (t.port && !city) drawDock(terrainShapes, cx, surfY, k);
    if (city) drawCity(terrainShapes, cx, surfY, playerColor(state, city.owner), city.isCapital, k);
    else if (t.isVillage) drawCity(terrainShapes, cx, surfY, t.claimBy != null ? playerColor(state, t.claimBy) : C.borderStrong, false, k);
    if (unit && !city && unit.id !== animUnit?.id) {
      if (unit.boat) drawBoat(terrainShapes, cx, surfY, playerColor(state, unit.owner), unit.boat, k);
      else if (!MODEL_SPRITES[unit.type]) drawUnit(terrainShapes, cx, surfY, playerColor(state, unit.owner), k);
    } else if (!city && t.resource === "animal" && !t.building) drawBull(terrainShapes, cx - 4, surfY, k);
  }

  return (
    <View style={styles.viewport} onLayout={onLayout}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[{ width: boardW, height: boardH }, animStyle]}>
          <Svg width={boardW} height={boardH} style={StyleSheet.absoluteFill}>
            {terrainShapes}
          </Svg>

          {ordered.map(({ t, vx, vy }) => {
            const hidden = fog && !t.explored;
            if (hidden) return null;
            const [cx, cy] = project(vx, vy);
            const lift = t.terrain === "mountain" ? HH + MH * 0.55 : 0;
            const baseY = cy - lift;
            const unit = state.units.find((u) => u.tileId === t.id);
            const city = t.cityId ? state.cities.find((c) => c.id === t.cityId) : undefined;
            const pc = unit ? playerColor(state, unit.owner) : "#000";

            return (
              <React.Fragment key={`tok${t.id}`}>
                {t.resource === "animal" && !city && !unit && !t.building && canHunt(state, state.currentPlayer, t.id).ok && (
                  <Animated.View pointerEvents="none" style={[styles.huntGlow, { left: cx - 22, top: baseY - 20 }, huntGlowStyle]} />
                )}
                {t.resource === "fish" && !city && !unit && !t.building && canFish(state, state.currentPlayer, t.id).ok && (
                  <Animated.View pointerEvents="none" style={[styles.huntGlow, { left: cx - 22, top: baseY - 20 }, huntGlowStyle]} />
                )}
                {t.terrain === "forest" && !city && !unit && !t.building && (
                  <MaterialCommunityIcons name="pine-tree" size={26} color="#CBD6AE" style={{ position: "absolute", left: cx - 13, top: baseY - 24 }} />
                )}
                {t.building && !city && !unit && (
                  <View style={[styles.building, { left: cx - 15, top: baseY - 30, backgroundColor: BUILDING_BY_ID[t.building]?.color ?? C.brand }]}>
                    <MaterialCommunityIcons name={(BUILDING_BY_ID[t.building]?.icon ?? "home") as any} size={18} color="#fff" />
                  </View>
                )}
                {t.resource && t.resource !== "animal" && !city && !unit && !t.building && (
                  <View style={[styles.resourceBadge, { left: cx + 6, top: baseY - 16 }]}>
                    <MaterialCommunityIcons name={RESOURCE_ICON[t.resource] as any} size={13} color={C.onSurface} />
                  </View>
                )}
                {city && (
                  <View style={[styles.cityLevel, { left: cx + 8, top: baseY - 8, backgroundColor: playerColor(state, city.owner) }]}>
                    <Text style={styles.cityLevelText}>{city.level}</Text>
                  </View>
                )}
                {t.isVillage && t.claimBy != null && !city && (
                  <View style={[styles.claimRing, { left: cx - 12, top: baseY - 36, borderColor: playerColor(state, t.claimBy) }]}>
                    <MaterialCommunityIcons name="timer-sand" size={13} color={playerColor(state, t.claimBy)} />
                  </View>
                )}
                {unit && city && (
                  <View
                    style={[
                      styles.garrison,
                      { left: cx - 24, top: baseY - 28, backgroundColor: playerColor(state, unit.owner), borderColor: selectedTileId === t.id ? "#FFFFFF" : "rgba(0,0,0,0.35)" },
                    ]}
                  >
                    <MaterialCommunityIcons name={(unit.boat ? BOAT_DEFS[unit.boat].icon : UNIT_DEFS[unit.type].icon) as any} size={13} color="#fff" />
                  </View>
                )}
                {unit && !city && unit.id !== animUnit?.id && (
                  <>
                    {!unit.boat && MODEL_SPRITES[unit.type] && (
                      <Image
                        source={modelSprite(state, unit.owner, unit.type)!}
                        pointerEvents="none"
                        style={{ position: "absolute", left: cx - 40, top: baseY - 54, width: 80, height: 66 }}
                        resizeMode="contain"
                      />
                    )}
                    <MaterialCommunityIcons
                      name={(unit.boat ? BOAT_DEFS[unit.boat].icon : UNIT_DEFS[unit.type].icon) as any}
                      size={17}
                      color="#FFFFFF"
                      style={{ position: "absolute", left: cx - 8.5, top: (!unit.boat && MODEL_SPRITES[unit.type] ? baseY - 66 : baseY - 24) }}
                    />
                    <View style={[styles.hpBarBg, { left: cx - 14, top: baseY + 5 }]}>
                      <View style={[styles.hpBar, { width: `${Math.max(0, (unit.hp / unit.maxHp) * 100)}%` }]} />
                    </View>
                    {unit.moved && unit.attacked && <View style={[styles.doneDot, { left: cx + 9, top: baseY - 30 }]} />}
                    {selectedTileId === t.id && <View style={[styles.selRing, { left: cx - 6, top: baseY - 40, borderColor: pc }]} />}
                  </>
                )}
              </React.Fragment>
            );
          })}

          {animUnit && (
            <Animated.View
              pointerEvents="none"
              style={[{ position: "absolute", left: animPos.current.x - 30, top: animPos.current.y - 48, width: 60, height: 64 }, animTokenStyle]}
            >
              {animUnit.sprite ? (
                <Image source={animUnit.sprite} pointerEvents="none" style={{ position: "absolute", left: -10, top: -6, width: 80, height: 66 }} resizeMode="contain" />
              ) : (
                <Svg width={60} height={64}>
                  {(() => {
                    const arr: React.ReactNode[] = [];
                    if (animUnit.boat) drawBoat(arr, 30, 48, animUnit.color, animUnit.boat, "anim");
                    else drawUnit(arr, 30, 48, animUnit.color, "anim");
                    return arr;
                  })()}
                </Svg>
              )}
              <MaterialCommunityIcons name={animUnit.icon as any} size={17} color="#FFFFFF" style={{ position: "absolute", left: 21.5, top: animUnit.sprite ? -18 : 24 }} />
            </Animated.View>
          )}
        </Animated.View>
      </GestureDetector>

      {/* Rotate-view controls */}
      <View style={styles.rotateControls} pointerEvents="box-none">
        <Pressable testID="rotate-left" onPress={() => setRotation((rotation + 3) % 4)} style={styles.rotateBtn}>
          <MaterialCommunityIcons name="rotate-left" size={22} color={C.onSurface} />
        </Pressable>
        <Pressable testID="rotate-right" onPress={() => setRotation((rotation + 1) % 4)} style={styles.rotateBtn}>
          <MaterialCommunityIcons name="rotate-right" size={22} color={C.onSurface} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: "hidden", backgroundColor: "#12312e" },
  resourceBadge: { position: "absolute", backgroundColor: "rgba(248,246,240,0.92)", borderRadius: 6, padding: 2 },
  building: { position: "absolute", width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff", ...shadow(3) },
  cityLevel: { position: "absolute", minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 3, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#fff" },
  cityLevelText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  garrison: { position: "absolute", width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 2, ...shadow(3) },
  hpBarBg: { position: "absolute", width: 28, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.4)", overflow: "hidden" },
  hpBar: { height: 4, backgroundColor: C.success },
  doneDot: { position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: C.borderStrong, borderWidth: 1, borderColor: "#fff" },
  selRing: { position: "absolute", width: 12, height: 12, borderRadius: 6, borderWidth: 3, backgroundColor: "transparent" },
  claimRing: { position: "absolute", width: 24, height: 24, borderRadius: 12, borderWidth: 2, backgroundColor: "rgba(248,246,240,0.9)", alignItems: "center", justifyContent: "center", ...shadow(3) },
  huntGlow: { position: "absolute", width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: "#F2C14E", backgroundColor: "rgba(242,193,78,0.18)", shadowColor: "#F2C14E", shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  rotateControls: { position: "absolute", left: 12, bottom: 120, flexDirection: "row", gap: 8 },
  rotateBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(248,246,240,0.9)", alignItems: "center", justifyContent: "center", ...shadow(4) },
});
