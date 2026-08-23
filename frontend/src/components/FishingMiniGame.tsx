import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import * as THREE from "three";

type Result = "catch" | "fail";
interface Props {
  onFinish: (result: Result) => void;
}

const MAX_WORMS = 3;
const BITE_WINDOW = 1.5; // seconds to react

type Phase = "idle" | "waiting" | "bite" | "done";

// Shared control object between the RN overlay and the 3D scene.
interface Ctrl {
  cast: boolean; // request a cast
  pull: boolean; // request a pull
  phase: Phase;
  worms: number;
}

function Scene({ ctrl, onPhase, onWorms, onResult }: { ctrl: React.MutableRefObject<Ctrl>; onPhase: (p: Phase) => void; onWorms: (n: number) => void; onResult: (r: Result) => void }) {
  const { camera, scene } = useThree();
  const bobber = useRef<THREE.Mesh>(null);
  const lineRef = useRef<THREE.Mesh>(null);
  const g = useRef({ t: 0, biteAt: 0, biteElapsed: 0, over: false });

  useEffect(() => {
    scene.background = new THREE.Color("#8ec6df");
    scene.fog = new THREE.Fog("#8ec6df", 20, 60);
    camera.position.set(0, 1.6, 0);
    camera.rotation.set(-0.25, 0, 0);
    camera.updateMatrixWorld();
  }, [scene, camera]);

  useFrame((_s, raw) => {
    const d = Math.min(raw, 0.05);
    const st = g.current;
    const c = ctrl.current;

    // Cast requested
    if (c.cast && (c.phase === "idle") && !st.over) {
      c.cast = false;
      c.worms -= 1;
      onWorms(c.worms);
      c.phase = "waiting";
      onPhase("waiting");
      st.t = 0;
      st.biteAt = 1.6 + Math.random() * 3.4; // fish bites after 1.6-5s
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (c.phase === "waiting") {
      st.t += d;
      if (st.t >= st.biteAt) {
        c.phase = "bite";
        onPhase("bite");
        st.biteElapsed = 0;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } else if (c.phase === "bite") {
      st.biteElapsed += d;
      if (c.pull) {
        c.pull = false;
        // caught!
        c.phase = "done";
        onPhase("done");
        st.over = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onResult("catch");
      } else if (st.biteElapsed >= BITE_WINDOW) {
        // fish got away — worm already spent
        if (c.worms <= 0) {
          c.phase = "done";
          onPhase("done");
          st.over = true;
          onResult("fail");
        } else {
          c.phase = "idle";
          onPhase("idle");
        }
      }
    } else if (c.pull) {
      c.pull = false; // ignore pull outside bite
    }

    // bobber animation
    if (bobber.current) {
      const base = 0.05;
      if (c.phase === "bite") {
        // dip sharply while a fish tugs
        bobber.current.position.y = -0.35 + Math.sin(st.biteElapsed * 25) * 0.08;
      } else if (c.phase === "waiting") {
        bobber.current.position.y = base + Math.sin(st.t * 2) * 0.06;
      } else {
        bobber.current.position.y = base;
      }
      bobber.current.visible = c.phase === "waiting" || c.phase === "bite";
    }
    if (lineRef.current) lineRef.current.visible = c.phase === "waiting" || c.phase === "bite";
  });

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[6, 12, 4]} intensity={1.1} />
      <hemisphereLight args={["#cdeaf5", "#2e5b74", 0.5]} />

      {/* sea */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -14]}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#2f7fa6" />
      </mesh>
      {/* shore (sand) behind the camera edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 4]}>
        <planeGeometry args={[120, 14]} />
        <meshStandardMaterial color="#d9c38a" />
      </mesh>

      {/* fishing rod in first person (foreground, right side) */}
      <group position={[0.9, 0.5, -1.1]} rotation={[0.5, -0.3, 0.2]}>
        <mesh>
          <cylinderGeometry args={[0.02, 0.03, 2.2, 6]} />
          <meshStandardMaterial color="#7a4a22" />
        </mesh>
      </group>

      {/* line */}
      <mesh ref={lineRef} position={[0.2, -0.2, -6]}>
        <cylinderGeometry args={[0.005, 0.005, 3, 4]} />
        <meshStandardMaterial color="#eeeeee" />
      </mesh>

      {/* bobber on the water */}
      <mesh ref={bobber} position={[0.2, 0.05, -8]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#e23b3b" />
      </mesh>
    </>
  );
}

export default function FishingMiniGame({ onFinish }: Props) {
  const ctrl = useRef<Ctrl>({ cast: false, pull: false, phase: "idle", worms: MAX_WORMS });
  const [worms, setWorms] = useState(MAX_WORMS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  return (
    <View style={styles.root} testID="fishing-minigame">
      <Canvas style={StyleSheet.absoluteFill} camera={{ fov: 70, near: 0.1, far: 200, position: [0, 1.6, 0] }} gl={{ antialias: true }}>
        <Scene ctrl={ctrl} onPhase={setPhase} onWorms={setWorms} onResult={(r) => setResult((p) => p ?? r)} />
      </Canvas>

      {/* HUD */}
      <View pointerEvents="none" style={styles.hudTop}>
        <View style={styles.hudPill}>
          <MaterialCommunityIcons name="bug" size={16} color="#c8a15a" />
          <Text style={styles.hudNum}>{worms}</Text>
        </View>
      </View>

      {!result && (
        <View pointerEvents="none" style={styles.hint}>
          <Text style={styles.hintText}>
            {phase === "idle" ? "Cast your line" : phase === "waiting" ? "Wait for a bite…" : phase === "bite" ? "PULL NOW!" : ""}
          </Text>
        </View>
      )}

      {/* Action buttons */}
      {!result && phase === "idle" && (
        <Pressable style={[styles.actionBtn, { backgroundColor: "#2E6B7A" }]} testID="fish-cast" onPress={() => { ctrl.current.cast = true; }}>
          <MaterialCommunityIcons name="fishing" size={30} color="#fff" />
          <Text style={styles.actionLabel}>CAST</Text>
        </Pressable>
      )}
      {!result && (phase === "waiting" || phase === "bite") && (
        <Pressable
          style={[styles.actionBtn, { backgroundColor: phase === "bite" ? "#BC4749" : "rgba(120,120,120,0.6)" }]}
          testID="fish-pull"
          onPress={() => { ctrl.current.pull = true; }}
        >
          <MaterialCommunityIcons name="arrow-up-bold" size={30} color="#fff" />
          <Text style={styles.actionLabel}>PULL</Text>
        </Pressable>
      )}

      {result && (
        <View style={styles.resultOverlay}>
          <View style={styles.resultCard} testID="fish-result">
            <MaterialCommunityIcons name={result === "catch" ? "fish" : "emoticon-sad"} size={44} color={result === "catch" ? "#2E6B7A" : "#BC4749"} />
            <Text style={styles.resultTitle}>{result === "catch" ? "Fish Caught!" : "It Got Away"}</Text>
            <Text style={styles.resultSub}>{result === "catch" ? "+1 population to your nearest city." : "Out of worms — no reward this time."}</Text>
            <Pressable style={styles.resultBtn} onPress={() => onFinish(result)} testID="fish-continue">
              <Text style={styles.resultBtnText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: "#8ec6df", zIndex: 100 },
  hudTop: { position: "absolute", top: 16, left: 20, flexDirection: "row", gap: 12 },
  hudPill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(20,20,20,0.55)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  hudNum: { color: "#fff", fontWeight: "900", fontSize: 14, minWidth: 16, textAlign: "center" },
  hint: { position: "absolute", top: 18, alignSelf: "center", backgroundColor: "rgba(20,20,20,0.5)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  hintText: { color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },
  actionBtn: { position: "absolute", right: 26, bottom: 26, width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "rgba(255,255,255,0.7)" },
  actionLabel: { color: "#fff", fontWeight: "900", fontSize: 12, marginTop: 2, letterSpacing: 1 },
  resultOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20,20,20,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  resultCard: { width: "100%", maxWidth: 340, backgroundColor: "#F8F6F0", borderRadius: 20, padding: 24, alignItems: "center", gap: 8 },
  resultTitle: { fontSize: 22, fontWeight: "900", color: "#1C1C1C" },
  resultSub: { fontSize: 13, color: "#2C2C2C", textAlign: "center", marginBottom: 8 },
  resultBtn: { backgroundColor: "#2E6B7A", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 40, marginTop: 4 },
  resultBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
});
