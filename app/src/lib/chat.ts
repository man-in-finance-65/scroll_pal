import type { ChatStep } from "./types";

// What Pal says in the advice chat. Plain data plus one function that picks the next question.
//
// Order: the scripted questions for this chat -> up to two easy follow-ups that depend on what the person said
// -> "Anything else?". Follow-ups are short, specific, and never deep: more like a friend's small talk.

export const ALL = "That's all";

export const moreStep = (k: number): ChatStep => ({
  id: `more${k}`,
  apiId: "more",
  ask: k === 0 ? "Thanks, pal. That really helps me get better. Anything else on your mind?" : "Noted! Anything else?",
  chips: [ALL],
  hint: "Type another thought…",
});

export const SCRIPT: Record<number, ChatStep[]> = {
  // After the 1st cook: one quick question.
  1: [
    { id: "would_share", ask: "First cook done, pal! 🎉 Be honest: would you tell a friend who's stuck on dinner about me?", chips: ["Yes, totally", "Maybe", "Not yet"] },
    { id: "make_it_yes", ask: "Thanks for being straight with me. What would make it a big yes?", chips: ["Faster", "More recipes", "Prettier", "Fix something"], hint: "Or type your own idea…" },
  ],
  // After the 3rd cook: a proper catch-up.
  3: [
    { id: "favourite", ask: "3 cooks in! 🔥 What's your favourite part of hanging out with me?", chips: ["Videos → recipes", "Pal's reactions", "The plan", "Levelling up"] },
    { id: "one_change", ask: "If you were me, what's the ONE thing you'd change?", chips: ["Make it faster", "More recipes", "Make it prettier", "Something's broken", "Nothing, keep going!"], hint: "Or type your own idea…" },
  ],
  // Any time: from the Advice button.
  0: [
    { id: "open", ask: "What's on your mind, pal? Good, bad or random, I'm all ears.", chips: ["I love something", "Something confused me", "I found a bug", "I have an idea"], hint: "Type it here…" },
  ],
};

const SCREENS = ["Pal", "Digest", "Plan", "Goals", "Passport"];

// First one whose pattern matches what the person just said (and hasn't been asked yet) wins.
const FOLLOW_UPS: { when: RegExp; step: ChatStep }[] = [
  { when: /yes, totally/i, step: { id: "fu_who", ask: "Love that 🙌 Who's the first friend you'd send me to?", chips: ["A flatmate", "My partner", "A gym buddy", "Family"] } },
  { when: /maybe|not yet/i, step: { id: "fu_proof", ask: "Fair enough! What would a friend need to see before they'd try me?", chips: ["Photos of food", "It being quicker", "A demo", "Not sure"] } },
  { when: /fast|quick|slow|wait/i, step: { id: "fu_slow", ask: "Where did it feel slowest?", chips: ["Digesting a link", "Making a plan", "Opening the app", "All of it"] } },
  { when: /more recipes|recipes/i, step: { id: "fu_cook", ask: "What do you cook most often?", chips: ["Chicken", "Pasta", "Veggie dishes", "Quick snacks"] } },
  { when: /pretty|prettier|ugly|design|look/i, step: { id: "fu_pretty", ask: "Which screen should I make nicer first?", chips: SCREENS } },
  { when: /videos? → recipes|digest|instagram|tiktok|link/i, step: { id: "fu_match", ask: "When I turned a video into a recipe, did it match what you saw?", chips: ["Spot on", "Mostly", "Missed things", "Didn't try yet"] } },
  { when: /reaction|sound|vibrat|haptic/i, step: { id: "fu_fx", ask: "How did my sounds and buzzes feel?", chips: ["Loved them", "A bit much", "Out of sync", "Didn't notice"] } },
  { when: /\bplan\b|meals?/i, step: { id: "fu_plan", ask: "Did the meals I planned sound like you?", chips: ["Yes!", "Too repetitive", "Too hard", "Too boring"] } },
  { when: /level|xp|stamp|passport/i, step: { id: "fu_level", ask: "Did levelling up make you want to cook more?", chips: ["Yes", "A little", "Not really"] } },
  { when: /love|like|great|good|nice|amazing|cool/i, step: { id: "fu_love", ask: "Ooh, nice. Was it a feature, or more the vibe of me?", chips: ["A feature", "The vibe", "Both"] } },
  { when: /confus|lost|unclear|didn't get|don't get/i, step: { id: "fu_confused", ask: "Which screen threw you off?", chips: SCREENS } },
  { when: /bug|broken|crash|error|doesn't work|not working|stuck/i, step: { id: "fu_bug", ask: "Roughly where did it go wrong?", chips: ["Pasting a link", "The plan", "The chat", "Somewhere else"] } },
  { when: /idea|should|wish|add|want/i, step: { id: "fu_idea", ask: "Would you use that idea every week, or just now and then?", chips: ["Every week", "Now and then", "Just a nice-to-have"] } },
];

// Specific little questions about real features, for when nothing they said matches.
const GENERIC: ChatStep[] = [
  { id: "fu_g_goals", ask: "Did you check out the Goals tab? Did it help?", chips: ["Yes, it helped", "Looked, didn't get it", "Haven't yet"] },
  { id: "fu_g_photos", ask: "Would a photo on every recipe make you more likely to cook it?", chips: ["Yes!", "Doesn't matter", "Depends"] },
  { id: "fu_g_paste", ask: "Was pasting a link easy?", chips: ["Super easy", "Fiddly", "Didn't work for me"] },
  { id: "fu_g_pal", ask: "Do you like how I react when you finish a cook?", chips: ["Love it", "It's fine", "Too much"] },
];

const MAX_FOLLOW_UPS_AFTER_SCRIPT = 2;
const MAX_FOLLOW_UPS_TOTAL = 4;

export function nextStep(opts: { milestone: number; asked: string[]; lastAnswer: string; moreCount: number }): ChatStep {
  const { milestone, asked, lastAnswer, moreCount } = opts;
  const script = SCRIPT[milestone] ?? SCRIPT[0];
  const scriptDone = script.filter((s) => asked.includes(s.id)).length;
  if (scriptDone < script.length) return script[scriptDone];

  const followUps = asked.filter((id) => id.startsWith("fu_")).length;
  const limit = moreCount === 0 ? MAX_FOLLOW_UPS_AFTER_SCRIPT : MAX_FOLLOW_UPS_TOTAL;
  if (followUps < limit && lastAnswer !== ALL) {
    const hit = FOLLOW_UPS.find((f) => f.when.test(lastAnswer) && !asked.includes(f.step.id));
    if (hit) return hit.step;
    // Nothing matched: ask a specific feature question, but only before the first "anything else".
    if (moreCount === 0) {
      const g = GENERIC.find((x) => !asked.includes(x.id));
      if (g) return g;
    }
  }
  return moreStep(moreCount);
}
