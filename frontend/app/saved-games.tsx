import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import SaveSlotList from "@/src/components/SaveSlotList";
import { SlotInfo, useGame } from "@/src/game/store";
import { C, R, SP } from "@/src/theme";

export default function SavedGamesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loadFromSlot } = useGame();

  const onSelect = async (index: number, info: SlotInfo) => {
    if (info.empty) return;
    const ok = await loadFromSlot(index);
    if (ok) router.replace("/game");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="saved-games-screen">
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable testID="saved-back" onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={C.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Saved Games</Text>
      </View>
      <Text style={styles.hint}>Tap a slot to load that game.</Text>
      <SaveSlotList mode="load" onSelect={onSelect} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: SP.md, paddingVertical: SP.sm, gap: 6 },
  back: { padding: 4, backgroundColor: C.surfaceSecondary, borderRadius: R.pill },
  headerTitle: { fontSize: 22, fontWeight: "900", color: C.onSurface },
  hint: { fontSize: 13, fontWeight: "600", color: C.onSurfaceSecondary, paddingHorizontal: SP.lg, marginBottom: SP.xs },
});
