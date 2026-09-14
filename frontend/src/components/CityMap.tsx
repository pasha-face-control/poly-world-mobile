import React, { useMemo } from "react";
import { Image, LayoutChangeEvent, StyleSheet, View } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg, { Line, Polygon } from "react-native-svg";
import { CITY_GRID, citadelAssetKey } from "@/src/game/data";
import { City } from "@/src/game/types";
import { C } from "@/src/theme";

const HW = 20; // half tile width
const HH = 10; // half tile height
const N = CITY_GRID;
const ORIGIN_X = (N - 1) * HW; // shift so min screen x = 0
const BOARD_W = 2 * (N - 1) * HW + 2 * HW;
const BOARD_H = 2 * (N - 1) * HH + 2 * HH;

const CITADEL_SPRITES: Record<string, number> = {
  citadel_1_tm: require("../../assets/images/city/citadel_1_tm.png"),
  citadel_5_tm: require("../../assets/images/city/citadel_5_tm.png"),
  citadel_10_tm: require("../../assets/images/city/citadel_10_tm.png"),
  citadel_15_tm: require("../../assets/images/city/citadel_15_tm.png"),
};

function proj(x: number, y: number) {
  return { x: (x - y) * HW + ORIGIN_X + HW, y: (x + y) * HH + HH };
}

interface Props {
  city: City;
}

export default function CityMap({ city }: Props) {
  const scale = useSharedValue(0.65);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const vpW = useSharedValue(0);
  const vpH = useSharedValue(0);
  const started = useSharedValue(false);

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

  // Grass field outline (one big diamond covering the 30×30 board).
  const field = useMemo(() => {
    const p0 = proj(0, 0), p1 = proj(N, 0), p2 = proj(N, N), p3 = proj(0, N);
    return `${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`;
  }, []);

  const center = proj(N / 2, N / 2);
  const stageKey = citadelAssetKey(city.citadelStage ?? 1);
  const citW = 6 * 2 * HW * 1.15; // ~6 cells wide
  const citH = citW; // sprites are ~square; contain handles aspect

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    vpW.value = width; vpH.value = height;
    if (!started.value) {
      started.value = true;
      // Center the citadel in the viewport at the initial scale.
      tx.value = width / 2 - center.x * scale.value;
      ty.value = height / 2 - center.y * scale.value;
    }
  };

  const pan = Gesture.Pan().averageTouches(true).onChange((e) => {
    tx.value += e.changeX; ty.value += e.changeY;
  });
  const pinch = Gesture.Pinch().onChange((e) => {
    const ns = Math.min(2.0, Math.max(0.35, scale.value * e.scaleChange));
    const cxp = vpW.value / 2, cyp = vpH.value / 2;
    const bx = (cxp - tx.value) / scale.value;
    const by = (cyp - ty.value) / scale.value;
    tx.value = cxp - bx * ns; ty.value = cyp - by * ns; scale.value = ns;
  });
  const gesture = Gesture.Simultaneous(pan, pinch);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <View style={styles.viewport} onLayout={onLayout} testID="city-map">
      <GestureDetector gesture={gesture}>
        <Animated.View style={[{ width: BOARD_W, height: BOARD_H, transformOrigin: "top left" }, animStyle]}>
          <Svg width={BOARD_W} height={BOARD_H}>
            <Polygon points={field} fill={C.terrain_grass} />
            <Polygon points={field} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth={2} />
            {grid}
          </Svg>
          <Image
            source={CITADEL_SPRITES[stageKey]}
            pointerEvents="none"
            resizeMode="contain"
            style={{ position: "absolute", left: center.x - citW / 2, top: center.y - citH * 0.72, width: citW, height: citH }}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: "hidden", backgroundColor: "#6E8F5E" },
});
