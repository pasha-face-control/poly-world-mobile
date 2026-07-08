import React, { useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Polygon } from "react-native-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, shadow } from "@/src/theme";
import { RESOURCE_ICON, TERRAIN_COLOR, TRIBE_BY_ID, UNIT_DEFS } from "@/src/game/data";
import { GameState } from "@/src/game/types";

// Isometric (2.5D) metrics.
export const TILE = 76;
const HW = TILE / 2;
const HH = TILE / 4;
const PAD = TILE * 1.4;
const FE = 15; // forest plateau height
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
  const r = Math.round(parseInt(h.substring(0, 2), 16) * f);
  const g = Math.round(parseInt(h.substring(2, 4), 16) * f);
  const b = Math.round(parseInt(h.substring(4, 6), 16) * f);
  return `rgb(${r},${g},${b})`;
}
type Pt = [number, number];
const pts = (arr: Pt[]) => arr.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

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
    } else if (t.terrain === "forest") {
      const tTop: Pt = [cx, cy - HH - FE];
      const tRight: Pt = [cx + HW, cy - FE];
      const tBottom: Pt = [cx, cy + HH - FE];
      const tLeft: Pt = [cx - HW, cy - FE];
      terrainShapes.push(<Polygon key={`fl${k}`} points={pts([left, bottom, tBottom, tLeft])} fill={darken(col, 0.62)} />);
      terrainShapes.push(<Polygon key={`fr${k}`} points={pts([right, bottom, tBottom, tRight])} fill={darken(col, 0.78)} />);
      terrainShapes.push(<Polygon key={`ft${k}`} points={pts([tTop, tRight, tBottom, tLeft])} fill={col} stroke="rgba(0,0,0,0.18)" strokeWidth={1} />);
    } else {
      terrainShapes.push(<Polygon key={`g${k}`} points={pts([top, right, bottom, left])} fill={col} stroke="rgba(0,0,0,0.15)" strokeWidth={1} />);
    }

    // Surface overlays (territory / move / attack / selected)
    const lift = t.terrain === "forest" ? FE : 0;
    const sTop: Pt = [cx, cy - HH - lift];
    const sRight: Pt = [cx + HW, cy - lift];
    const sBottom: Pt = [cx, cy + HH - lift];
    const sLeft: Pt = [cx - HW, cy - lift];
    const surface = [sTop, sRight, sBottom, sLeft];
    if (territory.has(k)) {
      const boundary = !inTer(t.x, t.y - 1) || !inTer(t.x, t.y + 1) || !inTer(t.x - 1, t.y) || !inTer(t.x + 1, t.y);
      terrainShapes.push(<Polygon key={`ter${k}`} points={pts(surface)} fill={terFill} stroke={boundary ? territoryColor : "transparent"} strokeWidth={3} />);
    }
    if (reachableSet.has(k)) terrainShapes.push(<Polygon key={`rc${k}`} points={pts(surface)} fill="rgba(229,169,58,0.45)" stroke={C.warning} strokeWidth={3} />);
    if (attackableSet.has(k)) terrainShapes.push(<Polygon key={`at${k}`} points={pts(surface)} fill="rgba(188,71,73,0.45)" stroke={C.error} strokeWidth={3} />);
    if (selectedTileId === k) terrainShapes.push(<Polygon key={`sel${k}`} points={pts(surface)} fill="transparent" stroke="#FFFFFF" strokeWidth={3} />);
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
            const lift = t.terrain === "forest" ? FE : t.terrain === "mountain" ? HH + MH * 0.55 : 0;
            const baseY = cy - lift;
            const unit = state.units.find((u) => u.tileId === t.id);
            const city = t.cityId ? state.cities.find((c) => c.id === t.cityId) : undefined;

            return (
              <React.Fragment key={`tok${t.id}`}>
                {t.terrain === "forest" && !city && !unit && (
                  <MaterialCommunityIcons name="pine-tree" size={26} color="#CBD6AE" style={{ position: "absolute", left: cx - 13, top: baseY - 24 }} />
                )}
                {t.resource && !city && (
                  <View style={[styles.resourceBadge, { left: cx + 4, top: baseY - 20 }]}>
                    <MaterialCommunityIcons name={RESOURCE_ICON[t.resource] as any} size={13} color={C.onSurface} />
                  </View>
                )}
                {t.isVillage && !city && (
                  <View style={[styles.village, { left: cx - 17, top: baseY - 28 }]}>
                    <MaterialCommunityIcons name="home-variant" size={20} color={C.surfaceInverse} />
                  </View>
                )}
                {city && (
                  <View style={[styles.city, { left: cx - 20, top: baseY - 36, borderColor: playerColor(state, city.owner) }]}>
                    <MaterialCommunityIcons name={city.isCapital ? "castle" : "home-city"} size={22} color={playerColor(state, city.owner)} />
                    <View style={[styles.cityLevel, { backgroundColor: playerColor(state, city.owner) }]}>
                      <Text style={styles.cityLevelText}>{city.level}</Text>
                    </View>
                  </View>
                )}
                {unit && (
                  <View style={[styles.unit, { left: cx - 17, top: baseY - 34, borderColor: playerColor(state, unit.owner) }, selectedTileId === t.id && styles.unitSelected]}>
                    <MaterialCommunityIcons name={UNIT_DEFS[unit.type].icon as any} size={18} color={playerColor(state, unit.owner)} />
                    <View style={styles.hpBarBg}>
                      <View style={[styles.hpBar, { width: `${Math.max(0, (unit.hp / unit.maxHp) * 100)}%` }]} />
                    </View>
                    {unit.moved && unit.attacked && <View style={styles.doneDot} />}
                  </View>
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
  village: { position: "absolute", width: 34, height: 34, borderRadius: 8, backgroundColor: "#EBE6D8", borderWidth: 2, borderColor: C.borderStrong, alignItems: "center", justifyContent: "center" },
  city: { position: "absolute", width: 40, height: 40, borderRadius: 10, backgroundColor: "#F8F6F0", borderWidth: 3, alignItems: "center", justifyContent: "center" },
  cityLevel: { position: "absolute", bottom: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, alignItems: "center", justifyContent: "center" },
  cityLevelText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  unit: { position: "absolute", width: 34, height: 34, borderRadius: 17, backgroundColor: "#F8F6F0", borderWidth: 3, alignItems: "center", justifyContent: "center" },
  unitSelected: { borderColor: C.warning, transform: [{ scale: 1.12 }] },
  hpBarBg: { position: "absolute", bottom: -6, width: 28, height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.35)", overflow: "hidden" },
  hpBar: { height: 4, backgroundColor: C.success },
  doneDot: { position: "absolute", top: -3, right: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: C.borderStrong, borderWidth: 1, borderColor: "#fff" },
  rotateControls: { position: "absolute", left: 12, bottom: 120, flexDirection: "row", gap: 8 },
  rotateBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(248,246,240,0.9)", alignItems: "center", justifyContent: "center", ...shadow(4) },
});
