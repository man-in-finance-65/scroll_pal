import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Pal } from "../components/Pal";
import { Button, Card, FadeIn, NumberCard, Ring, Screen, SpeechBubble } from "../components/ui";
import { BEATS, CLIPS, DEMO_DAY, DEMO_RECIPE, type Beat, type Clip } from "../lib/demoScript";
import { fx } from "../lib/fx";
import { est, num, qtyText } from "../lib/format";
import { brand, radius, space, type, useTheme } from "../lib/theme";

// The scripted demo for the screen recording. Open it by long-pressing "Pal" at the top of the home screen.
// It plays on its own timer and never touches the real XP, plan or passport. Tap the screen to skip a pause.

const LINK = "instagram.com/reel/ice-cream-at-1am";
const R = DEMO_RECIPE;
const M = R.macros_per_serving;

export default function Demo() {
  const t = useTheme();
  const [beat, setBeat] = useState<Beat | null>(null);
  const [phase, setPhase] = useState<"ready" | "playing" | "finished">("ready");
  const [cam, askCam] = useCameraPermissions();
  const run = useRef(0);
  const skip = useRef<() => void>(() => {});
  const players = useRef<Partial<Record<Clip, AudioPlayer>>>({});
  const current = useRef<Clip | null>(null);

  // Load every clip up front so none of them lags when Pal speaks.
  useEffect(() => {
    for (const name of Object.keys(CLIPS) as Clip[]) {
      try {
        players.current[name] = createAudioPlayer(CLIPS[name]);
      } catch (e) {
        console.warn(`demo: could not load ${name}`, e);
      }
    }
    return () => {
      run.current++;
      for (const p of Object.values(players.current)) {
        try { p?.remove(); } catch {}
      }
    };
  }, []);

  const wait = (ms: number) =>
    new Promise<void>((done) => {
      const id = setTimeout(done, ms);
      skip.current = () => { clearTimeout(id); done(); };
    });

  async function play() {
    if (cam && !cam.granted && cam.canAskAgain) await askCam().catch(() => {}); // ask now, not mid-recording
    const me = ++run.current;
    setPhase("playing");
    for (const b of BEATS) {
      if (run.current !== me) return;
      setBeat(b);
      if (b.fx) fx[b.fx]();
      else if (b.scene !== "pal") fx.tap();
      current.current = b.clip;
      try {
        const p = players.current[b.clip];
        p?.seekTo(0);
        p?.play();
      } catch {}
      await wait(b.ms + b.gap);
    }
    if (run.current === me) setPhase("finished");
  }

  // A tap while Pal is talking skips ahead to the next line and cuts his current clip short.
  function tap() {
    if (phase !== "playing") return;
    try { if (current.current) players.current[current.current]?.pause(); } catch {}
    skip.current();
  }

  if (phase !== "playing") {
    return (
      <Screen scroll={false}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.lg }}>
          <Pal state="listening" size={200} />
          <Text style={[type.title, { color: t.text }]}>{phase === "finished" ? "That's a wrap" : "Demo take"}</Text>
          <Text style={[type.body, { color: t.sub, textAlign: "center" }]}>
            Start your screen recording first, then press the button. About 2 minutes. Tap the screen to skip a pause.
          </Text>
          <Button title={phase === "finished" ? "Play again" : "Start"} onPress={play} style={{ alignSelf: "stretch" }} />
          <Button title="Close" kind="secondary" onPress={() => router.back()} style={{ alignSelf: "stretch" }} />
        </View>
      </Screen>
    );
  }

  const b = beat;
  const big = b?.scene === "pal";
  return (
    <Pressable style={{ flex: 1 }} onPress={tap}>
      <Screen scroll={false}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, gap: space.md }}>
          <View style={{ alignItems: "center", gap: space.sm, minHeight: big ? 380 : 190, justifyContent: big ? "center" : "flex-start" }}>
            {b ? <SpeechBubble key={b.clip}>{b.say}</SpeechBubble> : null}
            <Pal state={b?.pal ?? "listening"} size={big ? 230 : 96} />
          </View>
          {b && !big ? <Scene key={b.scene.startsWith("pantry") ? "pantry" : b.scene} scene={b.scene} /> : null}
        </View>
      </Screen>
    </Pressable>
  );
}

function Scene({ scene }: { scene: Beat["scene"] }) {
  const t = useTheme();
  const tag = (
    <View style={{ alignSelf: "flex-start", backgroundColor: brand.violet + "22", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: brand.violet, fontWeight: "800", fontSize: 12 }}>DEMO</Text>
    </View>
  );

  if (scene === "paste") {
    return (
      <FadeIn>
        <View style={{ gap: space.sm }}>
          <View style={{ backgroundColor: t.card, borderRadius: radius.md, padding: space.md, borderWidth: 1, borderColor: t.line }}>
            <Text style={[type.body, { color: t.text }]}>https://{LINK}</Text>
          </View>
          <Button title="Let me digest this link" onPress={() => {}} />
        </View>
      </FadeIn>
    );
  }

  if (scene === "recipe") {
    const left = DEMO_DAY.goal - DEMO_DAY.eaten - M.kcal;
    return (
      <FadeIn>
        <View style={{ gap: space.md }}>
          <Text style={[type.h2, { color: t.text }]}>{R.title}</Text>
          <View style={{ flexDirection: "row", gap: space.md }}>
            <NumberCard label="Energy" value={`${est(M.source)}${num(M.kcal, 0)}`} unit="kcal" color={brand.orange} math="105 + 88 + 11 + 53" />
            <NumberCard label="Protein" value={`${est(M.source)}${num(M.protein_g)}`} unit="g" color={brand.pink} math="1.3 + 15 + 0.9 + 0.5" />
          </View>
          <Card style={{ paddingVertical: space.md }}>
            <Text style={[type.body, { color: t.text }]}>
              Today: {num(DEMO_DAY.eaten, 0)} + {num(M.kcal, 0)} = {num(DEMO_DAY.eaten + M.kcal, 0)} of {num(DEMO_DAY.goal, 0)} kcal
            </Text>
            <Text style={[type.caption, { color: brand.mint, fontWeight: "700" }]}>{num(left, 0)} kcal to spare</Text>
          </Card>
          <Text style={[type.caption, { color: t.sub }]}>~ means I estimated it. The video didn't say the amounts.</Text>
        </View>
      </FadeIn>
    );
  }

  if (scene === "pantry" || scene === "pantryChecked") return <Pantry checked={scene === "pantryChecked"} />;

  if (scene === "order" || scene === "ordered") {
    const placed = scene === "ordered";
    return (
      <FadeIn>
        <Card>
          {tag}
          <Text style={[type.h2, { color: t.text }]}>{placed ? "✅ Checked out on Instacart" : "Your Instacart cart"}</Text>
          {CART.map((c, k) => (
            <View key={c.name} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: k ? 1 : 0, borderColor: t.line, opacity: c.buy ? 1 : 0.45 }}>
              <Text style={[type.body, { color: t.text }]}>{c.name}</Text>
              <Text style={[type.body, { color: c.buy ? brand.mint : t.sub, fontWeight: "700" }]}>{c.buy ? (placed ? "✓ ordered" : "+ in cart") : "have it"}</Text>
            </View>
          ))}
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            {!placed && <ActivityIndicator color={t.tint} />}
            <Text style={[type.caption, { color: t.sub }]}>{placed ? "On its way." : "Checking out on Instacart…"}</Text>
          </View>
        </Card>
      </FadeIn>
    );
  }

  if (scene === "steps") {
    return (
      <FadeIn>
        <Card>
          <Text style={[type.h2, { color: t.text }]}>Steps</Text>
          {R.steps.map((s, k) => (
            <View key={k} style={{ flexDirection: "row", gap: space.md, paddingVertical: 6, opacity: k === 0 ? 1 : 0.45 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: brand.violet + "22", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: brand.violet, fontWeight: "800" }}>{k + 1}</Text>
              </View>
              <Text style={[type.body, { color: t.text, flex: 1 }]}>{s}</Text>
            </View>
          ))}
          <Text style={[type.caption, { color: t.sub }]}>
            {R.ingredients.map((i) => `${i.name} ${est(i.source)}${qtyText(i.qty, i.unit)}`).join(" · ")}
          </Text>
        </Card>
      </FadeIn>
    );
  }

  // timer
  return <Freezer />;
}

// 30 minutes in the freezer, shown as a ring that fills while Pal talks. The 30 is the recipe's own number.
function Freezer() {
  const t = useTheme();
  const [v, setV] = useState(0);
  useEffect(() => { const id = setTimeout(() => setV(30), 300); return () => clearTimeout(id); }, []);
  return (
    <FadeIn>
      <View style={{ alignItems: "center", gap: space.md }}>
        <Ring value={v} target={30} size={180} stroke={18}>
          <Text style={[type.bigNumber, { color: t.text }]}>30</Text>
          <Text style={[type.caption, { color: t.sub }]}>min</Text>
        </Ring>
        <Text style={[type.body, { color: t.sub }]}>In the freezer, firming up</Text>
      </View>
    </FadeIn>
  );
}

// The ingredients, with only what's missing going in the cart. Cart and pantry agree: you have bananas, cocoa and cookies.
const CART = [
  { name: "Frozen banana", buy: false },
  { name: "Cocoa powder", buy: false },
  { name: "Cookie", buy: false },
  { name: "Greek yogurt, 150 g", buy: true },
];

// The pantry check is a real camera, so the recording shows your actual pantry. If the camera isn't allowed
// (or there isn't one), it falls back to a plain list so the take still works.
function Pantry({ checked }: { checked: boolean }) {
  const t = useTheme();
  const [perm] = useCameraPermissions();
  const rows = [
    { name: "Bananas", have: true },
    { name: "Cocoa", have: true },
    { name: "Greek yogurt", have: false },
  ];
  const list = (
    <View style={{ gap: 6 }}>
      {rows.map((r) => (
        <View key={r.name} style={{ flexDirection: "row", justifyContent: "space-between", backgroundColor: t.card + "E6", borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 8 }}>
          <Text style={[type.body, { color: t.text }]}>{r.name}</Text>
          <Text style={[type.body, { color: !checked ? t.sub : r.have ? t.ok : t.danger, fontWeight: "700" }]}>
            {!checked ? "checking…" : r.have ? "✓ have it" : "✕ missing"}
          </Text>
        </View>
      ))}
    </View>
  );
  return (
    <FadeIn>
      {perm?.granted ? (
        <View style={{ height: 420, borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#000", justifyContent: "flex-end" }}>
          <CameraView style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} facing="back" />
          <View style={{ padding: space.md }}>{list}</View>
        </View>
      ) : (
        <Card>{list}</Card>
      )}
    </FadeIn>
  );
}
