import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from "react-native";
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
  const [swapTab, setSwapTab] = useState<SwapTab>("grocery");

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
  if (view.name === "chefs") return <ChefScreen pod={pod} onBack={back} />;
  if (view.name === "swap")
    return (
      <SwapScreen
        pod={pod}
        error={error}
        tab={swapTab}
        setTab={setSwapTab}
        onBack={back}
        onReceipt={(t) => run("Updating the split…", () => client.setReceipt(pod.pod.id, t)).then((v) => update(v, "swap"))}
        onInstacart={async () => { setError(null); try { const url = await client.instacart(pod.pod.id); await Linking.openURL(url); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } }}
      />
    );
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
      <Text style={[s.sub, { textAlign: "center", fontSize: 13, marginTop: -6 }]}>Maya and Dev are already in. Add your goal and your dish.</Text>
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
      {client.mode === "demo" && <Text style={[s.sub, { fontSize: 12, textAlign: "center" }]}>Preview mode: everything stays on this device. Watching real reels and Add to Instacart need the Pal server.</Text>}
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
    : "Your swap is ready. Send the list to Instacart.";

  return (
    <Screen>
      <Pressable onPress={onHome}><Text style={{ color: colors.violet, fontWeight: "700", fontSize: 16 }}>‹ All pods</Text></Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Pal mood={pod.complete ? "excited" : "helping"} size={56} />
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
            {pod.swap ? `About ${money(pod.swap.cost.perMember[0], pod.swap.cost.currency)} each · grocery list, Instacart, prep sheet and split ›` : ""}
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

      <Pressable onPress={() => go("chefs")}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flexDirection: "row" }}>
            {pod.creatorChefs.map((c, k) => <Avatar key={c.handle} name={c.name} hue={c.hue} size={34} style={{ marginLeft: k ? -10 : 0 }} />)}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>Creator chefs</Text>
            <Text style={{ color: colors.muted }}>Your favourite food creators cook your pod's 27 portions</Text>
          </View>
          <Pill text="Soon" tone="muted" />
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
  const [showCaption, setShowCaption] = useState(false);
  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.6 });
    const a = r.canceled ? null : r.assets[0];
    if (a?.base64) onSubmit({ kind: "screenshot", mediaType: "image/jpeg", data: a.base64 });
  };
  return (
    <Screen>
      <Back onPress={onBack} />
      <Pal mood="listening" size={64} />
      <Title sub="Paste a reel link. Pal watches it and writes the ingredients per portion, the steps and the macros. Your pod makes 9 portions of it.">Add your dish</Title>
      <Chips options={[{ value: "reel", label: "Reel link" }, { value: "screenshot", label: "Screenshot" }, { value: "sample", label: "Sample dish" }]} value={tab} onChange={(t) => setTab(t as typeof tab)} />
      {tab === "reel" && (
        <>
          <Label>Reel link</Label>
          <Input value={url} onChange={setUrl} placeholder="https://www.instagram.com/reel/…" />
          <Text style={[s.sub, { fontSize: 13 }]}>Pal watches the video and writes the recipe. In Instagram: tap Share on the reel, then Copy link.</Text>
          {showCaption ? (
            <>
              <Label>Caption (optional)</Label>
              <Input value={caption} onChange={setCaption} placeholder="Paste the caption if it has the recipe" multiline />
            </>
          ) : (
            <Pressable onPress={() => setShowCaption(true)}><Text style={{ color: colors.violet, fontWeight: "600" }}>+ Add the caption too (helps with amounts)</Text></Pressable>
          )}
          <Button label="Watch this reel" disabled={!/^https?:\/\//.test(url.trim())} onPress={() => onSubmit({ kind: "reel", url: url.trim(), caption: caption.trim() || undefined })} />
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

// ---------- Creator chefs (coming soon) ----------

function ChefScreen({ pod, onBack }: { pod: PodView; onBack: () => void }) {
  const [notify, setNotify] = useState<Set<string>>(new Set());
  return (
    <Screen>
      <Back onPress={onBack} />
      <View style={{ backgroundColor: colors.navy, borderRadius: 24, padding: 22, gap: 8 }}>
        <Text style={{ color: colors.mint, fontWeight: "800", letterSpacing: 1, fontSize: 13 }}>COMING SOON</Text>
        <Text style={{ color: colors.white, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 }}>Creator chefs</Text>
        <Text style={{ color: "#B9BCD6", fontSize: 16, lineHeight: 22 }}>The creators whose reels you save, cooking your pod's 27 portions. Book them straight from their page, and they get paid for the recipes you already love.</Text>
      </View>
      {pod.creatorChefs.map((c) => {
        const on = notify.has(c.handle);
        return (
          <Card key={c.handle} style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Avatar name={c.name} hue={c.hue} size={58} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>{c.handle}</Text>
                <Text style={{ color: colors.muted }}>{c.niche} · {c.followers} followers</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 12 }}>
                <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>Pod cook-up</Text>
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>from {money(c.fromPerPortion, "CAD")}/portion</Text>
              </View>
              <Pressable onPress={() => { const n = new Set(notify); on ? n.delete(c.handle) : n.add(c.handle); setNotify(n); }} style={{ flex: 1, borderRadius: 14, padding: 12, justifyContent: "center", alignItems: "center", backgroundColor: on ? colors.mint : c.hue }}>
                <Text style={{ color: on ? colors.navy : colors.white, fontWeight: "800" }}>{on ? "✓ You're on the list" : "Notify me"}</Text>
              </Pressable>
            </View>
          </Card>
        );
      })}
      <Text style={[s.sub, { fontSize: 12, textAlign: "center" }]}>Example creator profiles for the preview.</Text>
    </Screen>
  );
}

// ---------- Swap ----------

type SwapTab = "grocery" | "prep" | "cost" | "meals";
function SwapScreen({ pod, error, tab, setTab, onBack, onReceipt, onInstacart }: { pod: PodView; error: string | null; tab: SwapTab; setTab: (t: SwapTab) => void; onBack: () => void; onReceipt: (t: number | null) => void; onInstacart: () => void }) {
  const [receipt, setReceiptText] = useState(pod.pod.receiptTotal ? String(pod.pod.receiptTotal) : "");
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
          <Text style={s.sub}>27 portions, one cook-up. Send the list to Instacart, then split what you paid.</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Stat label="Portions" value="27" />
        <Stat label="Meals each" value="9" />
        <Stat label={swap.cost.source === "receipt" ? "Each pays" : "Each, about"} value={money(swap.cost.perMember[pod.members.findIndex((m) => m.userId === pod.me)] ?? swap.cost.perMember[0], cur)} />
      </View>
      <Chips options={[{ value: "grocery", label: `Groceries · ${swap.grocery.length}` }, { value: "prep", label: "Prep sheet" }, { value: "cost", label: "Cost split" }, { value: "meals", label: "My 9 meals" }]} value={tab} onChange={(t) => setTab(t as typeof tab)} />

      {error && <ErrorText text={error} />}
      {tab === "grocery" && (
        <>
        <Pressable onPress={onInstacart} style={({ pressed }) => ({ backgroundColor: "#0AAD0A", borderRadius: 16, padding: 16, alignItems: "center", opacity: pressed ? 0.85 : 1 })}>
          <Text style={{ color: colors.white, fontWeight: "800", fontSize: 17 }}>Add all {swap.grocery.length} items to Instacart</Text>
          <Text style={{ color: "#E2F7E2", fontSize: 13 }}>Opens Instacart with your list. You sign in and check out there.</Text>
        </Pressable>
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
                <Text style={{ fontSize: 13, color: colors.muted, width: 58, textAlign: "right" }}>{l.cost === null ? "" : `~${money(l.cost, cur)}`}</Text>
              </Pressable>
            );
          })}
          <Text style={{ color: colors.muted, fontSize: 12 }}>~ = estimate from typical Toronto prices. Instacart shows the real prices for your store.</Text>
        </Card>
        </>
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
          <Row label={swap.cost.source === "receipt" ? "Groceries (receipt)" : "Groceries (estimate)"} value={money(swap.cost.ingredients, cur)} bold />
          <Label>Split three ways</Label>
          {pod.members.map((m, k) => <Row key={m.userId} label={label(m, pod.me)} value={money(swap.cost.perMember[k], cur)} bold />)}
          <Text style={{ color: colors.muted, fontSize: 13 }}>That's {money(swap.cost.perMember[0] / 9, cur)} a meal. No payments in the app; settle up however your pod likes.</Text>
          <View style={{ height: 1, backgroundColor: "#ECEBFA" }} />
          <Label>{swap.cost.source === "receipt" ? "Receipt total" : "Did the shopping? Enter the receipt total"}</Label>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <View style={{ flex: 1 }}><Input value={receipt} onChange={setReceiptText} placeholder="e.g. 84.37" decimal /></View>
            <SmallButton label="Split it" primary onPress={() => onReceipt(receipt ? Number(receipt) : null)} />
          </View>
          {swap.cost.source === "estimate" && <Text style={{ color: colors.muted, fontSize: 13 }}>Until then the split uses typical prices, so it's a ballpark, not a bill.</Text>}
          <Text style={{ color: colors.muted, fontSize: 13 }}>Creator chefs (coming soon) will add their fee here.</Text>
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
function Input({ value, onChange, placeholder, numeric, decimal, multiline }: { value: string; onChange: (t: string) => void; placeholder: string; numeric?: boolean; decimal?: boolean; multiline?: boolean }) {
  return (
    <TextInput
      value={value}
      onChangeText={(t) => onChange(numeric ? t.replace(/[^0-9]/g, "") : decimal ? t.replace(/[^0-9.]/g, "") : t)}
      placeholder={placeholder}
      placeholderTextColor="#9A9DB8"
      keyboardType={numeric ? "numeric" : decimal ? "decimal-pad" : "default"}
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
function Avatar({ name, hue, size, style }: { name: string; hue: string; size: number; style?: object }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: hue, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.white }, style]}>
      <Text style={{ color: colors.white, fontWeight: "800", fontSize: size * 0.4 }}>{name[0]}</Text>
    </View>
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
