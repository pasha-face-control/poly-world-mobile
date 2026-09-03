import { Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { GameProvider } from "@/src/game/store";
import { initFx } from "@/src/utils/fx";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  // The entire app follows the device orientation (portrait or landscape).
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
  }, []);

  // Load sound/vibration prefs and prime the SFX players.
  useEffect(() => {
    initFx();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <GameProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </GameProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
