import { Pressable, Text, View } from "react-native";
import { Card, haptic, Screen } from "../components/ui";
import { useStore } from "../lib/store";
import { brand, space, type, useTheme } from "../lib/theme";

// "Cart ready" is a stub: a checklist you tick in the shop. Nothing is bought or sent.
export default function Checklist() {
  const t = useTheme();
  const s = useStore();
  const ticked = s.checklist.filter((c) => c.checked).length;
  const batches = s.plan?.slots.filter((x) => x.kind === "cook").length ?? 0;

  return (
    <Screen padTop={false}>
      <Card style={{ backgroundColor: brand.orange + "1F" }}>
        <Text style={[type.label, { color: brand.orange }]}>Checklist, not a real cart</Text>
        <Text style={[type.body, { color: t.text }]}>Pal doesn't buy or send anything. Tick items off as you shop.</Text>
      </Card>

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[type.h2, { color: t.text }]}>{s.plan?.recipe.title ?? "Groceries"}</Text>
        <Text style={[type.body, { color: t.sub, fontVariant: ["tabular-nums"] }]}>
          {ticked}/{s.checklist.length}
        </Text>
      </View>
      {batches > 0 && (
        <Text style={[type.caption, { color: t.sub }]}>
          Amounts cover {batches} {batches === 1 ? "batch" : "batches"} (one per planned cook). ~ = Pal's estimate.
        </Text>
      )}

      {s.checklist.length === 0 ? (
        <Text style={[type.body, { color: t.sub }]}>Confirm a plan to get your checklist.</Text>
      ) : (
        <Card style={{ paddingVertical: space.xs }}>
          {s.checklist.map((c, i) => (
            <Pressable
              key={i}
              onPress={() => { haptic.tap(); s.toggleItem(i); }}
              style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: t.line }}
            >
              <View
                style={{
                  width: 26, height: 26, borderRadius: 13, borderWidth: 2,
                  borderColor: c.checked ? t.ok : t.faint, backgroundColor: c.checked ? t.ok : "transparent",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                {c.checked && <Text style={{ color: "#fff", fontWeight: "900" }}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { color: c.checked ? t.faint : t.text, textDecorationLine: c.checked ? "line-through" : "none" }]}>{c.name}</Text>
                {c.math && <Text style={[type.caption, { color: t.faint }]}>{c.estimated ? "~" : ""}{c.math}</Text>}
              </View>
              <Text style={[type.body, { color: t.sub, fontVariant: ["tabular-nums"] }]}>
                {c.estimated ? "~" : ""}
                {c.amount}
              </Text>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}
