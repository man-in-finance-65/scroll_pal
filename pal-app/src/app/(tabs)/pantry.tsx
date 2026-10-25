import { useMutation } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Card, Empty, ErrorBox, H1, H2, Loading, Note, Pill, Sub, s } from "../../components/ui";
import { cart as cartApi, pantryScan } from "../../lib/api";
import { normalizeName } from "../../lib/pantry";
import { useStore } from "../../lib/store";
import { colors, fonts } from "../../lib/theme";
import type { CartItem, Store } from "../../lib/types";

const STORES: { id: Store; label: string }[] = [
  { id: "instacart", label: "Instacart" },
  { id: "costco", label: "Costco" },
  { id: "doordash", label: "DoorDash" },
];
const qty = (c: CartItem) => (c.quantity === null ? "" : `${Number(c.quantity.toFixed(2))} ${c.unit}`.trim());

export default function PantryTab() {
  const store = useStore();
  const [shop, setShop] = useState<Store>("instacart");
  const [newStaple, setNewStaple] = useState("");
  const [copied, setCopied] = useState(false);

  // A line is ticked (to buy) unless your pantry has it; tapping flips that, and the flip is remembered.
  const lines = store.cart.map((c) => {
    const k = normalizeName(c.name);
    const inPantry = store.pantry.includes(k);
    const flipped = store.cartOff.includes(k);
    return { ...c, key: k, inPantry, buy: inPantry ? flipped : !flipped };
  });
  const toBuy = lines.filter((l) => l.buy);

  const scan = useMutation({
    mutationFn: async (source: "camera" | "library") => {
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], base64: true, quality: 0.4 };
      if (source === "camera") {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) throw new Error("Pal needs camera access to scan your pantry. You can allow it in Settings, or choose a photo instead.");
      }
      const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled) return null;
      const b64 = res.assets[0]?.base64;
      if (!b64) throw new Error("The photo came back without image data. Try another photo.");
      return pantryScan(b64);
    },
    onSuccess: (staples) => staples && store.addPantry(staples),
  });

  const send = useMutation({ mutationFn: () => cartApi(toBuy, shop) });

  const listText = toBuy.map((l) => `- ${l.name}${qty(l) ? ` (${qty(l)})` : ""}`).join("\n");

  return (
    <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
      <H1>Pantry & Cart</H1>

      <Card>
        <H2>📷 Scan your pantry</H2>
        <Sub>Take a photo of your spice rack, shelf or fridge. Staples Pal sees are unticked from the list.</Sub>
        <View style={s.row}>
          <View style={{ flex: 1 }}><Button title="Take photo" busy={scan.isPending && scan.variables === "camera"} disabled={scan.isPending} onPress={() => scan.mutate("camera")} /></View>
          <View style={{ flex: 1 }}><Button title="Choose photo" kind="ghost" disabled={scan.isPending} onPress={() => scan.mutate("library")} /></View>
        </View>
        {scan.isPending && <Loading text="Pal is looking at your photo…" />}
        {scan.isError && <ErrorBox message={scan.error.message} />}
        {scan.data && <Note>Pal saw: {scan.data.length ? scan.data.join(", ") : "no staples it was sure about"}. Fix anything below.</Note>}
        {scan.data === null && <Note>No photo chosen.</Note>}

        <Text style={st.label}>In your pantry ({store.pantry.length})</Text>
        <View style={st.chips}>
          {store.pantry.map((p) => (
            <Pressable key={p} onPress={() => store.removePantry(p)} style={st.staple}>
              <Text style={st.stapleText}>{p} ✕</Text>
            </Pressable>
          ))}
          {store.pantry.length === 0 && <Note>Nothing yet. Scan a photo or add staples by hand.</Note>}
        </View>
        <View style={s.row}>
          <TextInput style={st.input} value={newStaple} onChangeText={setNewStaple} placeholder="Add a staple, e.g. soy sauce" placeholderTextColor={colors.sub}
            onSubmitEditing={() => { store.addPantry([newStaple]); setNewStaple(""); }} returnKeyType="done" />
          <Button title="Add" kind="ghost" disabled={!newStaple.trim()} onPress={() => { store.addPantry([newStaple]); setNewStaple(""); }} />
        </View>
      </Card>

      {store.cart.length === 0 ? (
        <Empty emoji="🛒" title="Your shopping list is empty" body="Open a recipe and tap “Check Pantry & Order Cart”, or add your week from the Meal Plan tab." />
      ) : (
        <>
          <Card>
            <View style={s.row}>
              <H2>Shopping list</H2>
              <Pressable style={{ marginLeft: "auto" }} onPress={store.clearCart}><Text style={s.link}>Clear</Text></Pressable>
            </View>
            <Sub>Buying {toBuy.length} of {lines.length}. Tap a line to tick or untick it.</Sub>
            {lines.map((l) => (
              <Pressable key={`${l.name}|${l.unit}`} onPress={() => store.toggleCartLine(l.name)} style={st.line}>
                <Text style={st.box}>{l.buy ? "☑" : "☐"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[st.lineName, !l.buy && st.struck]}>{l.name}</Text>
                  <Note>{[qty(l), l.inPantry ? "in your pantry" : null, `for ${l.from.join(", ")}`].filter(Boolean).join(" · ")}</Note>
                </View>
              </Pressable>
            ))}
          </Card>

          <Card>
            <H2>Send to a store</H2>
            <View style={st.chips}>
              {STORES.map((x) => <Pill key={x.id} label={x.label} on={shop === x.id} onPress={() => { setShop(x.id); send.reset(); }} />)}
            </View>
            <Button title={`Open in ${STORES.find((x) => x.id === shop)!.label}`} busy={send.isPending} disabled={!toBuy.length} onPress={() => send.mutate()} />
            <Button
              title={copied ? "Copied ✓" : "Copy shopping list"}
              kind="ghost"
              disabled={!toBuy.length}
              onPress={async () => {
                await Clipboard.setStringAsync(listText);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            />
            {send.isError && <ErrorBox message={send.error.message} onRetry={() => send.mutate()} />}
            {send.data && (
              <>
                <Note>{send.data.note}</Note>
                {send.data.list_url && <Button title="Open shopping list" onPress={() => Linking.openURL(send.data!.list_url!)} />}
                {send.data.items.map((i) => (
                  <Pressable key={i.name} onPress={() => Linking.openURL(i.search_url)} style={st.line}>
                    <Text style={[st.lineName, { flex: 1 }]}>{i.name}</Text>
                    <Text style={s.link}>Open ↗</Text>
                  </Pressable>
                ))}
              </>
            )}
          </Card>

          <Card>
            <H2>Price comparison</H2>
            <Sub>Unavailable. Instacart, Costco and DoorDash don't give Pal real prices, and Pal never shows made-up ones. Each store shows its own prices when you open it.</Sub>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  label: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.sub, marginTop: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  staple: { backgroundColor: "#EEF2FF", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  stapleText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.violet },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 12 },
  line: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderTopColor: colors.border, borderTopWidth: 1 },
  box: { fontSize: 20, color: colors.primary },
  lineName: { fontFamily: fonts.body, fontSize: 15, color: colors.text },
  struck: { textDecorationLine: "line-through", color: colors.sub },
});
