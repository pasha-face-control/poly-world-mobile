import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, R, SP, shadow } from "@/src/theme";

const SECTIONS: { icon: string; title: string; body: string }[] = [
  { icon: "earth", title: "Goal", body: "Grow the strongest economy and outlast every rival — buy all their cities to win.\n\nGrow the strongest empire and outlast every rival — capture all their cities to win, and don't lose all of yours.\n\nBe the first to upgrade a city to level 18 and finish the game — Peaceful victory." },
  { icon: "gesture-tap", title: "Move & Attack", body: "Tap a unit to select it. Yellow tiles are moves, red tiles are attacks." },
  { icon: "map-outline", title: "Territory", body: "Each tribe has its own colour. Tap tiles in your tribe's colour to see the options for what you can establish on them.\n\nTerritory is expanded by buying tiles adjacent to your city's borders. Purchases work in squares — to buy a tile in the second ring of city territory, the whole first ring around the city must be bought first." },
  { icon: "home-city", title: "Cities", body: "Tap your city to train units, rename it, or enter the city.\n\nInside each city is a citadel that can be upgraded to allow more buildings to be built.\n\nHouses and other buildings are built by dragging and placing them on green space on the city map — the footprint turns green when the building can be placed.\n\nA house connected by road to the citadel gives +2 population the moment it connects, then +1 star per turn.\n\nUpgrading the citadel or building houses needs stars and one or more unique resources." },
  { icon: "swap-horizontal", title: "Trade & Economy", body: "Load a Merchant with goods and set a price so rivals buy them for stars. Open the Economy panel (chart icon, top bar) to see what you buy, sell and earn per turn." },
  { icon: "star-four-points", title: "Stars", body: "Each turn every city gives stars equal to its level. Spend stars on units, tech, harvesting, buying territory and trading." },
  { icon: "file-tree", title: "Technology", body: "Open the Tech tree to unlock new units, traverse mountains & water, and build mines. A mine's tech icon matches the ore shown on the mountain where it's built." },
  { icon: "flag-variant", title: "Villages", body: "Move a unit onto a neutral village to found a new city and expand your empire." },
  { icon: "factory", title: "Apple Juice Factory", body: "Build this 3×3 factory in your city (cheap for the Freemen tribe, pricier for everyone else). Tap it to load apples — next turn you receive 1 Apple Juice for every 5 apples loaded." },
  { icon: "cup", title: "Apple Juice Discount", body: "On the Tech tree, spend Apple Juice to cut a technology's cost: each juice gives −25% (up to −50% with two). The juice is used up when you research, so pick your target first." },
  { icon: "skull-outline", title: "Killed in War", body: "A rival who loses their last city and last unit in battle is killed and knocked out of the game. In pass-and-play their turn is skipped automatically." },
  { icon: "handshake", title: "Financially Annexed", body: "Sell all of a player's cities and they become Financially Annexed — not killed. They keep taking turns and can research tech, buy cities back, and make bigger custom offers to tempt sellers. While annexed they earn a one-time Safety Bonus (15× their stars) plus per-turn points from the temples on cities they sold. They can't win until they own a city again." },
];

export default function HowToPlay() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="how-screen">
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable testID="how-back" onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={C.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>How to Play</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: SP.lg, gap: SP.md, paddingBottom: insets.bottom + 24 }}>
        {SECTIONS.map((s) => (
          <View key={s.title} style={[styles.card, shadow(2)]}>
            <View style={styles.iconBox}>
              <MaterialCommunityIcons name={s.icon as any} size={24} color={C.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: SP.md, paddingVertical: SP.sm, gap: 6 },
  back: { padding: 4, backgroundColor: C.surfaceSecondary, borderRadius: R.pill },
  headerTitle: { fontSize: 22, fontWeight: "900", color: C.onSurface },
  card: { flexDirection: "row", gap: SP.md, backgroundColor: C.surface, borderRadius: R.lg, padding: SP.lg, borderWidth: 1, borderColor: C.border },
  iconBox: { width: 44, height: 44, borderRadius: R.md, backgroundColor: C.brandTertiary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "900", color: C.onSurface },
  body: { fontSize: 14, color: C.onSurfaceSecondary, marginTop: 3, lineHeight: 20 },
});
