import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import Button from "@/src/components/Button";
import { useGame } from "@/src/game/store";
import { C, SP } from "@/src/theme";

const HERO = "https://images.pexels.com/photos/9977654/pexels-photo-9977654.jpeg";

export default function MainMenu() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hasSave, continueGame, exitToMenu } = useGame();

  const onContinue = async () => {
    const ok = await continueGame();
    if (ok) router.push("/game");
  };

  const onNew = () => {
    exitToMenu();
    router.push("/mode");
  };

  return (
    <View style={styles.container} testID="main-menu">
      <StatusBar style="light" />
      <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
      <LinearGradient colors={["rgba(28,28,28,0.15)", "rgba(28,28,28,0.55)", "rgba(28,28,28,0.95)"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.top, { paddingTop: insets.top + SP.xxl }]}>
        <View style={styles.badge}>
          <MaterialCommunityIcons name="hexagon-multiple" size={20} color={C.brandTertiary} />
          <Text style={styles.badgeText}>4X TURN-BASED STRATEGY</Text>
        </View>
        <Text style={styles.title}>HexTribes</Text>
        <Text style={styles.subtitle}>Explore. Expand. Exploit. Exterminate.</Text>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + SP.xl }]}>
        {hasSave && <Button testID="menu-continue" label="Continue" icon="play" onPress={onContinue} />}
        <Button testID="menu-new-game" label="New Game" icon="plus-circle" variant={hasSave ? "secondary" : "primary"} onPress={onNew} />
        <View style={styles.rowButtons}>
          <Button testID="menu-stats" label="Stats" icon="chart-bar" variant="ghost" onPress={() => router.push("/stats")} style={{ flex: 1 }} />
          <Button testID="menu-how" label="How to Play" icon="help-circle" variant="ghost" onPress={() => router.push("/how-to-play")} style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1C1C1C", justifyContent: "space-between" },
  top: { paddingHorizontal: SP.xl, alignItems: "flex-start" },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.35)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badgeText: { color: C.brandTertiary, fontWeight: "800", fontSize: 11, letterSpacing: 1 },
  title: { color: "#fff", fontSize: 56, fontWeight: "900", marginTop: SP.md, letterSpacing: -1 },
  subtitle: { color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: "600", marginTop: 2 },
  actions: { paddingHorizontal: SP.xl, gap: SP.md },
  rowButtons: { flexDirection: "row", gap: SP.md },
});
