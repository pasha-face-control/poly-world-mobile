import { useSyncExternalStore } from "react";
import { getHapticsOn, getSoundOn, subscribeFx } from "@/src/utils/fx";

/** Reactive read of the sound + vibration toggles. */
export function useFxSettings() {
  const soundOn = useSyncExternalStore(subscribeFx, getSoundOn, getSoundOn);
  const hapticsOn = useSyncExternalStore(subscribeFx, getHapticsOn, getHapticsOn);
  return { soundOn, hapticsOn };
}
