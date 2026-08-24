import React, { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import * as THREE from "three";

type Result = "kill" | "fail";

interface Props {
  onFinish: (result: Result) => void;
}

const MAX_HP = 12;
const MAX_ARROWS = 12;
const BULL_HP = 12;
const START_Z = -13;
const GORE_Z = -2.0;

// Shared mutable control object between the RN overlay and the 3D scene.
interface Ctrl {
  yaw: number;
  pitch: number;
  shootRequested: boolean;
  shootCooldown: number;
}

interface HudApi {
  setHp: (n: number) => void;
  setArrows: (n: number) => void;
  setResult: (r: Result) => void;
  flash: () => void;
}

// ---------------- 3D Scene ----------------
function Scene({ ctrl, hud }: { ctrl: React.MutableRefObject<Ctrl>; hud: HudApi }) {
  const { camera, scene } = useThree();
  const bullGroup = useRef<THREE.Group>(null);
  const arrowRef = useRef<THREE.Mesh>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);

  // Internal game state (kept out of React to avoid re-renders every frame).
  const g = useRef({
    bullHp: BULL_HP,
    playerHp: MAX_HP,
    arrows: MAX_ARROWS,
    over: false,
    // bull AI
    state: "wander" as "wander" | "charge" | "gore" | "retreat" | "hit" | "dead",
    stateT: 0,
    nextDecide: 1.5,
    pos: new THREE.Vector3(0, 0, START_Z),
    prevPos: new THREE.Vector3(0, 0, START_Z),
    yawFacing: 0, // smoothed heading — head (local +Z) leads the run
    vx: 0,
    strafe: 0,
    deadT: 0,
    hitFlashT: 0,
    // arrow projectile
    arrow: { active: false, pos: new THREE.Vector3(), dir: new THREE.Vector3(), life: 0 },
  });

  useEffect(() => {
    scene.background = new THREE.Color("#8Fc6d8");
    scene.fog = new THREE.Fog("#8Fc6d8", 22, 55);
    camera.position.set(0, 1.65, 0);
  }, [scene, camera]);

  const finish = (r: Result) => {
    if (g.current.over) return;
    g.current.over = true;
    hud.setResult(r);
  };

  useFrame((_s, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const st = g.current;

    // --- Camera aim from overlay drag ---
    camera.rotation.order = "YXZ";
    camera.rotation.y = ctrl.current.yaw;
    camera.rotation.x = ctrl.current.pitch;
    camera.updateMatrixWorld();

    if (ctrl.current.shootCooldown > 0) ctrl.current.shootCooldown -= delta;

    // --- Bull AI ---
    if (!st.over || st.state === "dead") {
      st.stateT += delta;
      const grp = bullGroup.current;

      if (st.state === "dead") {
        st.deadT += delta;
        if (grp) {
          grp.rotation.z = Math.min(Math.PI / 2, st.deadT * 3);
          grp.position.y = Math.max(0, 0 - st.deadT * 0.2);
        }
        if (st.deadT > 0.9) finish("kill");
      } else {
        switch (st.state) {
          case "wander": {
            st.pos.x += Math.sin(st.stateT * 1.3) * 0.8 * delta;
            st.pos.z += Math.sin(st.stateT * 0.7) * 0.3 * delta;
            st.pos.z = Math.max(START_Z - 1, Math.min(-9, st.pos.z));
            if (st.stateT > st.nextDecide) {
              st.state = Math.random() < 0.75 ? "charge" : "wander";
              st.stateT = 0;
              st.nextDecide = 1.2 + Math.random() * 1.6;
              st.strafe = (Math.random() - 0.5) * 2;
            }
            break;
          }
          case "charge": {
            st.pos.z += 6.5 * delta; // rush the player
            // dodge / strafe so shots require aim
            st.pos.x += Math.sin(st.stateT * 6) * st.strafe * 2.2 * delta;
            st.pos.x = Math.max(-7, Math.min(7, st.pos.x));
            if (st.pos.z >= GORE_Z) {
              st.state = "gore";
              st.stateT = 0;
            }
            break;
          }
          case "gore": {
            if (st.stateT < 0.05) {
              // land the hit once
              st.playerHp = Math.max(0, st.playerHp - 4);
              hud.setHp(st.playerHp);
              hud.flash();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              if (st.playerHp <= 0) finish("fail");
            }
            if (st.stateT > 0.4) {
              st.state = "retreat";
              st.stateT = 0;
            }
            break;
          }
          case "retreat": {
            st.pos.z -= 7 * delta;
            if (st.pos.z <= START_Z) {
              st.pos.z = START_Z;
              st.state = "wander";
              st.stateT = 0;
              st.nextDecide = 1.0 + Math.random() * 1.2;
            }
            break;
          }
          case "hit": {
            if (st.stateT > 0.18) {
              st.state = st.pos.z > -6 ? "charge" : "wander";
              st.stateT = 0;
            }
            break;
          }
        }

        if (grp) {
          grp.position.set(st.pos.x, 0, st.pos.z);
          // Face the direction of travel so the head always leads the run:
          // charging → head toward the player, retreating → head away from the player.
          const dx = st.pos.x - st.prevPos.x;
          const dz = st.pos.z - st.prevPos.z;
          const targetYaw =
            dx * dx + dz * dz > 1e-6
              ? Math.atan2(dx, dz) // head (local +Z) points along velocity
              : Math.atan2(-st.pos.x, -st.pos.z); // stationary (goring) → face the player
          let diff = targetYaw - st.yawFacing;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          st.yawFacing += diff * Math.min(1, delta * 12);
          grp.rotation.y = st.yawFacing;
          // little bob while moving
          const bob = st.state === "gore" ? 0 : Math.sin(st.stateT * 10) * 0.05;
          grp.position.y = bob;
          grp.rotation.z = 0;
          st.prevPos.copy(st.pos);
        }

        // hit flash
        if (st.hitFlashT > 0) st.hitFlashT -= delta;
      }
    }

    // --- Handle shoot request ---
    if (
      ctrl.current.shootRequested &&
      !st.over &&
      st.arrows > 0 &&
      ctrl.current.shootCooldown <= 0 &&
      !st.arrow.active
    ) {
      ctrl.current.shootRequested = false;
      ctrl.current.shootCooldown = 0.45;
      st.arrows -= 1;
      hud.setArrows(st.arrows);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // launch arrow visual
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      st.arrow.active = true;
      st.arrow.life = 0;
      st.arrow.pos.copy(camera.position);
      st.arrow.dir.copy(dir);

      // raycast from screen center
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera as THREE.Camera);
      const grp = bullGroup.current;
      let part: string | null = null;
      if (grp) {
        const hits = raycaster.intersectObject(grp, true);
        if (hits.length > 0) part = (hits[0].object.userData?.part as string) || "body";
      }

      if (part && st.state !== "dead") {
        let dmg = 1;
        if (part === "head") dmg = BULL_HP; // one-shot
        else if (part === "body") dmg = 3; // 4 hits
        else dmg = 1; // legs: 12 hits
        st.bullHp = Math.max(0, st.bullHp - dmg);
        st.hitFlashT = 0.18;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        if (st.bullHp <= 0) {
          st.state = "dead";
          st.stateT = 0;
          st.deadT = 0;
        } else {
          st.state = "hit";
          st.stateT = 0;
        }
      }

      // out of arrows and bull still alive -> lose (after arrow travels)
      if (st.arrows <= 0 && st.bullHp > 0) {
        st.arrow.life = -0.6; // small delay before resolving
      }
    }

    // --- Arrow projectile animation ---
    if (st.arrow.active && arrowRef.current) {
      st.arrow.life += delta;
      st.arrow.pos.addScaledVector(st.arrow.dir, 60 * delta);
      arrowRef.current.visible = true;
      arrowRef.current.position.copy(st.arrow.pos);
      arrowRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), st.arrow.dir);
      if (st.arrow.life > 0.35) {
        st.arrow.active = false;
        arrowRef.current.visible = false;
        if (st.arrows <= 0 && st.bullHp > 0 && st.state !== "dead") finish("fail");
      }
    } else if (arrowRef.current) {
      arrowRef.current.visible = false;
    }

    // hit tint on body materials
    const grp2 = bullGroup.current;
    if (grp2) {
      grp2.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m && m.emissive) m.emissive.setScalar(g.current.hitFlashT > 0 ? 0.35 : 0);
      });
    }
  });

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[8, 14, 4]} intensity={1.15} />
      <hemisphereLight args={["#bfe3ef", "#4a5d34", 0.5]} />

      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -20]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#6f8f4e" />
      </mesh>
      {/* darker grass patch band */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -14]}>
        <planeGeometry args={[40, 24]} />
        <meshStandardMaterial color="#7ba055" />
      </mesh>

      <Scenery />

      {/* Bull: blend of low-poly boxes + rounded belly */}
      <group ref={bullGroup} position={[0, 0, START_Z]}>
        {/* legs */}
        {[
          [-0.35, -0.55],
          [0.35, -0.55],
          [-0.35, 0.55],
          [0.35, 0.55],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.45, z]} userData={{ part: "leg" }}>
            <cylinderGeometry args={[0.13, 0.11, 0.9, 6]} />
            <meshStandardMaterial color="#3a2a1e" flatShading />
          </mesh>
        ))}
        {/* body box */}
        <mesh position={[0, 1.15, 0]} userData={{ part: "body" }}>
          <boxGeometry args={[0.95, 0.85, 1.7]} />
          <meshStandardMaterial color="#5b4130" flatShading />
        </mesh>
        {/* rounded belly for a realistic blend */}
        <mesh position={[0, 1.0, 0]} scale={[0.55, 0.5, 0.95]} userData={{ part: "body" }}>
          <sphereGeometry args={[1, 14, 12]} />
          <meshStandardMaterial color="#4d3626" />
        </mesh>
        {/* neck */}
        <mesh position={[0, 1.2, 1.0]} rotation={[0.4, 0, 0]} userData={{ part: "body" }}>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
          <meshStandardMaterial color="#5b4130" flatShading />
        </mesh>
        {/* head */}
        <mesh position={[0, 1.5, 1.45]} userData={{ part: "head" }}>
          <boxGeometry args={[0.55, 0.55, 0.7]} />
          <meshStandardMaterial color="#6b4b34" flatShading />
        </mesh>
        {/* snout */}
        <mesh position={[0, 1.38, 1.85]} userData={{ part: "head" }}>
          <boxGeometry args={[0.42, 0.34, 0.28]} />
          <meshStandardMaterial color="#8a6248" flatShading />
        </mesh>
        {/* horns */}
        <mesh position={[-0.3, 1.85, 1.45]} rotation={[0, 0, 0.6]} userData={{ part: "head" }}>
          <coneGeometry args={[0.08, 0.4, 6]} />
          <meshStandardMaterial color="#e8e2d0" flatShading />
        </mesh>
        <mesh position={[0.3, 1.85, 1.45]} rotation={[0, 0, -0.6]} userData={{ part: "head" }}>
          <coneGeometry args={[0.08, 0.4, 6]} />
          <meshStandardMaterial color="#e8e2d0" flatShading />
        </mesh>
        {/* eyes */}
        <mesh position={[-0.18, 1.58, 1.78]} userData={{ part: "head" }}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <mesh position={[0.18, 1.58, 1.78]} userData={{ part: "head" }}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        {/* tail */}
        <mesh position={[0, 1.2, -0.95]} rotation={[-0.5, 0, 0]} userData={{ part: "body" }}>
          <cylinderGeometry args={[0.05, 0.03, 0.7, 5]} />
          <meshStandardMaterial color="#3a2a1e" flatShading />
        </mesh>
      </group>

      {/* arrow projectile */}
      <mesh ref={arrowRef} visible={false}>
        <cylinderGeometry args={[0.02, 0.02, 0.7, 6]} />
        <meshStandardMaterial color="#c9a227" />
      </mesh>
    </>
  );
}

// A few low-poly trees & rocks for depth.
function Scenery() {
  const items = useMemo(() => {
    const arr: { x: number; z: number; s: number; tree: boolean }[] = [];
    const rng = (n: number) => ((Math.sin(n * 999.7) * 43758.5) % 1 + 1) % 1;
    for (let i = 0; i < 16; i++) {
      const x = (rng(i + 1) - 0.5) * 60;
      const z = -8 - rng(i + 50) * 40;
      if (Math.abs(x) < 3.5 && z > -18) continue;
      arr.push({ x, z, s: 0.7 + rng(i + 9) * 0.9, tree: rng(i + 3) > 0.35 });
    }
    return arr;
  }, []);
  return (
    <>
      {items.map((it, i) =>
        it.tree ? (
          <group key={i} position={[it.x, 0, it.z]} scale={it.s}>
            <mesh position={[0, 0.7, 0]}>
              <cylinderGeometry args={[0.15, 0.2, 1.4, 6]} />
              <meshStandardMaterial color="#5b4a34" flatShading />
            </mesh>
            <mesh position={[0, 1.9, 0]}>
              <coneGeometry args={[0.9, 1.8, 7]} />
              <meshStandardMaterial color="#3f6b3a" flatShading />
            </mesh>
          </group>
        ) : (
          <mesh key={i} position={[it.x, 0.3, it.z]} scale={it.s}>
            <dodecahedronGeometry args={[0.5]} />
            <meshStandardMaterial color="#8a8a80" flatShading />
          </mesh>
        )
      )}
    </>
  );
}

// ---------------- Main component (RN overlay + Canvas) ----------------
export default function HuntingMiniGame({ onFinish }: Props) {
  const ctrl = useRef<Ctrl>({ yaw: 0, pitch: 0, shootRequested: false, shootCooldown: 0 });
  const [hp, setHp] = useState(MAX_HP);
  const [arrows, setArrows] = useState(MAX_ARROWS);
  const [result, setResult] = useState<Result | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const flashOn = useRef(false);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      // Return to the in-game screen, which follows the device orientation.
      ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

  const hud: HudApi = useMemo(
    () => ({
      setHp,
      setArrows,
      setResult: (r) => setResult((prev) => prev ?? r),
      flash: () => {
        flashOn.current = true;
        setFlashKey((k) => k + 1);
        setTimeout(() => {
          flashOn.current = false;
          setFlashKey((k) => k + 1);
        }, 180);
      },
    }),
    []
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_e, gesture) => {
          ctrl.current.yaw -= gesture.dx * 0.00035;
          ctrl.current.pitch -= gesture.dy * 0.00035;
          ctrl.current.yaw = Math.max(-1.2, Math.min(1.2, ctrl.current.yaw));
          ctrl.current.pitch = Math.max(-0.5, Math.min(0.4, ctrl.current.pitch));
        },
      }),
    []
  );

  const shoot = () => {
    if (result) return;
    ctrl.current.shootRequested = true;
  };

  return (
    <View style={styles.root} testID="hunting-minigame">
      <Canvas
        style={StyleSheet.absoluteFill}
        camera={{ fov: 72, near: 0.1, far: 200, position: [0, 1.65, 0] }}
        gl={{ antialias: true }}
      >
        <Scene ctrl={ctrl} hud={hud} />
      </Canvas>

      {/* touch aim layer */}
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers} pointerEvents={result ? "none" : "auto"} />

      {/* damage flash */}
      {flashOn.current && <View pointerEvents="none" style={styles.dmgFlash} key={flashKey} />}

      {/* Crosshair */}
      {!result && (
        <View pointerEvents="none" style={styles.crosshairWrap}>
          <View style={styles.chLineV} />
          <View style={styles.chLineH} />
          <View style={styles.chDot} />
        </View>
      )}

      {/* HUD */}
      <View pointerEvents="none" style={styles.hudTop}>
        <View style={styles.hudPill}>
          <MaterialCommunityIcons name="heart" size={16} color="#ff5b5b" />
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${(hp / MAX_HP) * 100}%`, backgroundColor: "#ff5b5b" }]} />
          </View>
          <Text style={styles.hudNum}>{hp}</Text>
        </View>
        <View style={styles.hudPill}>
          <MaterialCommunityIcons name="bow-arrow" size={16} color="#ffd27a" />
          <Text style={styles.hudNum}>{arrows}</Text>
        </View>
      </View>

      {/* Shoot button */}
      {!result && (
        <Pressable style={styles.shootBtn} onPress={shoot} testID="hunt-shoot">
          <MaterialCommunityIcons name="bullseye-arrow" size={30} color="#fff" />
          <Text style={styles.shootLabel}>SHOOT</Text>
        </Pressable>
      )}

      <View pointerEvents="none" style={styles.hint}>
        <Text style={styles.hintText}>Drag to aim · aim for the head for a one-shot kill</Text>
      </View>

      {/* Result overlay */}
      {result && (
        <View style={styles.resultOverlay}>
          <View style={styles.resultCard} testID="hunt-result">
            <MaterialCommunityIcons
              name={result === "kill" ? "trophy" : "emoticon-sad"}
              size={44}
              color={result === "kill" ? "#E5A93A" : "#BC4749"}
            />
            <Text style={styles.resultTitle}>{result === "kill" ? "Bull Down!" : "The Bull Escaped"}</Text>
            <Text style={styles.resultSub}>
              {result === "kill"
                ? "+1 population and +1 meat to your nearest city."
                : "No reward this time. Better luck next hunt."}
            </Text>
            <Pressable style={styles.resultBtn} onPress={() => onFinish(result)} testID="hunt-continue">
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
  dmgFlash: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(200,30,30,0.28)" },
  crosshairWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  chLineV: { position: "absolute", width: 2, height: 26, backgroundColor: "rgba(255,255,255,0.85)" },
  chLineH: { position: "absolute", width: 26, height: 2, backgroundColor: "rgba(255,255,255,0.85)" },
  chDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#ff4444" },
  hudTop: { position: "absolute", top: 16, left: 20, flexDirection: "row", gap: 12 },
  hudPill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(20,20,20,0.55)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  barBg: { width: 80, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  hudNum: { color: "#fff", fontWeight: "900", fontSize: 14, minWidth: 18, textAlign: "center" },
  shootBtn: { position: "absolute", right: 26, bottom: 26, width: 92, height: 92, borderRadius: 46, backgroundColor: "rgba(188,71,73,0.92)", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "rgba(255,255,255,0.7)" },
  shootLabel: { color: "#fff", fontWeight: "900", fontSize: 12, marginTop: 2, letterSpacing: 1 },
  hint: { position: "absolute", bottom: 20, left: 24 },
  hintText: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "700" },
  resultOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20,20,20,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  resultCard: { width: "100%", maxWidth: 340, backgroundColor: "#F8F6F0", borderRadius: 20, padding: 24, alignItems: "center", gap: 8 },
  resultTitle: { fontSize: 22, fontWeight: "900", color: "#1C1C1C" },
  resultSub: { fontSize: 13, color: "#2C2C2C", textAlign: "center", marginBottom: 8 },
  resultBtn: { backgroundColor: "#4F772D", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 40, marginTop: 4 },
  resultBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
});
