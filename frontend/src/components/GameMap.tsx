import React, { useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Ellipse, Polygon } from "react-native-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, shadow } from "@/src/theme";
import { RESOURCE_ICON, TERRAIN_COLOR, TRIBE_BY_ID, UNIT_DEFS } from "@/src/game/data";
import { GameState } from "@/src/game/types";

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
  attackable: number[];
  centerTileId: number | null;
  focusTileId: number | null;
  focusKey: number;
  territory: Set<number>;
  territoryColor: string;
  onTileTap: (tileId: number) => void;
}

function playerColor(state: GameState, owner: number): string {
  return TRIBE_BY_ID[state.players[owner].tribe].color;
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

export default function GameMap({ state, fog, selectedUnitId, selectedTileId, reachable, attackable, centerTileId, focusTileId, focusKey, territory, territoryColor, onTileTap }: Props) {
  const [rotation, setRotation] = useState(0); // 0..3 camera angle
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(0.9);
  const viewport = useRef({ w: 0, h: 0 });
  const centered = useRef(false);

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

  const composed = Gesture.Race(Gesture.Simultaneous(pan, pinch, rotate), tap);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));

  const reachableSet = useMemo(() => new Set(reachable), [reachable]);
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
    if (reachableSet.has(k)) terrainShapes.push(<Polygon key={`rc${k}`} points={pts(surface)} fill="rgba(229,169,58,0.45)" stroke={C.warning} strokeWidth={3} />);
    if (attackableSet.has(k)) terrainShapes.push(<Polygon key={`at${k}`} points={pts(surface)} fill="rgba(188,71,73,0.45)" stroke={C.error} strokeWidth={3} />);
    if (selectedTileId === k) terrainShapes.push(<Polygon key={`sel${k}`} points={pts(surface)} fill="transparent" stroke="#FFFFFF" strokeWidth={3} />);

    // 3D pieces (drawn in depth order with terrain)
    const tokLift = t.terrain === "mountain" ? HH + MH * 0.55 : 0;
    const surfY = cy - tokLift;
    const city = t.cityId ? state.cities.find((c) => c.id === t.cityId) : undefined;
    const unit = state.units.find((u) => u.tileId === t.id);
    if (city) drawCity(terrainShapes, cx, surfY, playerColor(state, city.owner), city.isCapital, k);
    else if (t.isVillage) drawCity(terrainShapes, cx, surfY, C.borderStrong, false, k);
    if (unit && !city) drawUnit(terrainShapes, cx, surfY, playerColor(state, unit.owner), k);
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
                {t.terrain === "forest" && !city && !unit && (
                  <MaterialCommunityIcons name="pine-tree" size={26} color="#CBD6AE" style={{ position: "absolute", left: cx - 13, top: baseY - 24 }} />
                )}
                {t.resource && !city && !unit && (
                  <View style={[styles.resourceBadge, { left: cx + 6, top: baseY - 16 }]}>
                    <MaterialCommunityIcons name={RESOURCE_ICON[t.resource] as any} size={13} color={C.onSurface} />
                  </View>
                )}
                {city && (
                  <View style={[styles.cityLevel, { left: cx + 8, top: baseY - 8, backgroundColor: playerColor(state, city.owner) }]}>
                    <Text style={styles.cityLevelText}>{city.level}</Text>
                  </View>
                )}
                {unit && !city && (
                  <>
                    <MaterialCommunityIcons
                      name={UNIT_DEFS[unit.type].icon as any}
                      size={17}
                      color="#FFFFFF"
                      style={{ position: "absolute", left: cx - 8.5, top: baseY - 24 }}
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
  cityLevel: { position: "absolute", minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 3, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#fff" },
  cityLevelText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  hpBarBg: { position: "absolute", width: 28, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.4)", overflow: "hidden" },
  hpBar: { height: 4, backgroundColor: C.success },
  doneDot: { position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: C.borderStrong, borderWidth: 1, borderColor: "#fff" },
  selRing: { position: "absolute", width: 12, height: 12, borderRadius: 6, borderWidth: 3, backgroundColor: "transparent" },
  rotateControls: { position: "absolute", left: 12, bottom: 120, flexDirection: "row", gap: 8 },
  rotateBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(248,246,240,0.9)", alignItems: "center", justifyContent: "center", ...shadow(4) },
});
