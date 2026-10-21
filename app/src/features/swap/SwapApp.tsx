import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import type { Pod, PodView } from "../../../../engine/pods.ts";
import { goalLabel, type Goal } from "../../../../engine/swap.ts";
import { colors } from "../../lib/theme";
import { Button, Card, Chips, Label, Pal, Screen, Title, s } from "../pal/ui";
import type { DishInput, PodClient } from "./client";

type View_ = { name: "home" } | { name: "pod"; id: string } | { name: "goal"; id: string } | { name: "dish"; id: string } | { name: "chefs"; id: string } | { name: "swap"; id: string };

export function SwapApp({ client, onSolo }: { client: PodClient; onSolo?: () => void }) {
  const [view, setView] = useState<View_>({ name: "home" });
  const [pod, setPod] = useState<PodView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(label);
    setError(null);
    try { return await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  }, []);

  const open = async (p: Pod) => {
    const v = await run("Opening your pod…", () => client.get(p.id));
    if (v) { setPod(v); setView({ name: "pod", id: p.id }); }
  };
  const update = (v: PodView | undefined, next: View_["name"] = "pod") => { if (v) { setPod(v); setView({ name: next, id: v.pod.id } as View_); } };

  if (busy) return <Busy label={busy} />;

  if (view.name === "home") return <Home client={client} error={error} onOpen={open} run={run} onSolo={onSolo} />;
  if (!pod) return null;
  const back = () => { setError(null); setView({ name: "pod", id: pod.pod.id }); };

  if (view.name === "goal") return <GoalScreen pod={pod} error={error} onBack={back} onSave={(g) => run("Saving your goal…", () => client.setGoal(pod.pod.id, g)).then((v) => update(v))} />;
  if (view.name === "dish") return <DishScreen mode={client.mode} error={error} onBack={back} onSubmit={(input) => run(input.kind === "sample" ? "Adding your dish…" : "Pal is reading your recipe…", () => client.submitDish(pod.pod.id, input)).then((v) => update(v))} />;
  if (view.name === "chefs") return <ChefScreen pod={pod} error={error} onBack={back} onVote={(id) => run("Counting votes…", () => client.vote(pod.pod.id, id)).then((v) => update(v, "chefs"))} />;
  if (view.name === "swap") return <SwapScreen pod={pod} onBack={back} />;
  return (
    <PodScreen
      pod={pod}
      error={error}
      onHome={() => { setError(null); setView({ name: "home" }); }}
      onRefresh={() => run("Refreshing…", () => client.get(pod.pod.id)).then((v) => update(v))}
      go={(name) => { setError(null); setView({ name, id: pod.pod.id } as View_); }}
    />
  );
}

// ---------- Home ----------

function Home({ client, error, onOpen, run, onSolo }: { client: PodClient; error: string | null; onOpen: (p: Pod) => void; run: <T>(l: string, f: () => Promise<T>) => Promise<T | undefined>; onSolo?: () => void }) {
  const [pods, setPods] = useState<Pod[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  useEffect(() => { client.list().then(setPods).catch(() => {}); }, [client]);

  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 14, marginTop: 8 }}>
        <Pal mood="excited" size={104} />
        <Text style={[s.title, { fontSize: 36, textAlign: "center" }]}>Meal Prep Swap</Text>
        <Text style={[s.sub, { textAlign: "center", fontSize: 17 }]}>Three friends, three dishes from your saved reels, one chef. Everyone takes home 9 meals.</Text>
      </View>
      <Button label="Try the demo pod" onPress={async () => { const p = await run("Setting up the demo pod…", () => client.demo()); if (p) onOpen(p); }} />
      <Text style={[s.sub, { textAlign: "center", fontSize: 13, marginTop: -6 }]}>Maya and Dev are already in. Add your goal, your dish and your chef vote.</Text>
      {error && <ErrorText text={error} />}

      {pods.length > 0 && (
        <Card>
          <Label>Your pods</Label>
          {pods.map((p) => (
            <Pressable key={p.id} onPress={() => onOpen(p)} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{p.name}</Text>
              <Text style={{ color: colors.muted }}>{p.members.length}/3 ›</Text>
            </Pressable>
          ))}
        </Card>
      )}

      <Card>
        <Label>Start a pod</Label>
        <Input value={name} onChange={setName} placeholder="Pod name, e.g. Sunday Swap" />
        <Button label="Create pod" variant="ghost" onPress={async () => { const p = await run("Creating your pod…", () => client.create(name)); if (p) onOpen(p); }} />
      </Card>
      <Card>
        <Label>Join with an invite code</Label>
        <Input value={code} onChange={(t) => setCode(t.toUpperCase())} placeholder="6 letters, e.g. K7PQ2M" />
        <Button label="Join pod" variant="ghost" disabled={code.trim().length < 6} onPress={async () => { const p = await run("Joining…", () => client.join(code)); if (p) onOpen(p); }} />
      </Card>
      {client.mode === "demo" && <Text style={[s.sub, { fontSize: 12, textAlign: "center" }]}>Demo mode: everything stays on this device. Reading real reels needs the Pal server.</Text>}
      {onSolo && <Pressable onPress={onSolo}><Text style={{ textAlign: "center", color: colors.violet, fontWeight: "600" }}>Or plan a solo week ›</Text></Pressable>}
    </Screen>
  );
}

// ---------- Pod ----------

function PodScreen({ pod, error, onHome, onRefresh, go }: { pod: PodView; error: string | null; onHome: () => void; onRefresh: () => void; go: (v: "goal" | "dish" | "chefs" | "swap") => void }) {
  const mine = pod.members.find((m) => m.userId === pod.me)!;
  const dishesIn = pod.dishes.length;
  const nextStep = pod.members.length < 3 ? `Share code ${pod.pod.code} so ${3 - pod.members.length} more can join.`
    : !mine.goal ? "Set your goal so Pal can flag dishes that don't fit it."
    : !mine.hasDish ? "Add your dish: a reel link with its caption, or a screenshot."
    : dishesIn < 3 ? "Waiting for the others' dishes."
    : !pod.chef ? "Vote for a chef. Two votes pick one."
    : "Your swap is ready.";

  return (
    <Screen>
      <Pressable onPress={onHome}><Text style={{ color: colors.violet, fontWeight: "700", fontSize: 16 }}>‹ All pods</Text></Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Pal mood={pod.complete && pod.chef ? "excited" : "helping"} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[s.title, { fontSize: 24 }]}>{pod.pod.name}</Text>
          <Text style={s.sub}>{nextStep}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Stat label="Invite code" value={pod.pod.code} mono />
        <Stat label="Members" value={`${pod.members.length} / 3`} />
        <Stat label="Dishes" value={`${dishesIn} / 3`} />
      </View>
      {error && <ErrorText text={error} />}

      {pod.complete && (
        <Pressable onPress={() => go("swap")} style={{ backgroundColor: colors.navy, borderRadius: 20, padding: 18, gap: 4 }}>
          <Text style={{ color: colors.mint, fontWeight: "800", fontSize: 13, letterSpacing: 0.8 }}>SWAP READY</Text>
          <Text style={{ color: colors.white, fontSize: 20, fontWeight: "800" }}>27 portions · 9 meals each</Text>
          <Text style={{ color: "#B9BCD6" }}>
            {pod.swap ? `${money(pod.swap.cost.perMember[0], pod.swap.cost.currency)} each${pod.chef ? ` with ${pod.chef.name}` : " before the chef's fee"} · grocery list, prep sheet and split ›` : ""}
          </Text>
        </Pressable>
      )}

      <Label>Members</Label>
      {Array.from({ length: 3 }, (_, k) => pod.members[k]).map((m, k) =>
        m ? (
          <Card key={m.userId} style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>{label(m, pod.me)}</Text>
              <Pill text={m.hasDish ? "Dish in" : "No dish yet"} tone={m.hasDish ? "good" : "muted"} />
            </View>
            <Text style={{ color: colors.muted }}>{m.goal ? goalLabel(m.goal) : "No goal yet"}</Text>
            {m.userId === pod.me && (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <SmallButton label={m.goal ? "Change goal" : "Set my goal"} primary={!m.goal} onPress={() => go("goal")} />
                <SmallButton label={m.hasDish ? "Replace dish" : "Add my dish"} primary={!!m.goal && !m.hasDish} onPress={() => go("dish")} />
              </View>
            )}
          </Card>
        ) : (
          <Card key={`empty-${k}`} style={{ borderWidth: 1.5, borderStyle: "dashed", borderColor: "#CFCDEB", backgroundColor: "transparent", shadowOpacity: 0 }}>
            <Text style={{ color: colors.muted }}>Open seat. Share invite code <Text style={{ fontWeight: "800", color: colors.text }}>{pod.pod.code}</Text>.</Text>
          </Card>
        ),
      )}

      {pod.dishes.length > 0 && <Label>Dishes</Label>}
      {pod.dishes.map((d) => <DishCard key={d.memberId} dish={d} />)}

      <Label>Chef</Label>
      <Pressable onPress={() => go("chefs")}>
        <Card>
          <Text style={{ fontSize: 17, fontWeight: "800", color: colors.text }}>{pod.chef ? `${pod.chef.name} is cooking` : "No chef picked yet"}</Text>
          <Text style={{ color: colors.muted }}>{pod.chef ? `${money(pod.chef.ratePerPortion, "CAD")} a portion · tap to see votes ›` : `${Object.keys(pod.pod.votes).length} of 3 votes in · tap to vote ›`}</Text>
        </Card>
      </Pressable>
      <Button label="Refresh" variant="ghost" onPress={onRefresh} />
    </Screen>
  );
}

function DishCard({ dish }: { dish: PodView["dishes"][number] }) {
  const [open, setOpen] = useState(false);
  const m = dish.macros;
  return (
    <Card>
      <Pressable onPress={() => setOpen(!open)} style={{ gap: 6 }}>
        <Text style={s.label}>From {dish.by}{dish.source.kind === "sample" ? " · sample" : dish.source.kind === "screenshot" ? " · screenshot" : " · reel"}</Text>
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>{dish.name}</Text>
        <Text style={{ color: colors.muted }}>{m.kcal} kcal · {m.proteinG} g protein · {m.carbsG} g carbs · {m.fatG} g fat per portion</Text>
      </Pressable>
      {dish.conflicts.map((c) => c.reasons.map((r) => <Pill key={c.member + r} text={`Clashes with ${c.member}'s goal: ${r}`} tone="warn" />))}
      {open && (
        <View style={{ gap: 6, marginTop: 4 }}>
          <Label>Per portion</Label>
          {dish.ingredients.map((i, k) => <Text key={k} style={{ color: colors.text }}>{fmtQty(i.qty)} {i.unit} {i.name}</Text>)}
          <Label>Steps</Label>
          {dish.steps.map((st, k) => <Text key={k} style={{ color: colors.text, lineHeight: 21 }}>{k + 1}. {st}</Text>)}
        </View>
      )}
      <Pressable onPress={() => setOpen(!open)}><Text style={{ color: colors.violet, fontWeight: "600" }}>{open ? "Hide recipe" : "Show recipe"} · macros are Claude's estimate</Text></Pressable>
    </Card>
  );
}

// ---------- Goal ----------

function GoalScreen({ pod, error, onBack, onSave }: { pod: PodView; error: string | null; onBack: () => void; onSave: (g: Goal) => void }) {
  const current = pod.members.find((m) => m.userId === pod.me)?.goal;
  const [kind, setKind] = useState<Goal["kind"]>(current?.kind ?? "high-protein");
  const [n1, setN1] = useState(current?.kind === "high-protein" ? String(current.minProteinG) : current?.kind === "calorie-target" ? String(current.dailyKcal) : current?.kind === "low-carb" ? String(current.maxCarbsG) : "");
  const [meals, setMeals] = useState(current?.kind === "calorie-target" ? current.mealsPerDay : 3);
  const defaults: Record<Goal["kind"], string> = { "high-protein": "30", "calorie-target": "1800", "low-carb": "40", vegetarian: "" };
  const goal = (): Goal => {
    const n = Number(n1 || defaults[kind]);
    if (kind === "high-protein") return { kind, minProteinG: n };
    if (kind === "calorie-target") return { kind, dailyKcal: n, mealsPerDay: meals };
    if (kind === "low-carb") return { kind, maxCarbsG: n };
    return { kind: "vegetarian" };
  };
  return (
    <Screen>
      <Back onPress={onBack} />
      <Pal mood="listening" size={64} />
      <Title sub="Pal checks every dish in the pod against it and flags the ones that don't fit.">Your goal</Title>
      <Chips options={[{ value: "high-protein", label: "High protein" }, { value: "calorie-target", label: "Calorie target" }, { value: "low-carb", label: "Low carb" }, { value: "vegetarian", label: "Vegetarian" }]} value={kind} onChange={(k) => { setKind(k as Goal["kind"]); setN1(""); }} />
      {kind === "high-protein" && <><Label>Protein per meal, at least</Label><Input value={n1} onChange={setN1} placeholder={`${defaults[kind]} g`} numeric /></>}
      {kind === "calorie-target" && (
        <>
          <Label>Calories a day</Label>
          <Input value={n1} onChange={setN1} placeholder={`${defaults[kind]} kcal`} numeric />
          <Label>Meals a day</Label>
          <Chips options={[2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }))} value={meals} onChange={setMeals} />
        </>
      )}
      {kind === "low-carb" && <><Label>Carbs per meal, under</Label><Input value={n1} onChange={setN1} placeholder={`${defaults[kind]} g`} numeric /></>}
      {error && <ErrorText text={error} />}
      <Button label="Save goal" onPress={() => onSave(goal())} />
    </Screen>
  );
}

// ---------- Dish ----------

function DishScreen({ mode, error, onBack, onSubmit }: { mode: PodClient["mode"]; error: string | null; onBack: () => void; onSubmit: (d: DishInput) => void }) {
  const [tab, setTab] = useState<"reel" | "screenshot" | "sample">(mode === "demo" ? "sample" : "reel");
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.6 });
    const a = r.canceled ? null : r.assets[0];
    if (a?.base64) onSubmit({ kind: "screenshot", mediaType: "image/jpeg", data: a.base64 });
  };
  return (
    <Screen>
      <Back onPress={onBack} />
      <Pal mood="listening" size={64} />
      <Title sub="Pal turns it into ingredients per portion, steps and macros. The chef makes 9 portions of it.">Add your dish</Title>
      <Chips options={[{ value: "reel", label: "Reel link" }, { value: "screenshot", label: "Screenshot" }, { value: "sample", label: "Sample dish" }]} value={tab} onChange={(t) => setTab(t as typeof tab)} />
      {tab === "reel" && (
        <>
          <Label>Reel link</Label>
          <Input value={url} onChange={setUrl} placeholder="https://www.instagram.com/reel/…" />
          <Label>Caption</Label>
          <Text style={[s.sub, { fontSize: 13 }]}>Pal can't watch the video, so paste the caption with the recipe. In Instagram: tap "more" under the reel, then copy.</Text>
          <Input value={caption} onChange={setCaption} placeholder="Paste the caption here" multiline />
          <Button label="Read this reel" disabled={!url.trim() || caption.trim().length < 10} onPress={() => onSubmit({ kind: "reel", url: url.trim(), caption })} />
        </>
      )}
      {tab === "screenshot" && (
        <>
          <Text style={s.sub}>Screenshot a recipe card, a caption, or a recipe site. Pal reads the picture.</Text>
          <Button label="Choose a screenshot" onPress={pick} />
        </>
      )}
      {tab === "sample" && (
        <>
          <Text style={s.sub}>No reel handy? Use one of these, already read by Pal.</Text>
          {([["pesto", "Creamy Pesto Pasta", "690 kcal · 21 g protein"], ["tikka", "Chicken Tikka Rice Bowls", "520 kcal · 46 g protein"], ["chili", "Turkey & Black Bean Chili", "410 kcal · 34 g protein"]] as const).map(([k, title, sub]) => (
            <Pressable key={k} onPress={() => onSubmit({ kind: "sample", sample: k })}>
              <Card><Text style={{ fontSize: 17, fontWeight: "800", color: colors.text }}>{title}</Text><Text style={{ color: colors.muted }}>{sub} · tap to add</Text></Card>
            </Pressable>
          ))}
        </>
      )}
      {error && <ErrorText text={error} />}
    </Screen>
  );
}

// ---------- Chefs ----------

function ChefScreen({ pod, error, onBack, onVote }: { pod: PodView; error: string | null; onBack: () => void; onVote: (id: string) => void }) {
  return (
    <Screen>
      <Back onPress={onBack} />
      <Title sub="One vote each. The first chef to get 2 votes cooks for the pod.">Pick your chef</Title>
      {error && <ErrorText text={error} />}
      {pod.chefs.map((c) => {
        const chosen = pod.chef?.id === c.id;
        return (
          <Card key={c.id} style={chosen ? { borderWidth: 2, borderColor: colors.mint } : undefined}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 19, fontWeight: "800", color: colors.text }}>{c.name}</Text>
              {chosen ? <Pill text="Cooking for you" tone="good" /> : <Text style={{ color: colors.muted, fontWeight: "700" }}>{money(c.ratePerPortion, "CAD")}/portion</Text>}
            </View>
            <Text style={{ color: colors.violet, fontWeight: "700" }}>{c.specialty}</Text>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>{c.bio}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[0, 1, 2].map((k) => <View key={k} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: k < c.votes ? colors.violet : "#E2E1F5" }} />)}
              </View>
              <Text style={{ color: colors.muted, flex: 1 }}>{c.votes} vote{c.votes === 1 ? "" : "s"} · 27 portions = {money(c.ratePerPortion * 27, "CAD")}</Text>
              <SmallButton label={c.votedByMe ? "Your vote" : "Vote"} primary={!c.votedByMe} onPress={() => onVote(c.id)} />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

// ---------- Swap ----------

function SwapScreen({ pod, onBack }: { pod: PodView; onBack: () => void }) {
  const [tab, setTab] = useState<"grocery" | "prep" | "cost" | "meals">("grocery");
  const swap = pod.swap!;
  const [got, setGot] = useState<Set<string>>(new Set());
  const cur = swap.cost.currency;
  let lastPhase = "";
  return (
    <Screen>
      <Back onPress={onBack} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Pal mood="excited" size={56} />
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { fontSize: 24 }]}>The swap</Text>
          <Text style={s.sub}>{pod.chef ? `${pod.chef.name} cooks 27 portions in one session.` : "Pick a chef to add their fee to the split."}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Stat label="Portions" value="27" />
        <Stat label="Meals each" value="9" />
        <Stat label="Each pays" value={money(swap.cost.perMember[pod.members.findIndex((m) => m.userId === pod.me)] ?? swap.cost.perMember[0], cur)} />
      </View>
      <Chips options={[{ value: "grocery", label: `Groceries · ${swap.grocery.length}` }, { value: "prep", label: "Prep sheet" }, { value: "cost", label: "Cost split" }, { value: "meals", label: "My 9 meals" }]} value={tab} onChange={(t) => setTab(t as typeof tab)} />

      {tab === "grocery" && (
        <Card>
          <Label>Everything for 27 portions</Label>
          {swap.grocery.map((l) => {
            const k = `${l.name}|${l.base}`, done = got.has(k);
            return (
              <Pressable key={k} onPress={() => { const n = new Set(got); done ? n.delete(k) : n.add(k); setGot(n); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}>
                <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: done ? colors.mint : "#CFCDEB", backgroundColor: done ? colors.mint : "transparent", alignItems: "center", justifyContent: "center" }}>
                  {done && <Text style={{ color: colors.navy, fontWeight: "900", fontSize: 13 }}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, color: done ? colors.muted : colors.text, textDecorationLine: done ? "line-through" : "none", textTransform: "capitalize" }}>{l.name}</Text>
                  {l.dishes.length > 1 && <Text style={{ fontSize: 12, color: colors.violet }}>Merged from {l.dishes.length} dishes</Text>}
                </View>
                <Text style={{ fontSize: 15, color: colors.text, fontWeight: "700" }}>{l.base === "count" ? `× ${l.display}` : l.display}</Text>
                <Text style={{ fontSize: 13, color: colors.muted, width: 58, textAlign: "right" }}>{l.cost === null ? "no price" : money(l.cost, cur)}</Text>
              </Pressable>
            );
          })}
        </Card>
      )}

      {tab === "prep" && (
        <Card>
          {swap.prep.map((st, k) => {
            const header = st.phase !== lastPhase ? (lastPhase = st.phase) : null;
            return (
              <View key={k} style={{ gap: 4 }}>
                {header && <Label>{header}</Label>}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Text style={{ color: colors.violet, fontWeight: "800", width: 22 }}>{k + 1}</Text>
                  <View style={{ flex: 1 }}>
                    {st.dish && <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted }}>{st.dish}</Text>}
                    <Text style={{ fontSize: 15, lineHeight: 21, color: colors.text }}>{st.text}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {tab === "cost" && (
        <Card>
          <Row label="Ingredients (from the price table)" value={money(swap.cost.ingredients, cur)} />
          <Row label={pod.chef ? `${pod.chef.name}: 27 × ${money(pod.chef.ratePerPortion, cur)}` : "Chef (not picked yet)"} value={money(swap.cost.chef, cur)} />
          <View style={{ height: 1, backgroundColor: "#ECEBFA" }} />
          <Row label="Total" value={money(swap.cost.total, cur)} bold />
          <Label>Split three ways</Label>
          {pod.members.map((m, k) => <Row key={m.userId} label={label(m, pod.me)} value={money(swap.cost.perMember[k], cur)} bold />)}
          <Text style={{ color: colors.muted, fontSize: 13 }}>That's {money(swap.cost.perMember[0] / 9, cur)} a meal. No payments in the app; settle up however your pod likes.</Text>
          {swap.cost.unpriced.length > 0 && <Text style={{ color: colors.orange, fontSize: 13 }}>No price for: {swap.cost.unpriced.join(", ")}. Add them to data/prices.json.</Text>}
        </Card>
      )}

      {tab === "meals" && (
        <>
          <Text style={s.sub}>You take home 3 portions of each dish.</Text>
          {pod.dishes.map((d) => (
            <Card key={d.memberId}>
              <Text style={{ fontSize: 17, fontWeight: "800", color: colors.text }}>3 × {d.name}</Text>
              <Text style={{ color: colors.muted }}>from {d.by} · {d.macros.kcal} kcal · {d.macros.proteinG} g protein each</Text>
              {d.conflicts.filter((c) => c.member === pod.members.find((m) => m.userId === pod.me)?.name).map((c) => c.reasons.map((r) => <Pill key={r} text={`Doesn't fit your goal: ${r}`} tone="warn" />))}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

// ---------- Small pieces ----------

const label = (m: { userId: string; name: string }, me: string) => (m.userId !== me ? m.name : m.name === "You" ? "You" : `${m.name} (you)`);
const money = (n: number, cur: string) => `${cur === "CAD" ? "$" : ""}${n.toFixed(2)}`;
const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, ""));

function Busy({ label }: { label: string }) {
  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 18, marginTop: 100 }}>
        <Pal mood="thinking" size={110} />
        <Text style={[s.title, { fontSize: 22, textAlign: "center" }]}>{label}</Text>
        <ActivityIndicator color={colors.violet} />
      </View>
    </Screen>
  );
}
function Back({ onPress }: { onPress: () => void }) {
  return <Pressable onPress={onPress}><Text style={{ color: colors.violet, fontWeight: "700", fontSize: 16 }}>‹ Back to pod</Text></Pressable>;
}
function ErrorText({ text }: { text: string }) {
  return <Text style={{ color: "#C2185B", backgroundColor: "#FFE8F1", padding: 12, borderRadius: 12, overflow: "hidden" }}>{text}</Text>;
}
function Input({ value, onChange, placeholder, numeric, multiline }: { value: string; onChange: (t: string) => void; placeholder: string; numeric?: boolean; multiline?: boolean }) {
  return (
    <TextInput
      value={value}
      onChangeText={(t) => onChange(numeric ? t.replace(/[^0-9]/g, "") : t)}
      placeholder={placeholder}
      placeholderTextColor="#9A9DB8"
      keyboardType={numeric ? "numeric" : "default"}
      autoCapitalize="none"
      multiline={multiline}
      style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: "#E2E1F5", borderRadius: 14, padding: 14, fontSize: 16, color: colors.text, minHeight: multiline ? 120 : undefined, textAlignVertical: multiline ? "top" : "center" }}
    />
  );
}
function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 12, gap: 2 }}>
      <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>{label}</Text>
      <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: mono ? 1.5 : 0 }}>{value}</Text>
    </View>
  );
}
function Pill({ text, tone }: { text: string; tone: "good" | "warn" | "muted" }) {
  const bg = tone === "good" ? "#DDF7E8" : tone === "warn" ? "#FFF0E6" : "#EEEDF8";
  const fg = tone === "good" ? "#14804A" : tone === "warn" ? "#B4501A" : colors.muted;
  return <Text style={{ alignSelf: "flex-start", backgroundColor: bg, color: fg, fontWeight: "700", fontSize: 13, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: "hidden" }}>{text}</Text>;
}
function SmallButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, backgroundColor: primary ? colors.violet : "transparent", borderWidth: 1.5, borderColor: colors.violet }}>
      <Text style={{ color: primary ? colors.white : colors.violet, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}
function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ color: colors.text, flex: 1, fontWeight: bold ? "700" : "400" }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: bold ? "800" : "600", fontVariant: ["tabular-nums"] }}>{value}</Text>
    </View>
  );
}
