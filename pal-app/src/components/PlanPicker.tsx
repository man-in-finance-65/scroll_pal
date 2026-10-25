import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useStore, weekDays } from "../lib/store";
import { colors, fonts } from "../lib/theme";
import { SLOTS, type Dish, type Slot } from "../lib/types";
import { Button, H2, Sub } from "./ui";

export const dayLabel = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
export const slotLabel: Record<Slot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

/** Pick a day and meal for a dish. Taken slots show what is there; choosing one replaces it. */
export function PlanPicker({ dish, visible, onClose, onSaved }: { dish: Dish; visible: boolean; onClose: () => void; onSaved: (day: string, slot: Slot) => void }) {
  const { plan, planDish } = useStore();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={st.wrap}>
        <H2>Add “{dish.title}” to this week</H2>
        <Sub>Tap a meal. A taken one is replaced.</Sub>
        {weekDays().map((day) => (
          <View key={day} style={st.day}>
            <Text style={st.dayText}>{dayLabel(day)}</Text>
            <View style={st.slots}>
              {SLOTS.map((slot) => {
                const taken = plan[day]?.[slot];
                return (
                  <Pressable
                    key={slot}
                    style={[st.slot, taken && st.taken]}
                    onPress={() => {
                      planDish(day, slot, dish);
                      onSaved(day, slot);
                    }}
                  >
                    <Text style={st.slotName}>{slotLabel[slot]}</Text>
                    <Text style={st.slotDish} numberOfLines={1}>{taken ? taken.title : "empty"}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <Button title="Cancel" kind="ghost" onPress={onClose} />
      </ScrollView>
    </Modal>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 20, gap: 12, backgroundColor: colors.bg, paddingBottom: 48 },
  day: { gap: 6 },
  dayText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.sub },
  slots: { flexDirection: "row", gap: 8 },
  slot: { flex: 1, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 10 },
  taken: { borderColor: colors.violet },
  slotName: { fontFamily: fonts.headingMid, fontSize: 13, color: colors.text },
  slotDish: { fontFamily: fonts.body, fontSize: 11, color: colors.sub },
});
