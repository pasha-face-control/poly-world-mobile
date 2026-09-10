import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SlotInfo, useGame } from "@/src/game/store";
import { TRIBE_BY_ID } from "@/src/game/data";
import { C, R, SP, shadow } from "@/src/theme";

interface Props {
  mode: "load" | "save";
  onSelect: (index: number, info: SlotInfo) => void | Promise<void>;
}

const STATUS_LABEL: Record<string, string> = { playing: "In progress", won: "Victory", lost: "Defeat", draw: "Draw" };

function fmtWhen(ts?: number): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} · ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return "";
  }
}

export default function SaveSlotList({ mode, onSelect }: Props) {
  const { listSlots } = useGame();
  const [slots, setSlots] = useState<SlotInfo[] | null>(null);

  const refresh = useCallback(async () => {
    setSlots(await listSlots());
  }, [listSlots]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handle = async (info: SlotInfo) => {
    if (mode === "load" && info.empty) return;
    await onSelect(info.index, info);
    refresh(); // reflect a just-saved slot immediately
  };

  if (!slots) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={C.brand} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {slots.map((info) => {
        const tribe = info.tribe ? TRIBE_BY_ID[info.tribe as keyof typeof TRIBE_BY_ID] : null;
        const disabled = mode === "load" && info.empty;
        return (
          <Pressable
            key={info.index}
            testID={`slot-${info.index}`}
            onPress={() => handle(info)}
            disabled={disabled}
            style={({ pressed }) => [styles.slot, shadow(2), { opacity: disabled ? 0.5 : pressed ? 0.9 : 1 }]}
          >
            <View style={[styles.iconBox, { backgroundColor: tribe?.color ?? C.surfaceSecondary }]}>
              {tribe ? (
                <MaterialCommunityIcons name={tribe.icon as any} size={22} color="#fff" />
              ) : (
                <Text style={styles.slotNum}>{info.index + 1}</Text>
              )}
            </View>

            <View style={styles.info}>
              <Text style={styles.title}>Slot {info.index + 1}</Text>
              {info.empty ? (
                <Text style={styles.sub}>Empty</Text>
              ) : (
                <Text style={styles.sub} numberOfLines={1}>
                  {tribe?.name ?? "Game"} · Turn {info.turn ?? 1} · {STATUS_LABEL[info.status ?? "playing"]}
                </Text>
              )}
              {!info.empty && <Text style={styles.when}>{fmtWhen(info.savedAt)}</Text>}
            </View>

            {mode === "save" ? (
              <View style={[styles.action, { backgroundColor: info.empty ? C.brand : C.warning }]}>
                <MaterialCommunityIcons name={info.empty ? "content-save" : "content-save-edit"} size={16} color="#fff" />
                <Text style={styles.actionText}>{info.empty ? "Save" : "Overwrite"}</Text>
              </View>
            ) : (
              <MaterialCommunityIcons name={info.empty ? "minus" : "chevron-right"} size={24} color={C.onSurfaceSecondary} />
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: SP.xxl, alignItems: "center" },
  list: { padding: SP.md, gap: SP.sm, paddingBottom: SP.xl },
  slot: { flexDirection: "row", alignItems: "center", gap: SP.md, backgroundColor: C.surface, borderRadius: R.lg, padding: SP.md, borderWidth: 1, borderColor: C.border },
  iconBox: { width: 44, height: 44, borderRadius: R.md, alignItems: "center", justifyContent: "center" },
  slotNum: { color: C.onSurfaceSecondary, fontSize: 18, fontWeight: "900" },
  info: { flex: 1 },
  title: { fontSize: 16, fontWeight: "800", color: C.onSurface },
  sub: { fontSize: 13, fontWeight: "600", color: C.onSurfaceSecondary, marginTop: 1 },
  when: { fontSize: 11, fontWeight: "600", color: C.onSurfaceSecondary, opacity: 0.75, marginTop: 1 },
  action: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.pill },
  actionText: { color: "#fff", fontSize: 13, fontWeight: "800" },
});
