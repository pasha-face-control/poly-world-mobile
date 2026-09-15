import React, { useMemo, useRef, useState } from "react";
import { Image, LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg, { Line, Polygon } from "react-native-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CITADEL_SIZE, CITY_BUILDING_BY_ID, CITY_GRID, citadelAssetKey } from "@/src/game/data";
import { City, CityBuilding, CityBuildingType } from "@/src/game/types";
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
const HOUSE_SPRITE = require("../../assets/images/city/houses_tm.png");
const BUILDING_COLOR: Record<string, string> = { house: "#C98A4B", factory: "#8A8F98", trade_tower: "#C7A24B", park: "#5FA85F" };
const FACTORY_H = 32; // isometric extrusion height (px) for the factory building

function proj(x: number, y: number) {
  return { x: (x - y) * HW + OX, y: (x + y) * HH + HH };
}
function blockPoints(x: number, y: number, s: number) {
  const a = proj(x, y), b = proj(x + s, y), c = proj(x + s, y + s), d = proj(x, y + s);
  return `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`;
}

interface Props {
  city: City;
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

export default function CityMap({ city, placing, canPlaceAt, onPlace, onCancelPlace, roadMode, canRoadAt, onDrawRoads, onTapBuilding, editMode, onDeleteRoad, canMoveTo, onMoveBuilding }: Props) {
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
    const s = CITY_BUILDING_BY_ID[placing].size;
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
  const cellFor = (bxx: number, byy: number) => {
    const X = (bxx - OX) / HW, Y = (byy - HH) / HH;
    return { cx: Math.floor((X + Y) / 2), cy: Math.floor((Y - X) / 2) };
  };
  const inFootprint = (b: CityBuilding, c: { cx: number; cy: number }) => {
    const s = CITY_BUILDING_BY_ID[b.type].size;
    return c.cx >= b.x && c.cx < b.x + s && c.cy >= b.y && c.cy < b.y + s;
  };
  const buildingAt = (px: number, py: number): CityBuilding | null => {
    const bx = (px - tx.value) / scale.value, by = (py - ty.value) / scale.value;
    for (const b of buildings) {
      // Base-plane hit for every building.
      if (inFootprint(b, cellFor(bx, by))) return b;
      // The factory box is raised by FACTORY_H, so a press on its roof/icon maps to a
      // ground cell above the footprint — probe downward to catch those grabs too.
      if (b.type === "factory") {
        for (const dy of [FACTORY_H, FACTORY_H + 14, FACTORY_H * 0.5]) {
          if (inFootprint(b, cellFor(bx, by + dy))) return b;
        }
      }
    }
    return null;
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
    const s = CITY_BUILDING_BY_ID[b.type].size;
    const elev = b.type === "factory" ? FACTORY_H : 0; // keep the footprint under the visual grab point
    const bx = (px - tx.value) / scale.value, by = (py - ty.value) / scale.value + elev;
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

  // Draw the factory as a simple isometric building block (roof + two side faces).
  const factoryBox = (b: { id: string; type: CityBuildingType; x: number; y: number }, opacity = 1) => {
    const s = CITY_BUILDING_BY_ID[b.type].size;
    const inset = 0.55;
    const x0 = b.x + inset, y0 = b.y + inset, x1 = b.x + s - inset, y1 = b.y + s - inset;
    const A = proj(x0, y0), Bp = proj(x1, y0), Cp = proj(x1, y1), D = proj(x0, y1);
    const top = `${A.x},${A.y - FACTORY_H} ${Bp.x},${Bp.y - FACTORY_H} ${Cp.x},${Cp.y - FACTORY_H} ${D.x},${D.y - FACTORY_H}`;
    const leftFace = `${D.x},${D.y} ${Cp.x},${Cp.y} ${Cp.x},${Cp.y - FACTORY_H} ${D.x},${D.y - FACTORY_H}`;
    const rightFace = `${Cp.x},${Cp.y} ${Bp.x},${Bp.y} ${Bp.x},${Bp.y - FACTORY_H} ${Cp.x},${Cp.y - FACTORY_H}`;
    return (
      <React.Fragment key={`fb${b.id}`}>
        <Polygon points={leftFace} fill="#6E747B" opacity={opacity} />
        <Polygon points={rightFace} fill="#565C63" opacity={opacity} />
        <Polygon points={top} fill="#AEB6BE" stroke="rgba(0,0,0,0.2)" strokeWidth={1} opacity={opacity} />
      </React.Fragment>
    );
  };

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
        {buildings.map((b) => (
          <Polygon key={b.id} points={blockPoints(b.x, b.y, CITY_BUILDING_BY_ID[b.type].size)} fill={BUILDING_COLOR[b.type]} stroke="rgba(0,0,0,0.25)" strokeWidth={1} opacity={0.92} />
        ))}
        {buildings.filter((b) => b.type === "factory").map((b) => factoryBox(b, moveGhost?.id === b.id ? 0.3 : 1))}
        {(editMode === "move" || editMode === "demolish") && buildings.map((b) => (
          <Polygon key={`hl${b.id}`} points={blockPoints(b.x, b.y, CITY_BUILDING_BY_ID[b.type].size)} fill="rgba(80,140,255,0.18)" stroke="#3B82F6" strokeWidth={2} />
        ))}
        {editMode === "deleteRoad" && roads.map((r) => {
          const rx = r % N, ry = Math.floor(r / N);
          return <Polygon key={`dr${r}`} points={blockPoints(rx, ry, 1)} fill="rgba(220,70,70,0.5)" stroke="#B71C1C" strokeWidth={1} />;
        })}
        {ghost && placing && (
          <Polygon points={blockPoints(ghost.x, ghost.y, CITY_BUILDING_BY_ID[placing].size)} fill={ghost.ok ? "rgba(80,200,110,0.55)" : "rgba(220,70,70,0.55)"} stroke={ghost.ok ? "#2E7D32" : "#B71C1C"} strokeWidth={2} />
        )}
        {moveGhost && (
          <>
            <Polygon points={blockPoints(moveGhost.x, moveGhost.y, CITY_BUILDING_BY_ID[moveGhost.type].size)} fill={moveGhost.ok ? "rgba(80,200,110,0.4)" : "rgba(220,70,70,0.4)"} stroke={moveGhost.ok ? "#2E7D32" : "#B71C1C"} strokeWidth={2} />
            {moveGhost.type === "factory" && factoryBox({ id: "ghost", type: "factory", x: moveGhost.x, y: moveGhost.y }, 0.85)}
          </>
        )}
      </Svg>

      {buildings.map((b) => {
        const s = CITY_BUILDING_BY_ID[b.type].size;
        const mid = proj(b.x + s / 2, b.y + s / 2);
        const moving = moveGhost?.id === b.id;
        if (b.type === "house") {
          const w = s * 2 * HW; // match the 2×2 footprint width
          const h = w * (347 / 482);
          const footBottom = mid.y + s * HH; // front-bottom vertex of the footprint diamond
          return <Image key={`img${b.id}`} source={HOUSE_SPRITE} pointerEvents="none" resizeMode="contain" style={{ position: "absolute", left: mid.x - w / 2, top: footBottom - h, width: w, height: h, opacity: moving ? 0.3 : 1 }} />;
        }
        const topOff = b.type === "factory" ? FACTORY_H + 12 : 20;
        return (
          <View key={`ic${b.id}`} pointerEvents="none" style={{ position: "absolute", left: mid.x - 12, top: mid.y - topOff, opacity: moving ? 0.3 : 1 }}>
            <MaterialCommunityIcons name={CITY_BUILDING_BY_ID[b.type].icon as any} size={24} color="#fff" />
            {b.type === "factory" && b.starved && (
              <View style={styles.warnBadge}><MaterialCommunityIcons name="alert" size={12} color="#fff" /></View>
            )}
          </View>
        );
      })}

      {/* Tappable overlays: factory config (no edit mode) or demolish selection */}
      {!placing && !roadMode && editMode !== "move" && editMode !== "deleteRoad" && buildings.filter((b) => editMode === "demolish" || b.type === "factory").map((b) => {
        const s = CITY_BUILDING_BY_ID[b.type].size;
        const left = proj(b.x, b.y + s).x, right = proj(b.x + s, b.y).x;
        const top = proj(b.x, b.y).y, bottom = proj(b.x + s, b.y + s).y;
        return (
          <Pressable
            key={`tap${b.id}`}
            testID={b.type === "factory" ? `factory-${b.id}` : `bld-${b.id}`}
            onPress={() => onTapBuilding?.(b)}
            style={{ position: "absolute", left, top, width: right - left, height: bottom - top }}
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
