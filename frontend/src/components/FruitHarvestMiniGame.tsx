import React, { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import * as Haptics from "expo-haptics";
import { haptic } from "@/src/utils/fx";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import * as THREE from "three";

interface Props {
  onFinish: (collected: number) => void;
}

// Shared mutable control object between the RN overlay and the 3D scene.
interface Ctrl {
  yaw: number;
  pitch: number;
  moveX: number;
  moveZ: number;
  tap: { x: number; y: number } | null; // normalised device coords of a tap-to-pick
}

interface HudApi {
  setCollected: (n: number) => void;
  finish: () => void;
}

interface Apple {
  id: number;
  x: number;
  y: number;
  z: number;
}

// Three fixed trees on the grass field.
const TREES: { x: number; z: number }[] = [
  { x: -5, z: -6 },
  { x: 5, z: -6 },
  { x: 0, z: -14 },
];
const CANOPY_Y = 3.6;
const CANOPY_R = 1.95;
const APPLE_ORBIT = 2.05; // apples sit just outside the canopy sphere
const TRUNK_COLLIDE_R = 0.62;
const PLAYER_RADIUS = 0.3;
const PLAYER_START_Z = 9;

// Generate apples: each tree gets 2-5 apples, with a 10% chance every tree gets 5.
function buildApples(): Apple[] {
  const bonanza = Math.random() < 0.1;
  const apples: Apple[] = [];
  let id = 0;
  for (const tree of TREES) {
    const count = bonanza ? 5 : 2 + Math.floor(Math.random() * 4); // 2..5
    for (let i = 0; i < count; i++) {
      // Spread evenly around the trunk (+jitter) so apples ring the whole tree — the
      // player must walk around to reach the ones on the far side.
      const theta = (i / count) * Math.PI * 2 + Math.random() * 0.8;
      const vy = -1.2 + Math.random() * 2.0; // vertical band on the canopy
      const rr = Math.sqrt(Math.max(0.4, APPLE_ORBIT * APPLE_ORBIT - vy * vy));
      apples.push({
        id: id++,
        x: tree.x + rr * Math.cos(theta),
        y: CANOPY_Y + vy,
        z: tree.z + rr * Math.sin(theta),
      });
    }
  }
  return apples;
}

function trunkBlocks(x: number, z: number): boolean {
  for (const t of TREES) {
    const dx = x - t.x, dz = z - t.z;
    const r = TRUNK_COLLIDE_R + PLAYER_RADIUS;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

// ---------------- 3D Scene ----------------
function Scene({ ctrl, hud, apples }: { ctrl: React.MutableRefObject<Ctrl>; hud: HudApi; apples: Apple[] }) {
  const { camera, scene } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const collected = useRef<Set<number>>(new Set());

  useEffect(() => {
    scene.background = new THREE.Color("#8Fc6d8");
    scene.fog = new THREE.Fog("#8Fc6d8", 30, 75);
    camera.position.set(0, 1.65, PLAYER_START_Z);
  }, [scene, camera]);

  useFrame((_s, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);

    // --- Camera aim from overlay drag ---
    camera.rotation.order = "YXZ";
    camera.rotation.y = ctrl.current.yaw;
    camera.rotation.x = ctrl.current.pitch;

    // --- Player movement from the joystick (blocked by tree trunks) ---
    const speed = 4.4;
    const yaw = ctrl.current.yaw;
    const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
    const mvx = fwdX * ctrl.current.moveZ + rightX * ctrl.current.moveX;
    const mvz = fwdZ * ctrl.current.moveZ + rightZ * ctrl.current.moveX;
    const nextX = Math.max(-13, Math.min(13, camera.position.x + mvx * speed * delta));
    const nextZ = Math.max(-16, Math.min(12, camera.position.z + mvz * speed * delta));
    if (!trunkBlocks(nextX, camera.position.z)) camera.position.x = nextX;
    if (!trunkBlocks(camera.position.x, nextZ)) camera.position.z = nextZ;
    camera.position.y = 1.65;
    camera.updateMatrixWorld();

    // --- Handle a tap: raycast and pick the apple if it's the first thing hit ---
    if (ctrl.current.tap) {
      const ndc = ctrl.current.tap;
      ctrl.current.tap = null;
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera as THREE.Camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      for (const h of hits) {
        const part = h.object.userData?.part as string | undefined;
        if (part === "apple") {
          const id = h.object.userData?.id as number;
          if (!collected.current.has(id)) {
            collected.current.add(id);
            h.object.visible = false;
            hud.setCollected(collected.current.size);
            haptic.impact(Haptics.ImpactFeedbackStyle.Medium);
            if (collected.current.size >= apples.length) hud.finish();
          }
          break; // apple was the first hit — picked
        }
        if (part === "tree" || part === "ground") break; // blocked by trunk/canopy/ground
      }
    }
  });

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[8, 16, 6]} intensity={1.15} />
      <hemisphereLight args={["#bfe3ef", "#4a5d34", 0.5]} />

      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -6]} userData={{ part: "ground" }}>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color="#6f8f4e" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -6]} userData={{ part: "ground" }}>
        <planeGeometry args={[64, 64]} />
        <meshStandardMaterial color="#7ba055" />
      </mesh>

      {/* three apple trees */}
      {TREES.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          <mesh position={[0, 1.5, 0]} userData={{ part: "tree" }}>
            <cylinderGeometry args={[0.34, 0.5, 3.0, 8]} />
            <meshStandardMaterial color="#5b4a34" flatShading />
          </mesh>
          <mesh position={[0, CANOPY_Y, 0]} userData={{ part: "tree" }}>
            <sphereGeometry args={[CANOPY_R, 16, 14]} />
            <meshStandardMaterial color="#3f6b3a" flatShading />
          </mesh>
          <mesh position={[0.5, CANOPY_Y + 1.1, 0.4]} userData={{ part: "tree" }}>
            <sphereGeometry args={[1.15, 14, 12]} />
            <meshStandardMaterial color="#4a7a42" flatShading />
          </mesh>
        </group>
      ))}

      {/* apples */}
      {apples.map((a) => (
        <mesh key={a.id} position={[a.x, a.y, a.z]} userData={{ part: "apple", id: a.id }}>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshStandardMaterial color="#d1372e" emissive="#3a0d0a" emissiveIntensity={0.35} />
        </mesh>
      ))}
    </>
  );
}

// ---------------- Main component (RN overlay + Canvas) ----------------
export default function FruitHarvestMiniGame({ onFinish }: Props) {
  const apples = useMemo(() => buildApples(), []);
  const total = apples.length;
  const ctrl = useRef<Ctrl>({ yaw: 0, pitch: 0, moveX: 0, moveZ: 0, tap: null });
  const [collected, setCollected] = useState(0);
  const [done, setDone] = useState(false);
  const [thumb, setThumb] = useState({ x: 0, y: 0 });
  const dims = useRef({ w: 1, h: 1 });

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

  const hud: HudApi = useMemo(
    () => ({
      setCollected,
      finish: () => setDone(true),
    }),
    []
  );

  // Aim / tap layer: dragging looks around; a quick tap (little movement) picks an apple.
  const tapState = useRef({ startX: 0, startY: 0, moved: false });
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          tapState.current.startX = e.nativeEvent.locationX;
          tapState.current.startY = e.nativeEvent.locationY;
          tapState.current.moved = false;
        },
        onPanResponderMove: (_e, gesture) => {
          if (Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8) tapState.current.moved = true;
          ctrl.current.yaw -= gesture.dx * 0.00035;
          ctrl.current.pitch -= gesture.dy * 0.00035;
          ctrl.current.yaw = Math.max(-Math.PI, Math.min(Math.PI, ctrl.current.yaw));
          ctrl.current.pitch = Math.max(-0.6, Math.min(0.5, ctrl.current.pitch));
        },
        onPanResponderRelease: () => {
          if (!tapState.current.moved) {
            const nx = (tapState.current.startX / dims.current.w) * 2 - 1;
            const ny = -((tapState.current.startY / dims.current.h) * 2 - 1);
            ctrl.current.tap = { x: nx, y: ny };
          }
        },
      }),
    []
  );

  const JOY_R = 46;
  const joy = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_e, gesture) => {
          let dx = gesture.dx;
          let dy = gesture.dy;
          const mag = Math.hypot(dx, dy);
          if (mag > JOY_R) {
            dx = (dx / mag) * JOY_R;
            dy = (dy / mag) * JOY_R;
          }
          setThumb({ x: dx, y: dy });
          ctrl.current.moveX = dx / JOY_R;
          ctrl.current.moveZ = -dy / JOY_R;
        },
        onPanResponderRelease: () => {
          setThumb({ x: 0, y: 0 });
          ctrl.current.moveX = 0;
          ctrl.current.moveZ = 0;
        },
        onPanResponderTerminate: () => {
          setThumb({ x: 0, y: 0 });
          ctrl.current.moveX = 0;
          ctrl.current.moveZ = 0;
        },
      }),
    []
  );

  const rewardLine =
    collected >= 15
      ? "+2 population and +15 apples to your nearest city."
      : collected >= 6
      ? `+1 population and +${collected} apples to your nearest city.`
      : `+${collected} apples to your nearest city.`;

  return (
    <View
      style={styles.root}
      testID="fruit-minigame"
      onLayout={(e) => {
        dims.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
      }}
    >
      <Canvas
        style={StyleSheet.absoluteFill}
        camera={{ fov: 72, near: 0.1, far: 200, position: [0, 1.65, PLAYER_START_Z] }}
        gl={{ antialias: true }}
      >
        <Scene ctrl={ctrl} hud={hud} apples={apples} />
      </Canvas>

      {/* touch aim + tap-to-pick layer */}
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers} pointerEvents={done ? "none" : "auto"} />

      {/* movement joystick (left) */}
      {!done && (
        <View style={styles.joyBase} {...joy.panHandlers}>
          <View style={styles.joyRing} pointerEvents="none" />
          <View pointerEvents="none" style={[styles.joyThumb, { transform: [{ translateX: thumb.x }, { translateY: thumb.y }] }]}>
            <MaterialCommunityIcons name="arrow-all" size={22} color="rgba(255,255,255,0.9)" />
          </View>
        </View>
      )}

      {/* HUD */}
      <View pointerEvents="none" style={styles.hudTop}>
        <View style={styles.hudPill}>
          <MaterialCommunityIcons name="food-apple" size={16} color="#ff6b5b" />
          <Text style={styles.hudNum}>{collected} / {total}</Text>
        </View>
      </View>

      <View pointerEvents="none" style={styles.hint}>
        <Text style={styles.hintText}>Left stick to walk · drag to look · tap the apples to pick them · circle each tree</Text>
      </View>

      {/* Result overlay */}
      {done && (
        <View style={styles.resultOverlay}>
          <View style={styles.resultCard} testID="fruit-result">
            <MaterialCommunityIcons name="basket" size={44} color="#4F772D" />
            <Text style={styles.resultTitle}>Harvest Complete!</Text>
            <Text style={styles.resultSub}>You picked {collected} apples. {rewardLine}</Text>
            <Pressable style={styles.resultBtn} onPress={() => onFinish(collected)} testID="fruit-continue">
              <Text style={styles.resultBtnText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: "#8Fc6d8", zIndex: 100 },
  hudTop: { position: "absolute", top: 16, left: 20, flexDirection: "row", gap: 12 },
  hudPill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(20,20,20,0.55)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  hudNum: { color: "#fff", fontWeight: "900", fontSize: 15, textAlign: "center" },
  joyBase: { position: "absolute", left: 28, bottom: 28, width: 128, height: 128, borderRadius: 64, alignItems: "center", justifyContent: "center" },
  joyRing: { ...StyleSheet.absoluteFillObject, borderRadius: 64, backgroundColor: "rgba(20,20,20,0.32)", borderWidth: 2, borderColor: "rgba(255,255,255,0.35)" },
  joyThumb: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.28)", borderWidth: 2, borderColor: "rgba(255,255,255,0.6)", alignItems: "center", justifyContent: "center" },
  hint: { position: "absolute", bottom: 20, left: 24, right: 24 },
  hintText: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "700" },
  resultOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20,20,20,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  resultCard: { width: "100%", maxWidth: 340, backgroundColor: "#F8F6F0", borderRadius: 20, padding: 24, alignItems: "center", gap: 8 },
  resultTitle: { fontSize: 22, fontWeight: "900", color: "#1C1C1C" },
  resultSub: { fontSize: 13, color: "#2C2C2C", textAlign: "center", marginBottom: 8 },
  resultBtn: { backgroundColor: "#4F772D", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 40, marginTop: 4 },
  resultBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
});
