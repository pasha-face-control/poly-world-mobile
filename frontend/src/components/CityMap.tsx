import React, { useMemo, useRef, useState } from "react";
import { Image, LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg, { Line, Polygon } from "react-native-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CITADEL_SIZE, CITY_BUILDING_BY_ID, CITY_GRID, buildingSize, citadelAssetKey } from "@/src/game/data";
import { City, CityBuilding, CityBuildingType, TribeId } from "@/src/game/types";
import { C } from "@/src/theme";

const HW = 20;
const HH = 10;
const N = CITY_GRID;
const OX = (N - 1) * HW + HW; // screen x for x==y
const BOARD_W = 2 * (N - 1) * HW + 2 * HW;
const BOARD_H = 2 * (N - 1) * HH + 2 * HH;

const CITADEL_SPRITES: Record<string, number> = {
  citadel_1_tm: require("../../assets/images/city/citadel_1_tm.png"),
  citadel_5_tm: require("../../assets/images/city/citadel_5_tm.png"),
  citadel_10_tm: require("../../assets/images/city/citadel_10_tm.png"),
  citadel_15_tm: require("../../assets/images/city/citadel_15_tm.png"),
};
const CITY_SPRITE: Record<string, number> = {
  houses: require("../../assets/images/city/houses_tm.png"),
  sawmill: require("../../assets/images/city/sawmill_tm.png"),
  stone_quarry: require("../../assets/images/city/stone_quarry_tm.png"),
  sand_quarry: require("../../assets/images/city/sand_quarry_tm.png"),
  glass_factory: require("../../assets/images/city/glass_factory_tm.png"),
  trade_tower: require("../../assets/images/city/trade_tower_tm.png"),
  park: require("../../assets/images/city/park_tm.png"),
};
// height / width of each sprite PNG (hardcoded — Image.resolveAssetSource is unreliable on web).
const SPRITE_ASPECT: Record<string, number> = { houses: 0.7199, sawmill: 0.5166, stone_quarry: 0.5063, sand_quarry: 0.5094, glass_factory: 0.6639, trade_tower: 2.5809, park: 0.8732 };
// A tribe's Material Factory shows its own unique building sprite.
const FACTORY_SPRITE_BY_TRIBE: Record<string, string> = { nature: "sawmill", volcanic: "stone_quarry", desert: "sand_quarry", snow: "glass_factory" };
// Width of a sprite as a multiple of its footprint diamond width.
const SPRITE_SCALE: Record<string, number> = { house: 1.0, factory: 1.0, trade_tower: 0.64, park: 1.08 };
const BUILDING_COLOR: Record<string, string> = { house: "#C98A4B", factory: "#8A8F98", trade_tower: "#C7A24B", park: "#5FA85F" };

function proj(x: number, y: number) {
  return { x: (x - y) * HW + OX, y: (x + y) * HH + HH };
}
function blockPoints(x: number, y: number, s: number) {
  const a = proj(x, y), b = proj(x + s, y), c = proj(x + s, y + s), d = proj(x, y + s);
  return `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`;
}

interface Props {
  city: City;
  tribe: TribeId;
  placing?: CityBuildingType | null;
  canPlaceAt?: (type: CityBuildingType, x: number, y: number) => boolean;
  onPlace?: (x: number, y: number) => void;
  onCancelPlace?: () => void;
  roadMode?: boolean;
  canRoadAt?: (cell: number) => boolean;
  onDrawRoads?: (cells: number[]) => void;
  onTapBuilding?: (b: CityBuilding) => void;
  editMode?: "move" | "demolish" | "deleteRoad" | null;
  onDeleteRoad?: (cell: number) => void;
  canMoveTo?: (buildingId: string, x: number, y: number) => boolean;
  onMoveBuilding?: (buildingId: string, x: number, y: number) => void;
}

export default function CityMap({ city, tribe, placing, canPlaceAt, onPlace, onCancelPlace, roadMode, canRoadAt, onDrawRoads, onTapBuilding, editMode, onDeleteRoad, canMoveTo, onMoveBuilding }: Props) {
  const scale = useSharedValue(0.65);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const vpW = useSharedValue(0);
  const vpH = useSharedValue(0);
  const started = useSharedValue(false);
  const [ghost, setGhost] = useState<{ x: number; y: number; ok: boolean } | null>(null);
  const [stroke, setStroke] = useState<number[]>([]);
  const [moveGhost, setMoveGhost] = useState<{ id: string; type: CityBuildingType; x: number; y: number; ok: boolean } | null>(null);
  const ghostRef = useRef<{ x: number; y: number; ok: boolean } | null>(null);
  const strokeRef = useRef<number[]>([]);
  const moveRef = useRef<CityBuilding | null>(null);
  const moveGhostRef = useRef<{ id: string; type: CityBuildingType; x: number; y: number; ok: boolean } | null>(null);

  const grid = useMemo(() => {
    const lines: React.ReactNode[] = [];
    for (let i = 0; i <= N; i++) {
      const a = proj(i, 0), b = proj(i, N);
      lines.push(<Line key={`a${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />);
      const c = proj(0, i), d = proj(N, i);
      lines.push(<Line key={`b${i}`} x1={c.x} y1={c.y} x2={d.x} y2={d.y} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />);
    }
    return lines;
  }, []);

  const field = useMemo(() => {
    const p0 = proj(0, 0), p1 = proj(N, 0), p2 = proj(N, N), p3 = proj(0, N);
    return `${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`;
  }, []);

  const center = proj(N / 2, N / 2);
  const baseBottom = proj(N / 2 + CITADEL_SIZE / 2, N / 2 + CITADEL_SIZE / 2);
  const stageKey = citadelAssetKey(city.citadelStage ?? 1);
  const citW = (6 * 2 * HW) / 0.964;
  const citH = citW * (312 / 475);

  const buildings = city.layout?.buildings ?? [];
  const roads = city.layout?.roads ?? [];

  // Sprite + on-screen rectangle for a placed building (bottom-anchored to its footprint).
  const spriteKeyFor = (type: CityBuildingType): string | null => {
    if (type === "house") return "houses";
    if (type === "trade_tower") return "trade_tower";
    if (type === "park") return "park";
    if (type === "factory") return FACTORY_SPRITE_BY_TRIBE[tribe] ?? "sawmill";
    return null; // no other building types
  };
  const spriteFor = (type: CityBuildingType): number | null => {
    const key = spriteKeyFor(type);
    return key ? CITY_SPRITE[key] : null;
  };
  const rectFor = (type: CityBuildingType, x: number, y: number) => {
    const s = buildingSize(type, tribe);
    const mid = proj(x + s / 2, y + s / 2);
    const footBottom = mid.y + s * HH; // front-bottom vertex of the footprint diamond
    const key = spriteKeyFor(type);
    if (key == null) return { src: null as number | null, left: mid.x - 12, top: mid.y - 20, w: 24, h: 24, footBottom, mid };
    const w = s * 2 * HW * (SPRITE_SCALE[type] ?? 1);
    const h = w * SPRITE_ASPECT[key];
    return { src: CITY_SPRITE[key], left: mid.x - w / 2, top: footBottom - h, w, h, footBottom, mid };
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    vpW.value = width; vpH.value = height;
    if (!started.value) {
      started.value = true;
      tx.value = width / 2 - center.x * scale.value;
      ty.value = height / 2 - center.y * scale.value;
    }
  };

  const updateGhost = (cx: number, cy: number) => {
    if (!placing) return;
    const s = buildingSize(placing, tribe);
    const gx = Math.max(0, Math.min(N - s, Math.round(cx - s / 2)));
    const gy = Math.max(0, Math.min(N - s, Math.round(cy - s / 2)));
    const ok = canPlaceAt ? canPlaceAt(placing, gx, gy) : true;
    ghostRef.current = { x: gx, y: gy, ok };
    setGhost({ x: gx, y: gy, ok });
  };
  const commitGhost = () => {
    const g = ghostRef.current;
    ghostRef.current = null;
    setGhost(null);
    if (g) onPlace?.(g.x, g.y);
    else onCancelPlace?.();
  };

  // Road drawing: translate a finger point to a single grid cell and collect the stroke.
  const cellAt = (px: number, py: number): number | null => {
    const bx = (px - tx.value) / scale.value, by = (py - ty.value) / scale.value;
    const X = (bx - OX) / HW, Y = (by - HH) / HH;
    const cx = Math.floor((X + Y) / 2), cy = Math.floor((Y - X) / 2);
    if (cx < 0 || cy < 0 || cx >= N || cy >= N) return null;
    return cy * N + cx;
  };
  const addRoadCell = (px: number, py: number) => {
    const cell = cellAt(px, py);
    if (cell == null) return;
    if (canRoadAt && !canRoadAt(cell)) return;
    setStroke((prev) => {
      if (prev.includes(cell)) return prev;
      const next = [...prev, cell];
      strokeRef.current = next;
      return next;
    });
  };
  const commitStroke = () => {
    const cells = strokeRef.current;
    strokeRef.current = [];
    setStroke([]);
    if (cells.length) onDrawRoads?.(cells);
  };
  const deleteRoadAt = (px: number, py: number) => {
    const cell = cellAt(px, py);
    if (cell != null) onDeleteRoad?.(cell);
  };

  // Move mode: pick up the building under the finger and drag it (single gesture, no tap needed).
  // Hit-test against each building's on-screen sprite rectangle so tall sprites (towers) can be
  // grabbed anywhere on their body, not just the ground footprint.
  const buildingAt = (px: number, py: number): CityBuilding | null => {
    const bx = (px - tx.value) / scale.value, by = (py - ty.value) / scale.value;
    let hit: CityBuilding | null = null;
    for (const b of buildings) {
      const r = rectFor(b.type, b.x, b.y);
      if (bx >= r.left && bx <= r.left + r.w && by >= r.top && by <= r.footBottom) hit = b; // topmost wins
    }
    return hit;
  };
  const moveBegin = (px: number, py: number) => {
    const b = buildingAt(px, py);
    moveRef.current = b;
    if (b) { const g = { id: b.id, type: b.type, x: b.x, y: b.y, ok: true }; moveGhostRef.current = g; setMoveGhost(g); }
    else { moveGhostRef.current = null; setMoveGhost(null); }
  };
  const moveUpdate = (px: number, py: number) => {
    const b = moveRef.current;
    if (!b) return;
    const s = buildingSize(b.type, tribe);
    const bx = (px - tx.value) / scale.value, by = (py - ty.value) / scale.value;
    const u = (bx - OX) / HW, v = (by - HH) / HH;
    const gx = Math.max(0, Math.min(N - s, Math.round((u + v) / 2 - s / 2)));
    const gy = Math.max(0, Math.min(N - s, Math.round((v - u) / 2 - s / 2)));
    const ok = canMoveTo ? canMoveTo(b.id, gx, gy) : true;
    const g = { id: b.id, type: b.type, x: gx, y: gy, ok };
    moveGhostRef.current = g; setMoveGhost(g);
  };
  const moveEnd = () => {
    const g = moveGhostRef.current;
    moveRef.current = null; moveGhostRef.current = null; setMoveGhost(null);
    if (g && g.ok) onMoveBuilding?.(g.id, g.x, g.y);
  };

  const pan = Gesture.Pan().averageTouches(true).onChange((e) => {
    tx.value += e.changeX; ty.value += e.changeY;
  });
  const pinch = Gesture.Pinch().onChange((e) => {
    const ns = Math.min(2.0, Math.max(0.35, scale.value * e.scaleChange));
    const cxp = vpW.value / 2, cyp = vpH.value / 2;
    const bx = (cxp - tx.value) / scale.value, by = (cyp - ty.value) / scale.value;
    tx.value = cxp - bx * ns; ty.value = cyp - by * ns; scale.value = ns;
  });
  const mapGesture = Gesture.Simultaneous(pan, pinch);

  // While placing, a full-screen drag moves the ghost and drops it on release.
  const placeGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => { const bx = (e.x - tx.value) / scale.value, by = (e.y - ty.value) / scale.value; const u = (bx - OX) / HW, v = (by - HH) / HH; runOnJS(updateGhost)((u + v) / 2, (v - u) / 2); })
    .onChange((e) => { const bx = (e.x - tx.value) / scale.value, by = (e.y - ty.value) / scale.value; const u = (bx - OX) / HW, v = (by - HH) / HH; runOnJS(updateGhost)((u + v) / 2, (v - u) / 2); })
    .onEnd(() => { runOnJS(commitGhost)(); });

  // While in road mode, dragging a finger paints roads cell-by-cell.
  const roadGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => { runOnJS(addRoadCell)(e.x, e.y); })
    .onChange((e) => { runOnJS(addRoadCell)(e.x, e.y); })
    .onEnd(() => { runOnJS(commitStroke)(); });

  // Delete-road mode: a tap removes the road under the finger.
  const deleteRoadGesture = Gesture.Tap().maxDistance(20).onEnd((e) => { runOnJS(deleteRoadAt)(e.x, e.y); });

  // Move mode: touch a building and drag it to a new spot; release to drop.
  const moveGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => { runOnJS(moveBegin)(e.x, e.y); })
    .onChange((e) => { runOnJS(moveUpdate)(e.x, e.y); })
    .onEnd(() => { runOnJS(moveEnd)(); });

  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));

  const board = (
    <Animated.View style={[{ width: BOARD_W, height: BOARD_H, transformOrigin: "top left" }, animStyle]}>
      <Svg width={BOARD_W} height={BOARD_H}>
        <Polygon points={field} fill={C.terrain_grass} />
        <Polygon points={field} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth={2} />
        {grid}
        {roads.map((r) => {
          const rx = r % N, ry = Math.floor(r / N);
          return <Polygon key={`r${r}`} points={blockPoints(rx, ry, 1)} fill="#8A7B5C" />;
        })}
        {stroke.map((r) => {
          const rx = r % N, ry = Math.floor(r / N);
          return <Polygon key={`s${r}`} points={blockPoints(rx, ry, 1)} fill="rgba(138,123,92,0.7)" stroke="#fff" strokeWidth={1} />;
        })}
        {buildings.filter((b) => spriteFor(b.type) == null).map((b) => (
          <Polygon key={b.id} points={blockPoints(b.x, b.y, buildingSize(b.type, tribe))} fill={BUILDING_COLOR[b.type]} stroke="rgba(0,0,0,0.25)" strokeWidth={1} opacity={0.92} />
        ))}
        {(editMode === "move" || editMode === "demolish") && buildings.map((b) => (
          <Polygon key={`hl${b.id}`} points={blockPoints(b.x, b.y, buildingSize(b.type, tribe))} fill="rgba(80,140,255,0.18)" stroke="#3B82F6" strokeWidth={2} />
        ))}
        {editMode === "deleteRoad" && roads.map((r) => {
          const rx = r % N, ry = Math.floor(r / N);
          return <Polygon key={`dr${r}`} points={blockPoints(rx, ry, 1)} fill="rgba(220,70,70,0.5)" stroke="#B71C1C" strokeWidth={1} />;
        })}
        {ghost && placing && (
          <Polygon points={blockPoints(ghost.x, ghost.y, buildingSize(placing, tribe))} fill={ghost.ok ? "rgba(80,200,110,0.55)" : "rgba(220,70,70,0.55)"} stroke={ghost.ok ? "#2E7D32" : "#B71C1C"} strokeWidth={2} />
        )}
        {moveGhost && (
          <Polygon points={blockPoints(moveGhost.x, moveGhost.y, buildingSize(moveGhost.type, tribe))} fill={moveGhost.ok ? "rgba(80,200,110,0.4)" : "rgba(220,70,70,0.4)"} stroke={moveGhost.ok ? "#2E7D32" : "#B71C1C"} strokeWidth={2} />
        )}
      </Svg>

      {buildings.map((b) => {
        const moving = moveGhost?.id === b.id;
        const r = rectFor(b.type, b.x, b.y);
        if (r.src != null) {
          return (
            <React.Fragment key={`img${b.id}`}>
              <Image source={r.src} pointerEvents="none" resizeMode="contain" style={{ position: "absolute", left: r.left, top: r.top, width: r.w, height: r.h, opacity: moving ? 0.3 : 1 }} />
              {b.type === "factory" && b.starved && (
                <View pointerEvents="none" style={{ position: "absolute", left: r.mid.x - 9, top: r.footBottom - r.h - 4 }}>
                  <View style={styles.warnBadge}><MaterialCommunityIcons name="alert" size={12} color="#fff" /></View>
                </View>
              )}
            </React.Fragment>
          );
        }
        return (
          <View key={`ic${b.id}`} pointerEvents="none" style={{ position: "absolute", left: r.left, top: r.mid.y - 20, opacity: moving ? 0.3 : 1 }}>
            <MaterialCommunityIcons name={CITY_BUILDING_BY_ID[b.type].icon as any} size={24} color="#fff" />
          </View>
        );
      })}

      {moveGhost && spriteFor(moveGhost.type) != null && (() => {
        const r = rectFor(moveGhost.type, moveGhost.x, moveGhost.y);
        return <Image source={r.src!} pointerEvents="none" resizeMode="contain" style={{ position: "absolute", left: r.left, top: r.top, width: r.w, height: r.h, opacity: 0.85 }} />;
      })()}

      {/* Tappable overlays: factory config (no edit mode) or demolish selection */}
      {!placing && !roadMode && editMode !== "move" && editMode !== "deleteRoad" && buildings.filter((b) => editMode === "demolish" || b.type === "factory").map((b) => {
        const r = rectFor(b.type, b.x, b.y);
        return (
          <Pressable
            key={`tap${b.id}`}
            testID={b.type === "factory" ? `factory-${b.id}` : `bld-${b.id}`}
            onPress={() => onTapBuilding?.(b)}
            style={{ position: "absolute", left: r.left, top: r.top, width: r.w, height: r.footBottom - r.top }}
          />
        );
      })}

      <Image source={CITADEL_SPRITES[stageKey]} pointerEvents="none" resizeMode="contain" style={{ position: "absolute", left: baseBottom.x - citW * 0.499, top: baseBottom.y - citH * 0.971, width: citW, height: citH }} />
    </Animated.View>
  );

  return (
    <View style={styles.viewport} onLayout={onLayout} testID="city-map">
      <GestureDetector gesture={mapGesture}>{board}</GestureDetector>
      {placing && (
        <GestureDetector gesture={placeGesture}>
          <View style={StyleSheet.absoluteFill} testID="place-layer" />
        </GestureDetector>
      )}
      {roadMode && !placing && (
        <GestureDetector gesture={roadGesture}>
          <View style={StyleSheet.absoluteFill} testID="road-layer" />
        </GestureDetector>
      )}
      {editMode === "deleteRoad" && !placing && (
        <GestureDetector gesture={deleteRoadGesture}>
          <View style={StyleSheet.absoluteFill} testID="delete-road-layer" />
        </GestureDetector>
      )}
      {editMode === "move" && !placing && (
        <GestureDetector gesture={moveGesture}>
          <View style={StyleSheet.absoluteFill} testID="move-layer" />
        </GestureDetector>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: "hidden", backgroundColor: "#6E8F5E" },
  warnBadge: { position: "absolute", top: -6, right: -10, width: 18, height: 18, borderRadius: 9, backgroundColor: "#D14343", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#fff" },
});
