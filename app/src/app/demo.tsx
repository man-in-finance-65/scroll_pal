import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Keyboard, Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import type { PalMood } from "../components/Pal";
import { Bar, Button, Card, Choice, Field, Pill, Ring, Row, Stage } from "../components/ui";
import { fx } from "../lib/fx";
import { brand, radius, space, type, useTheme } from "../lib/theme";
import { COOK_XP, SHARE_XP } from "../lib/xp";

// The hidden demo. Open it by holding Pal on Home for 5 seconds. It's a script: Pal's lines type out word by word,
// and you tap anywhere for the next one. When V talks (you, out loud), Pal just listens. The screens Pal shows are
// the app's own pieces (feed, swaps, pantry camera, DoorDash list, cook steps, XP), filled with a canned recipe.
// Nothing here touches your real XP, recipes or plan.

type Panel = "feed" | "swaps" | "pantry" | "pantryDone" | "shop" | "shopDone" | "cook1" | "cook2" | "level" | "home";
type Beat = {
  mood: PalMood;
  say?: string; // Pal's line; none = Pal is listening to V
  panel?: Panel;
  title?: string; // a sound, not a line (the knock)
  auto?: number; // ms before moving on by itself (Pal digesting)
  gate?: boolean; // only the panel's button moves on
  big?: boolean; // Pal fills the screen (the sick face)
  enter?: () => void;
};

const listen = (mood: PalMood = "chubby"): Beat => ({ mood });

const BEATS: Beat[] = [
  { mood: "worried", say: "V… It's 1 AM. That's 41 ice cream videos. You've cooked zero." },
  listen(), // V: Pal. Come on.
  { mood: "cheeky", say: "At this rate, you won't lose the weight. You'll become the couch. That's why you don't have a girlfriend." },
  listen(), // V: Okay, calm down… I'm hangry. Getting food.
  { mood: "cheeky", say: "I'm just saying." },
  listen(), // V: I'm gonna eat my roommate's last cinnamon bun.
  { mood: "worried", say: "No, no. Don't eat it. You'll mess up your goal and my goal." },
  listen(), // V: It's just a bun, Pal.
  { mood: "chubby", say: "Wait, V, we're in this together. If you get fat, I get fat." },
  listen(), // V: Ok then let's turn this into something I can eat.
  { mood: "cheeky", say: "Feed me the link, then. I'll make it fit us.", panel: "feed", gate: true },
  { mood: "cheeky", say: "Chewing…", auto: 2000 },
  { mood: "cheer", say: "Same creamy scoop, same cookie crunch.", panel: "swaps", enter: fx.ready },
  listen("cheer"), // V: That actually looks good.
  { mood: "cheeky", say: "Okay, show me your pantry to see what I can buy for you.", panel: "pantry", gate: true },
  { mood: "cheeky", say: "Looking…", panel: "pantry", auto: 2000 },
  { mood: "cheeky", say: "You've got bananas and cocoa. You're missing the Greek yogurt.", panel: "pantryDone", enter: fx.ready },
  listen(), // V: Yeah, it's 1 AM.
  { mood: "cheeky", say: "24 hour grocer is open on DoorDash.", panel: "shop" },
  listen(), // V: Okay, order it.
  { mood: "cheer", say: "Done.", panel: "shopDone", enter: fx.done },
  listen(), // V: While we wait, I'll just grab a little some…
  { mood: "sick", big: true, enter: fx.error },
  listen(), // V: No? Okay.
  { mood: "cheeky", title: "Knock knock.", enter: () => { fx.stamp(); setTimeout(fx.stamp, 450); } },
  listen(), // V: Wow Pal… you couldn't have gotten one any smaller.
  { mood: "cheeky", say: "Haha, just pulling your leg. Your big grocery haul comes on Sundays. Patience, V." },
  { mood: "cheeky", say: "Step one. Frozen banana, yogurt… blend until it looks like soft serve.", panel: "cook1" },
  listen(), // V: Done.
  { mood: "cheer", say: "Perfect. Into the freezer. 30 minutes to firm up.", panel: "cook2" },
  listen("cheer"), // V: Pal, this genuinely tastes good…
  { mood: "fit", say: "I know. Look at us.", panel: "level" },
  listen("fit"), // V: I can finally taste what's on Instagram.
  { mood: "cheeky", say: "Pal the Pan… feed me a link, and I'll feed you.", panel: "home" },
  listen("fit"), // V: Who are you speaking to?
  { mood: "cheer", say: "You. Yeah, you. Download me." },
];

// The canned recipe: a cookies and cream ice cream video, tuned by Pal. ~ = estimated, like everywhere in the app.
const VIDEO_KCAL = 520;
const SWAPS = [
  { from: "Heavy cream", to: "Greek yogurt", saved: 150, why: "Same creamy scoop, way more protein." },
  { from: "Sweetened condensed milk", to: "Frozen banana", saved: 80, why: "Sweet without the sugar bomb." },
  { from: "6 chocolate cookies", to: "2 crushed cookies on top", saved: 30, why: "Same cookie crunch, right where you taste it." },
];
const MY_KCAL = VIDEO_KCAL - SWAPS.reduce((a, s) => a + s.saved, 0);
const PANTRY = [
  { name: "Frozen banana", qty: "~2" },
  { name: "Cocoa powder", qty: "~1 tbsp" },
  { name: "Crushed cookies", qty: "~2" },
  { name: "Greek yogurt", qty: "~1 cup" },
];
const MISSING = "Greek yogurt";
const STEPS = ["Frozen banana, yogurt… blend until it looks like soft serve.", "Into the freezer. 30 minutes to firm up."];

export default function Demo() {
  const [i, setI] = useState(0);
  const beat = BEATS[i];
  const speech = useRef<Speech>({ done: true, finish: () => {} });

  const next = () => {
    if (i >= BEATS.length - 1) return router.canGoBack() ? router.back() : router.replace("/");
    setI(i + 1);
  };
  useEffect(() => {
    beat.enter?.();
    if (!beat.auto) return;
    const id = setTimeout(next, beat.auto);
    return () => clearTimeout(id);
  }, [i]);

  // Tap anywhere: finish the line that's typing out, else the next beat. Buttons in a panel handle their own taps.
  function tap() {
    Keyboard.dismiss();
    if (!speech.current.done) return speech.current.finish();
    if (beat.gate || beat.auto) return;
    fx.tap();
    next();
  }

  // Made once per beat, so the bubble pops when Pal starts a line, not on every re-render.
  const say = useMemo(() => (beat.say ? <Spoken key={i} text={beat.say} ctl={speech} /> : undefined), [i]);

  return (
    <Pressable style={{ flex: 1 }} onPress={tap} accessible={false}>
      <Stage
        mood={beat.mood}
        say={say}
        title={beat.title}
        step={[i + 1, BEATS.length]}
        palSize={beat.big ? 260 : beat.panel ? 130 : 200}
        cta={<Cta panel={beat.panel} gate={!!beat.gate} onDone={next} />}
      >
        {beat.say || beat.title || beat.big ? <PanelView panel={beat.panel} /> : <Listening />}
      </Stage>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Pal's line, word by word, as if said out loud. The unsaid words are already there (invisible), so the bubble
// never changes size while it types.
type Speech = { done: boolean; finish: () => void };

function Spoken({ text, ctl }: { text: string; ctl: MutableRefObject<Speech> }) {
  const words = text.split(" ");
  const [n, setN] = useState(0);
  useEffect(() => {
    ctl.current = { done: false, finish: () => setN(words.length) };
    const id = setInterval(() => setN((k) => Math.min(words.length, k + 1)), 230);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (n >= words.length) ctl.current = { done: true, finish: () => {} };
  }, [n]);
  return (
    <Text>
      {words.slice(0, n).join(" ")}
      <Text style={{ color: "transparent" }}>{n ? " " : ""}{words.slice(n).join(" ")}</Text>
    </Text>
  );
}

// When V talks, Pal listens: no bubble, just a soft pulsing "listening".
function Listening() {
  const t = useTheme();
  const o = useSharedValue(0.35);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, []);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[{ flexDirection: "row", alignSelf: "center", alignItems: "center", gap: 8 }, anim]}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.tint }} />
      <Text style={[type.label, { color: t.sub }]}>Listening</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Bottom buttons. The feed and pantry beats wait for you; the rest move on with a tap anywhere.
function Cta({ panel, gate, onDone }: { panel?: Panel; gate: boolean; onDone: () => void }) {
  if (panel === "feed") return <FeedBox onDone={onDone} />;
  if (panel === "pantry" && gate) return <PantryButtons onDone={onDone} />;
  if (panel === "pantry") return <Button title="Snap my shelves" icon="📷" loading onPress={() => {}} />;
  if (panel === "shop") return <Button title={`Find ${MISSING} on DoorDash`} icon="🛒" onPress={onDone} />;
  if (panel === "shopDone") return <Button title="I checked out" onPress={onDone} />;
  return null;
}

// The app's Feed box: paste a link, feed Pal.
function FeedBox({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const [url, setUrl] = useState("");
  async function paste() {
    const text = await Clipboard.getStringAsync().catch(() => "");
    if (text) setUrl(text.trim());
  }
  const feed = () => { if (url.trim()) { Keyboard.dismiss(); onDone(); } };
  return (
    <>
      <Field value={url} onChangeText={setUrl} placeholder="Paste a TikTok, Reel or YouTube link" autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" onSubmitEditing={feed} action="Paste" onAction={paste} />
      <Text style={[type.caption, { color: t.faint, textAlign: "center" }]}>Recipe sites work too. +{SHARE_XP} XP per link.</Text>
      <Button title="Feed Pal" onPress={feed} disabled={!url.trim()} />
    </>
  );
}

// The app's pantry camera. Whatever the photo shows, Pal finds the same thing (it's a demo).
function PantryButtons({ onDone }: { onDone: () => void }) {
  async function snap(from: "camera" | "library") {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.4 };
    try {
      if (from === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return onDone(); // no camera access: carry on anyway, the demo must not stall
        const res = await ImagePicker.launchCameraAsync(opts);
        if (res.canceled) return;
      } else {
        const res = await ImagePicker.launchImageLibraryAsync(opts);
        if (res.canceled) return;
      }
    } catch {
      // No camera here (a simulator, the web): carry on as if the photo was taken.
    }
    onDone();
  }
  return (
    <>
      <Button title="Snap my shelves" icon="📷" onPress={() => snap("camera")} />
      <Button title="Pick a photo instead" kind="ghost" onPress={() => snap("library")} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// What sits under Pal's line: the app's own screens, with the demo recipe in them.
function PanelView({ panel }: { panel?: Panel }) {
  const t = useTheme();
  switch (panel) {
    case "swaps":
      return (
        <>
          <Card>
            <Text style={[type.label, { color: brand.orange }]}>Per serving</Text>
            <View style={{ flexDirection: "row", gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[type.caption, { color: t.faint }]}>The video</Text>
                <Text style={[type.bigNumber, { color: t.sub }]}>~{VIDEO_KCAL}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.caption, { color: brand.mint }]}>My version</Text>
                <Text style={[type.bigNumber, { color: brand.mint }]}>~{MY_KCAL}</Text>
              </View>
            </View>
            <Text style={[type.caption, { color: t.sub }]}>{VIDEO_KCAL} kcal minus {VIDEO_KCAL - MY_KCAL} from swaps = {MY_KCAL} kcal</Text>
          </Card>
          {SWAPS.map((sw) => (
            <Card key={sw.from}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
                <Text style={[type.caption, { color: t.faint, flex: 1 }]} numberOfLines={1}>{sw.from}</Text>
                <Text style={[type.caption, { color: brand.mint, fontWeight: "700" }]}>~{sw.saved} kcal lighter</Text>
              </View>
              <Text style={[type.h2, { color: t.text }]}>→ {sw.to}</Text>
              <Text style={[type.caption, { color: t.sub }]}>{sw.why}</Text>
            </Card>
          ))}
        </>
      );
    case "pantry":
    case "pantryDone": {
      const done = panel === "pantryDone";
      const have = done ? PANTRY.filter((p) => p.name !== MISSING) : [];
      return (
        <>
          <Text style={[type.label, { color: t.sub }]}>Tap what you have · {have.length} of {PANTRY.length}</Text>
          <View style={{ gap: space.sm }}>
            {PANTRY.map((p) => <Choice key={p.name} title={p.name} sub={p.qty} selected={have.includes(p)} onPress={() => {}} />)}
          </View>
        </>
      );
    }
    case "shop":
    case "shopDone": {
      const got = panel === "shopDone";
      return (
        <>
          <Card>
            <Text style={[type.label, { color: t.sub }]}>24 hour grocer · open now</Text>
            <Row first left={`${got ? "✓ " : ""}${MISSING}`} color={got ? brand.mint : undefined} right="~1 cup" />
          </Card>
          <Text style={[type.caption, { color: t.faint, textAlign: "center" }]}>{got ? "In the cart. Ordered on DoorDash." : "Tap any item to find it in the DoorDash app."}</Text>
        </>
      );
    }
    case "cook1":
    case "cook2":
      return <CookStep at={panel === "cook1" ? 0 : 1} />;
    case "level":
      return <LevelUp />;
    case "home":
      return <FeedAction />;
    default:
      return null;
  }
}

// The app's Cook with me step, with its timer on the freezer step.
function CookStep({ at }: { at: number }) {
  const t = useTheme();
  const mins = at === 1 ? 30 : 0;
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (left === null || left <= 0) return;
    const id = setTimeout(() => setLeft((x) => (x === null ? null : x - 1)), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return (
    <>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={[type.label, { color: t.sub }]}>Step {at + 1} of {STEPS.length}</Text>
        <Pill text={`+${COOK_XP} XP when done`} color={brand.reward} />
      </View>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {STEPS.map((_, k) => <View key={k} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: k < at ? brand.mint : k === at ? t.tint : t.cardAlt }} />)}
      </View>
      <Card style={{ minHeight: 100, justifyContent: "center" }}>
        <Text style={[type.title, { color: t.text }]}>{STEPS[at]}</Text>
      </Card>
      {mins ? (
        <Card style={{ alignItems: "center" }}>
          <Ring value={left === null ? 0 : mins * 60 - left} target={mins * 60} size={120}>
            <Text style={[type.bigNumber, { color: t.text }]}>{left === null ? `${mins}:00` : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`}</Text>
          </Ring>
          <Button title={left === null ? `Start ${mins} min timer` : "Stop timer"} kind="secondary" onPress={() => setLeft(left === null ? mins * 60 : null)} style={{ alignSelf: "stretch" }} />
        </Card>
      ) : null}
    </>
  );
}

// "Look at us": the XP from tonight lands. One link + one cook, with the math, like the Home card.
function LevelUp() {
  const t = useTheme();
  const [xp, setXp] = useState(SHARE_XP);
  useEffect(() => {
    const id = setTimeout(() => { setXp(SHARE_XP + COOK_XP); fx.levelUp(); }, 700);
    return () => clearTimeout(id);
  }, []);
  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={[type.label, { color: brand.violet }]}>Level 1</Text>
        <Text style={[type.caption, { color: t.sub }]}>{xp} / 100 XP</Text>
      </View>
      <Bar value={xp} max={100} />
      <Text style={[type.caption, { color: t.sub }]}>1 link × {SHARE_XP} + {xp > SHARE_XP ? `1 cook × ${COOK_XP}` : "0 cooks"} = {xp} XP</Text>
    </Card>
  );
}

// The Home card that starts it all.
function FeedAction() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, minHeight: 76, borderRadius: radius.md, backgroundColor: t.card, borderWidth: 2, borderColor: t.tint }}>
      <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: t.cardAlt, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 24 }}>🔗</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.h2, { color: t.text }]}>Feed me a link</Text>
        <Text style={[type.caption, { color: t.tint }]}>A food video or recipe</Text>
      </View>
      <Pill text={`+${SHARE_XP} XP`} color={brand.reward} />
    </View>
  );
}

