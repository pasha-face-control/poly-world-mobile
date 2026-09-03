import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { C, R, SP, shadow } from "@/src/theme";

export default function GameMode() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="mode-screen">
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable testID="mode-back" onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={C.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Game Mode</Text>
      </View>

      <View style={styles.center}>
        <Pressable testID="mode-single" onPress={() => router.push("/setup")} style={[styles.card, shadow(6)]}>
          <View style={[styles.icon, { backgroundColor: C.brand }]}>
            <MaterialCommunityIcons name="robot" size={34} color="#fff" />
          </View>
          <Text style={styles.cardTitle}>Single Player</Text>
          <Text style={styles.cardSub}>Battle the computer tribes</Text>
        </Pressable>

        <Pressable testID="mode-multi" onPress={() => router.push("/create-map")} style={[styles.card, shadow(6)]}>
          <View style={[styles.icon, { backgroundColor: C.info }]}>
            <MaterialCommunityIcons name="account-multiple" size={34} color="#fff" />
          </View>
          <Text style={styles.cardTitle}>Multiplayer Offline</Text>
          <Text style={styles.cardSub}>Pass & play on one device</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: SP.md, paddingVertical: SP.sm, gap: 6 },
  back: { padding: 4, backgroundColor: C.surfaceSecondary, borderRadius: R.pill },
  headerTitle: { fontSize: 22, fontWeight: "900", color: C.onSurface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: SP.lg, paddingHorizontal: SP.lg },
  card: { width: "100%", maxWidth: 340, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 2, borderColor: C.border, padding: SP.xl, alignItems: "center", gap: 6 },
  icon: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  cardTitle: { fontSize: 22, fontWeight: "900", color: C.onSurface },
  cardSub: { fontSize: 13, color: C.onSurfaceSecondary },
});
