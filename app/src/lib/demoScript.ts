import type { PalState } from "./mood";
import type { Recipe } from "./types";

// The scripted 2-minute demo for the screen recording. Nothing here touches the real app state (XP, plan, passport)
// and nothing calls the API: it is all canned, so a take never waits on a video to digest.
//
// Each BEAT is one thing Pal says (a voice clip + the same words in a speech bubble) and what the screen shows while
// he says it. After the clip ends, `gap` is the pause for YOU to say your line. Tap the screen to skip a gap.
// If a take feels rushed or slow, change the gap numbers below. They are in milliseconds.

export const CLIPS = {
  wake: require("../../assets/voice/wake.mp3"),
  couch: require("../../assets/voice/couch.mp3"),
  justsaying: require("../../assets/voice/justsaying.mp3"),
  dont: require("../../assets/voice/dont.mp3"),
  mess: require("../../assets/voice/mess.mp3"),
  together: require("../../assets/voice/together.mp3"),
  fat: require("../../assets/voice/fat.mp3"),
  feedlink: require("../../assets/voice/feedlink.mp3"),
  fitus: require("../../assets/voice/fitus.mp3"),
  recommend: require("../../assets/voice/recommend.mp3"),
  toldyou: require("../../assets/voice/toldyou.mp3"),
  pantry: require("../../assets/voice/pantry.mp3"),
  missing: require("../../assets/voice/missing.mp3"),
  doordash: require("../../assets/voice/doordash.mp3"),
  done: require("../../assets/voice/done.mp3"),
  steps: require("../../assets/voice/steps.mp3"),
  freezer: require("../../assets/voice/freezer.mp3"),
  lookatus: require("../../assets/voice/lookatus.mp3"),
  tagline: require("../../assets/voice/tagline.mp3"),
  worktomorrow: require("../../assets/voice/worktomorrow.mp3"),
} as const;
export type Clip = keyof typeof CLIPS;

export type Scene = "pal" | "paste" | "recipe" | "pantry" | "pantryChecked" | "order" | "ordered" | "steps" | "timer";

export type Beat = {
  clip: Clip;
  ms: number; // how long the clip lasts
  say: string; // what the bubble shows
  scene: Scene;
  pal: PalState;
  gap: number; // pause after the clip, for your line
  fx?: "ready" | "done" | "stamp";
  userSays?: string; // your line in the gap. Never shown on screen; it's here so the timing is easy to tune
};

export const BEATS: Beat[] = [
  { clip: "wake", ms: 5610, say: "Vicente, it's 1am. That's 41 ice cream videos. You've cooked zero.", scene: "pal", pal: "helping", gap: 2000, userSays: "pal come on okay" },
  { clip: "couch", ms: 5600, say: "At this rate, you won't lose the weight. You'll become the couch. That's why you don't have a girlfriend.", scene: "pal", pal: "helping", gap: 6000, userSays: "calm down, that was too much / I'm hungry and angry, I'm gonna get some food" },
  { clip: "justsaying", ms: 1200, say: "I'm just saying.", scene: "pal", pal: "listening", gap: 4500, userSays: "maybe you shouldn't have said that" },
  { clip: "dont", ms: 1820, say: "No, no, don't eat it!", scene: "pal", pal: "excited", gap: 300 },
  { clip: "mess", ms: 2570, say: "You'll mess up your goal and my goal.", scene: "pal", pal: "excited", gap: 3000, userSays: "just a freaking blob, Pal, anyway" },
  { clip: "together", ms: 2650, say: "Wait, Vicente. We're in this together.", scene: "pal", pal: "helping", gap: 600 },
  { clip: "fat", ms: 2500, say: "If you get fat, I get fat.", scene: "pal", pal: "listening", gap: 3500, userSays: "help me turn this into something I can eat" },
  { clip: "feedlink", ms: 1400, say: "Feed me the link then.", scene: "paste", pal: "listening", gap: 3500, userSays: "(pastes the link)" },
  { clip: "fitus", ms: 1460, say: "I'll make it fit us.", scene: "paste", pal: "thinking", gap: 2500 },
  { clip: "recommend", ms: 13900, say: "Same creamy scoop, same cookie crunch. Frozen banana, Greek yogurt, a spoon of cocoa, one crushed cookie on top instead of half a pack. And it fits our calorie goal for today, with room to spare. That's the one I recommend.", scene: "recipe", pal: "excited", gap: 3000, fx: "ready", userSays: "that's actually it, looks good yeah" },
  { clip: "toldyou", ms: 750, say: "Told you.", scene: "recipe", pal: "excited", gap: 400 },
  { clip: "pantry", ms: 2870, say: "Okay, show me your pantry to see what I can buy for you.", scene: "pantry", pal: "helping", gap: 600 },
  { clip: "missing", ms: 3440, say: "You've got bananas and cocoa. You're missing the Greek yogurt.", scene: "pantryChecked", pal: "helping", gap: 2200, userSays: "it's 1 a.m., okay" },
  { clip: "doordash", ms: 2560, say: "A 24-hour grocer is open on DoorDash.", scene: "order", pal: "listening", gap: 3000, userSays: "okay, order it, okay" },
  { clip: "done", ms: 650, say: "Done.", scene: "ordered", pal: "excited", gap: 3500, fx: "done", userSays: "wait, I'll just grab a little... no, okay okay. Pal." },
  { clip: "steps", ms: 6550, say: "Step 1. Frozen banana, yogurt, cocoa. Blend until it looks like soft serve, not soup.", scene: "steps", pal: "helping", gap: 2500, userSays: "(blending) / never mind, Pal" },
  { clip: "freezer", ms: 3520, say: "Perfect. Into the freezer. 30 minutes to firm up.", scene: "timer", pal: "excited", gap: 4500, fx: "stamp", userSays: "this actually tastes good" },
  { clip: "lookatus", ms: 1700, say: "I know. Look at us.", scene: "timer", pal: "excited", gap: 3000, userSays: "I can finally taste what's on Instagram" },
  { clip: "tagline", ms: 3450, say: "Pal, the plan. Feed me a link and I'll feed you.", scene: "pal", pal: "listening", gap: 3500, userSays: "Who are you speaking to?" },
  { clip: "worktomorrow", ms: 1750, say: "We have work tomorrow.", scene: "pal", pal: "slow", gap: 1500 },
];

// The canned recipe. Every number is "estimated" (the video didn't state amounts), so it all shows a "~".
// Per serving, one serving. Each figure is the sum of the four ingredients below, cut (never rounded up) to the shown decimals.
//
//                    kcal  protein  carbs  fat
//   Banana, 118 g     105    1.3     27     0.4
//   Greek yogurt 150g  88   15       5.4    0.6
//   Cocoa, 5 g         11    0.9     2.8    0.6
//   Cookie, 11 g       53    0.5     8.3    2.3
//   Total             257   17.7    43.5    3.9
export const DEMO_RECIPE: Recipe = {
  title: "Frozen banana cookie-crunch scoop",
  creator: "Pal's fit-us remix",
  cuisine: "Dessert",
  servings: 1,
  ingredients: [
    { name: "Frozen banana", qty: 118, unit: "g", source: "estimated" },
    { name: "Greek yogurt", qty: 150, unit: "g", source: "estimated" },
    { name: "Cocoa powder", qty: 5, unit: "g", source: "estimated" },
    { name: "Cookie, crushed", qty: 11, unit: "g", source: "estimated" },
  ],
  steps: [
    "Blend the frozen banana, yogurt and cocoa until it looks like soft serve, not soup.",
    "Freeze for 30 minutes to firm up.",
    "Scoop and crush the cookie on top.",
  ],
  prep_minutes: 5,
  cook_minutes: 30,
  macros_per_serving: { kcal: 257, protein_g: 17.7, carbs_g: 43.5, fat_g: 3.9, source: "estimated" },
  confidence: 0.7,
};

// "With room to spare": an example day, so the sum is visible. Demo numbers, not anyone's real goal.
export const DEMO_DAY = { goal: 2000, eaten: 1400 };
