import React, { useEffect, useMemo, useRef } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C } from "@/src/theme";
import { RESOURCE_ICON, TERRAIN_COLOR, TRIBE_BY_ID, UNIT_DEFS } from "@/src/game/data";
import { GameState } from "@/src/game/types";

export const TILE = 58;

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
  onTileTap: (tileId: number) => void;
}

function playerColor(state: GameState, owner: number): string {
  return TRIBE_BY_ID[state.players[owner].tribe].color;
}

export default function GameMap({ state, fog, selectedUnitId, selectedTileId, reachable, attackable, centerTileId, focusTileId, focusKey, onTileTap }: Props) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const viewport = useRef({ w: 0, h: 0 });
  const centered = useRef(false);

  const boardW = state.width * TILE;
  const boardH = state.height * TILE;

  const centerOn = (tileId: number) => {
    const t = state.tiles[tileId];
    const s = scale.value;
    tx.value = withTiming(viewport.current.w / 2 - (t.x + 0.5) * TILE * s);
    ty.value = withTiming(viewport.current.h / 2 - (t.y + 0.5) * TILE * s);
  };

  useEffect(() => {
    centered.current = false;
  }, [state.id]);

  useEffect(() => {
    if (focusKey > 0 && focusTileId != null && viewport.current.w > 0) {
      centerOn(focusTileId);
    }
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
      const next = Math.min(2.2, Math.max(0.5, startScale.value * e.scale));
      scale.value = next;
    });

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e) => {
      const gx = Math.floor(e.x / TILE);
      const gy = Math.floor(e.y / TILE);
      if (gx >= 0 && gy >= 0 && gx < state.width && gy < state.height) {
        runOnJS(onTileTap)(gy * state.width + gx);
      }
    });

  const composed = Gesture.Race(Gesture.Simultaneous(pan, pinch), tap);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const reachableSet = useMemo(() => new Set(reachable), [reachable]);
  const attackableSet = useMemo(() => new Set(attackable), [attackable]);

  return (
    <View style={styles.viewport} onLayout={onLayout}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[{ width: boardW, height: boardH }, animStyle]}>
          {state.tiles.map((tile) => {
            const hidden = fog && !tile.explored;
            const isReach = reachableSet.has(tile.id);
            const isAttack = attackableSet.has(tile.id);
            const isSelected = selectedTileId === tile.id;
            const unit = state.units.find((u) => u.tileId === tile.id);
            const city = tile.cityId ? state.cities.find((c) => c.id === tile.cityId) : undefined;
            const showUnit = unit && (!fog || tile.explored);

            return (
              <View
                key={tile.id}
                style={[
                  styles.tile,
                  {
                    left: tile.x * TILE,
                    top: tile.y * TILE,
                    backgroundColor: hidden ? C.surfaceInverse : TERRAIN_COLOR[tile.terrain],
                  },
                ]}
              >
                {!hidden && (tile.terrain === "forest" || tile.terrain === "mountain") && (
                  <MaterialCommunityIcons
                    name={tile.terrain === "forest" ? "pine-tree" : "triangle"}
                    size={tile.terrain === "forest" ? 24 : 22}
                    color={tile.terrain === "forest" ? "#B7C39C" : "#EDEDED"}
                    style={styles.terrainIcon}
                  />
                )}

                {!hidden && tile.resource && !city && (
                  <View style={styles.resourceBadge}>
                    <MaterialCommunityIcons name={RESOURCE_ICON[tile.resource] as any} size={13} color={C.onSurface} />
                  </View>
                )}

                {!hidden && tile.isVillage && !city && (
                  <View style={styles.village}>
                    <MaterialCommunityIcons name="home-variant" size={20} color={C.surfaceInverse} />
                  </View>
                )}

                {!hidden && city && (
                  <View style={[styles.city, { borderColor: playerColor(state, city.owner) }]}>
                    <MaterialCommunityIcons name={city.isCapital ? "castle" : "home-city"} size={20} color={playerColor(state, city.owner)} />
                    <View style={[styles.cityLevel, { backgroundColor: playerColor(state, city.owner) }]}>
                      <Text style={styles.cityLevelText}>{city.level}</Text>
                    </View>
                  </View>
                )}

                {/* Overlays */}
                {isReach && <View style={styles.reachOverlay} pointerEvents="none" />}
                {isAttack && <View style={styles.attackOverlay} pointerEvents="none" />}

                {showUnit && unit && (
                  <View style={[styles.unit, { borderColor: playerColor(state, unit.owner) }, isSelected && styles.unitSelected]}>
                    <MaterialCommunityIcons name={UNIT_DEFS[unit.type].icon as any} size={18} color={playerColor(state, unit.owner)} />
                    <View style={styles.hpBarBg}>
                      <View style={[styles.hpBar, { width: `${Math.max(0, (unit.hp / unit.maxHp) * 100)}%` }]} />
                    </View>
                    {unit.moved && unit.attacked && <View style={styles.doneDot} />}
                  </View>
                )}
              </View>
            );
          })}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: "hidden", backgroundColor: "#1d3b38" },
  tile: {
    position: "absolute",
    width: TILE,
    height: TILE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  terrainIcon: { position: "absolute" },
  resourceBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "rgba(248,246,240,0.9)",
    borderRadius: 6,
    padding: 1,
  },
  village: {
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
    bottom: 3,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F8F6F0",
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  unitSelected: {
    borderColor: C.warning,
    transform: [{ scale: 1.12 }],
  },
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
  reachOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(229,169,58,0.35)",
    borderWidth: 2,
    borderColor: C.warning,
  },
  attackOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(188,71,73,0.4)",
    borderWidth: 2,
    borderColor: C.error,
  },
});
