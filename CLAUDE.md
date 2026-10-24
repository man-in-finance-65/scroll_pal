# ScrollPal
Expo (React Native) app plus a tiny Node/TS API. Pal, a mascot companion, turns a saved cooking video into a recipe and a weekly plan, then levels up only when the user completes a cook.

## Stack (do not swap without asking)
- Expo SDK 58, expo-router, TypeScript. Must run in Expo Go.
  (Changed from SDK 57 with the owner's OK on 2026-10-23: the Expo Go in the app stores only opens SDK 58.)
- API: Node/TS (Express), deployed on Google Cloud Run. The phone only talks to this API. API keys never go in the app.
- Gemini reads the video (YouTube) or the page text/caption (Instagram, TikTok, recipe sites; the API fetches it, best effort, else asks for the caption). Claude (small model) builds the plan.
- Local state: AsyncStorage on the phone (XP, level, passport, plan). No database yet.
- Sound: expo-audio (added with the owner's OK, 2026-10-23). Sounds are original and synthesized in-house; do not copy anyone's recordings or voice.
- Landing page + hidden Google Sheet (Apps Script) for the "be Pal's pal" count and feedback, added with the owner's OK, 2026-10-23.
- Animation: react-native-reanimated springs. Rings: react-native-svg. Haptics: expo-haptics.

## Pal (pal-app/, pal-server/), owner's OK 2026-10-24
- New Pal build lives in pal-app/ and pal-server/; the old app/ and api/ stay untouched.
- Claude reads recipes, swaps and pantry photos; OpenAI Whisper transcribes video audio; USDA FoodData Central gives macros. No Gemini in Pal.
- Hosting stays on Google Cloud Run (service "pal-server").
- Pal XP: +50 per dish cooked, +20 for hitting the protein goal, +10 for zero food waste (replaces the 10 XP rule below for Pal).
- Voice commands use on-device speech recognition (needs a development build).

## Rules
- Levels: 30 XP each. A digested link and a completed cook are worth 10 XP each, so 3 links = 1 level at every level (owner's change, 2026-10-23, "for now"; links max 3 a day). Before this only cooks could level Pal up.
- Every ingredient and macro has source: "stated" | "estimated". Estimated ones show a "~" in the UI.
- Show the math for any number the user sees. Never round up.
- Secrets only in env vars listed in .env.example. Never commit them.
- Ask before adding a dependency or a new service.
- Explain non-obvious choices in plain English. I'm not an engineer.
- Smallest diff that works. One task at a time. Run the app after each change.

## Out of scope for v1
Clerk, SurrealDB, real Instacart cart, calendar, share sheet, Live Activities/Dynamic Island, friend swap, chef orders, weekly recap, cook-along mode.
