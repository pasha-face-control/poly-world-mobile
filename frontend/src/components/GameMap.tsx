import React, { useEffect, useMemo, useRef } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C } from "@/src/theme";
import { RESOURCE_ICON, TERRAIN_COLOR, TRIBE_BY_ID, UNIT_DEFS } from "@/src/game/data";
import { GameState, TerrainType } from "@/src/game/types";

// Isometric (2.5D) tile metrics.
export const TILE = 76; // diamond full width
const HW = TILE / 2; // half width
const HH = TILE / 4; // half height (2:1 iso)
const DS = TILE / Math.SQRT2; // side of the un-rotated square used to draw the diamond
const PAD = TILE;

const ELEV: Record<TerrainType, number> = { water: 0, grass: 0, forest: 14, mountain: 30 };

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

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.substring(0, 2), 16)},${parseInt(h.substring(2, 4), 16)},${parseInt(h.substring(4, 6), 16)},${alpha})`;
}

function darken(hex: string, f: number): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.substring(0, 2), 16) * f);
  const g = Math.round(parseInt(h.substring(2, 4), 16) * f);
  const b = Math.round(parseInt(h.substring(4, 6), 16) * f);
  return `rgb(${r},${g},${b})`;
}

export default function GameMap({ state, fog, selectedUnitId, selectedTileId, reachable, attackable, centerTileId, focusTileId, focusKey, territory, territoryColor, onTileTap }: Props) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(0.9);
  const viewport = useRef({ w: 0, h: 0 });
  const centered = useRef(false);

  const { width: w, height: h } = state;
  const originX = (h - 1) * HW + PAD;
  const originY = PAD;
  const boardW = (w + h) * HW + PAD * 2;
  const boardH = (w + h) * HH + PAD * 2 + 40;

  const cxOf = (x: number, y: number) => (x - y) * HW + originX;
  const cyOf = (x: number, y: number, terrain: TerrainType) => (x + y) * HH + originY - ELEV[terrain];

  const centerOn = (tileId: number) => {
    const t = state.tiles[tileId];
    const s = scale.value;
    tx.value = withTiming(viewport.current.w / 2 - cxOf(t.x, t.y) * s);
    ty.value = withTiming(viewport.current.h / 2 - cyOf(t.x, t.y, t.terrain) * s);
  };

  useEffect(() => {
    centered.current = false;
  }, [state.id]);

  useEffect(() => {
    if (focusKey > 0 && focusTileId != null && viewport.current.w > 0) centerOn(focusTileId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  const onLayout = (e: LayoutChangeEvent) => {
    viewport.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
    if (!centered.current && centerTileId != null) {
      centered.current = true;
      centerOn(centerTileId);
    }
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
      scale.value = Math.min(2.2, Math.max(0.45, startScale.value * e.scale));
    });

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e) => {
      // Invert the iso projection (ignore elevation for footprint hit-testing).
      const a = (e.x - originX) / HW; // x - y
      const b = (e.y - originY) / HH; // x + y
      const gx = Math.round((a + b) / 2);
      const gy = Math.round((b - a) / 2);
      if (gx >= 0 && gy >= 0 && gx < w && gy < h) {
        runOnJS(onTileTap)(gy * w + gx);
      }
    });

  const composed = Gesture.Race(Gesture.Simultaneous(pan, pinch), tap);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const reachableSet = useMemo(() => new Set(reachable), [reachable]);
  const attackableSet = useMemo(() => new Set(attackable), [attackable]);
  const terFill = useMemo(() => hexToRgba(territoryColor, 0.28), [territoryColor]);

  // Static painter's-order (far -> near) since positions depend only on x,y.
  const drawOrder = useMemo(() => {
    return state.tiles.map((t) => t.id).sort((i, j) => {
      const a = state.tiles[i];
      const bb = state.tiles[j];
      return a.x + a.y - (bb.x + bb.y);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, state.id]);

  const inTer = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && territory.has(y * w + x);

  return (
    <View style={styles.viewport} onLayout={onLayout}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[{ width: boardW, height: boardH }, animStyle]}>
          {drawOrder.map((id) => {
            const tile = state.tiles[id];
            const hidden = fog && !tile.explored;
            const cx = cxOf(tile.x, tile.y);
            const cy = cyOf(tile.x, tile.y, tile.terrain);
            const elev = ELEV[tile.terrain];
            const baseColor = hidden ? C.surfaceInverse : TERRAIN_COLOR[tile.terrain];
            const isReach = reachableSet.has(id);
            const isAttack = attackableSet.has(id);
            const isSelected = selectedTileId === id;
            const unit = state.units.find((u) => u.tileId === id);
            const city = tile.cityId ? state.cities.find((c) => c.id === tile.cityId) : undefined;
            const showUnit = unit && (!fog || tile.explored);
            const boundary = territory.has(id) && (!inTer(tile.x, tile.y - 1) || !inTer(tile.x, tile.y + 1) || !inTer(tile.x - 1, tile.y) || !inTer(tile.x + 1, tile.y));

            return (
              <React.Fragment key={id}>
                {/* Elevation wall */}
                {!hidden && elev > 0 && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: cx - HW * 0.72,
                      top: cy,
                      width: HW * 1.44,
                      height: elev + HH,
                      backgroundColor: darken(baseColor, 0.62),
                    }}
                  />
                )}

                {/* Ground diamond (+ overlays), squashed to iso */}
                <View
                  pointerEvents="none"
                  style={[styles.groundWrap, { left: cx - TILE / 2, top: cy - TILE / 2 }]}
                >
                  <View style={[styles.diamond, { backgroundColor: baseColor }]} />
                  {!hidden && territory.has(id) && (
                    <View style={[styles.diamond, styles.overlayDiamond, { backgroundColor: terFill, borderColor: boundary ? territoryColor : "transparent" }]} />
                  )}
                  {isReach && <View style={[styles.diamond, styles.overlayDiamond, { backgroundColor: "rgba(229,169,58,0.5)", borderColor: C.warning }]} />}
                  {isAttack && <View style={[styles.diamond, styles.overlayDiamond, { backgroundColor: "rgba(188,71,73,0.5)", borderColor: C.error }]} />}
                  {isSelected && <View style={[styles.diamond, styles.overlayDiamond, { borderColor: "#fff", borderWidth: 3 }]} />}
                </View>

                {/* Terrain feature + tokens (upright) */}
                {!hidden && (tile.terrain === "forest" || tile.terrain === "mountain") && !city && !unit && (
                  <MaterialCommunityIcons
                    name={tile.terrain === "forest" ? "pine-tree" : "triangle"}
                    size={tile.terrain === "forest" ? 30 : 26}
                    color={tile.terrain === "forest" ? "#CBD6AE" : "#F0F0F0"}
                    style={{ position: "absolute", left: cx - 15, top: cy - (tile.terrain === "forest" ? 26 : 22) }}
                  />
                )}

                {!hidden && tile.resource && !city && (
                  <View style={[styles.resourceBadge, { left: cx + 6, top: cy - 22 }]}>
                    <MaterialCommunityIcons name={RESOURCE_ICON[tile.resource] as any} size={13} color={C.onSurface} />
                  </View>
                )}

                {!hidden && tile.isVillage && !city && (
                  <View style={[styles.village, { left: cx - 17, top: cy - 26 }]}>
                    <MaterialCommunityIcons name="home-variant" size={20} color={C.surfaceInverse} />
                  </View>
                )}

                {!hidden && city && (
                  <View style={[styles.city, { left: cx - 20, top: cy - 32, borderColor: playerColor(state, city.owner) }]}>
                    <MaterialCommunityIcons name={city.isCapital ? "castle" : "home-city"} size={22} color={playerColor(state, city.owner)} />
                    <View style={[styles.cityLevel, { backgroundColor: playerColor(state, city.owner) }]}>
                      <Text style={styles.cityLevelText}>{city.level}</Text>
                    </View>
                  </View>
                )}

                {showUnit && unit && (
                  <View style={[styles.unit, { left: cx - 17, top: cy - 30, borderColor: playerColor(state, unit.owner) }, isSelected && styles.unitSelected]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: "hidden", backgroundColor: "#12312e" },
  groundWrap: {
    position: "absolute",
    width: TILE,
    height: TILE,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ scaleY: 0.5 }],
  },
  diamond: {
    position: "absolute",
    width: DS,
    height: DS,
    transform: [{ rotate: "45deg" }],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.18)",
  },
  overlayDiamond: { borderWidth: 4, backgroundColor: "transparent" },
  resourceBadge: {
    position: "absolute",
    backgroundColor: "rgba(248,246,240,0.92)",
    borderRadius: 6,
    padding: 2,
  },
  village: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#EBE6D8",
    borderWidth: 2,
    borderColor: C.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  city: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#F8F6F0",
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  cityLevel: {
    position: "absolute",
    bottom: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  cityLevelText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  unit: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F8F6F0",
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  unitSelected: { borderColor: C.warning, transform: [{ scale: 1.12 }] },
  hpBarBg: {
    position: "absolute",
    bottom: -6,
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.35)",
    overflow: "hidden",
  },
  hpBar: { height: 4, backgroundColor: C.success },
  doneDot: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.borderStrong,
    borderWidth: 1,
    borderColor: "#fff",
  },
});
