import { useSyncExternalStore } from "react";
import { getHapticsOn, getSoundOn, getVolume, subscribeFx } from "@/src/utils/fx";

/** Reactive read of the sound + vibration toggles and SFX volume. */
export function useFxSettings() {
  const soundOn = useSyncExternalStore(subscribeFx, getSoundOn, getSoundOn);
  const hapticsOn = useSyncExternalStore(subscribeFx, getHapticsOn, getHapticsOn);
  const volume = useSyncExternalStore(subscribeFx, getVolume, getVolume);
  return { soundOn, hapticsOn, volume };
}
