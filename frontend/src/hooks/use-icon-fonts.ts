// Icon fonts are now loaded automatically at runtime by
// @react-native-vector-icons/common (via ExpoFontLoader), including under
// Expo Go — so no manual CDN/expo-font registration is required.
// This hook is kept as a no-op so the splash-gate call site stays simple.
// Usage: const [loaded, error] = useIconFonts();
export const useIconFonts = (): readonly [boolean, Error | null] => [true, null] as const;
