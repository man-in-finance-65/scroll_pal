import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Pal } from "../../components/Pal";
import { Card, Empty, H1, H2, Note, Sub, s } from "../../components/ui";
import { MAX_LEVEL, STAMP_TIERS, badges, cookXp, creatorStamps, levelInfo, totalXp, xpToNext } from "../../lib/progress";
import { useStore } from "../../lib/store";
import { colors, fonts } from "../../lib/theme";

export default function PassportTab() {
  const store = useStore();
  const xp = totalXp(store.cooks);
  const lvl = levelInfo(xp);
  const stamps = creatorStamps(store.cooks);

  return (
    <ScrollView contentContainerStyle={s.screen}>
      <View style={[s.row, { gap: 14 }]}>
        <Pal size={72} />
        <View style={{ flex: 1 }}>
          <H1>Culinary Passport</H1>
          <Sub>Sous Chef level {lvl.level} of {MAX_LEVEL} · {xp} XP · {store.cooks.length} dish{store.cooks.length === 1 ? "" : "es"} cooked</Sub>
        </View>
      </View>

      <Card>
        <H2>How levels work</H2>
        <Note>Going from level L to L+1 costs 100 + 25 × (L − 1) XP. Level 2 = 100 XP, level 3 = 225, level 10 = 1,800, level 50 = 34,300.</Note>
        <Note>You're at level {lvl.level}: {lvl.floor} XP to get here + {lvl.into} since = {xp} XP. Next level needs {lvl.need || xpToNext(lvl.level)}.</Note>
      </Card>

      <H2>Skill tree</H2>
      {badges(store.cooks).map((b) => {
        const done = b.have >= b.need;
        return (
          <Card key={b.id} style={done ? { borderColor: colors.green } : undefined}>
            <View style={s.row}>
              <Text style={{ fontSize: 22 }}>{done ? "🏅" : "🔒"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.name}>{b.name}</Text>
                <Note>{b.rule}</Note>
              </View>
              <Text style={st.count}>{Math.min(b.have, b.need)}/{b.need}</Text>
            </View>
            <View style={st.bar}><View style={[st.fill, { width: `${Math.floor((Math.min(b.have, b.need) / b.need) * 100)}%` }, done && { backgroundColor: colors.green }]} /></View>
          </Card>
        );
      })}

      <H2>Creator stamps</H2>
      {stamps.length === 0 ? (
        <Empty emoji="🛂" title="No stamps yet" body={`Cook a creator's recipe to get their stamp. Stamps level up at ${STAMP_TIERS.join(", ")} recipes cooked.`} />
      ) : (
        <View style={st.grid}>
          {stamps.map((x) => (
            <View key={x.handle} style={st.stamp}>
              <Text style={st.stampHandle}>{x.handle}</Text>
              <Text style={st.stampText}>Cooked {x.tier} {x.handle} recipe{x.tier === 1 ? "" : "s"}</Text>
              <Note>{x.cooked} cooked{x.next ? ` · next stamp at ${x.next}` : " · top stamp"}</Note>
            </View>
          ))}
        </View>
      )}

      {store.cooks.length > 0 && (
        <Card>
          <H2>Cook log</H2>
          {[...store.cooks].reverse().map((c) => (
            <Note key={c.at}>
              {new Date(c.at).toLocaleDateString()} · {c.dish.title} · {c.xp.base} + {c.xp.protein} + {c.xp.noWaste} = {cookXp(c)} XP
            </Note>
          ))}
        </Card>
      )}

      <Pressable
        onPress={() =>
          Alert.alert("Start over?", "This deletes your recipes, plan, pantry, cart and XP from this phone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete everything", style: "destructive", onPress: store.reset },
          ])
        }
      >
        <Text style={[s.link, { color: colors.red, textAlign: "center", marginTop: 12 }]}>Start over</Text>
      </Pressable>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  name: { fontFamily: fonts.headingMid, fontSize: 15, color: colors.text },
  count: { fontFamily: fonts.heading, fontSize: 16, color: colors.text },
  bar: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, backgroundColor: colors.violet },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stamp: { width: "47%", borderWidth: 2, borderStyle: "dashed", borderColor: colors.primary, borderRadius: 16, padding: 12, gap: 4, backgroundColor: colors.card, transform: [{ rotate: "-2deg" }] },
  stampHandle: { fontFamily: fonts.heading, fontSize: 15, color: colors.primary },
  stampText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text },
});
