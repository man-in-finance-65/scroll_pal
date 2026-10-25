# ScrollPal
Expo (React Native) app plus a tiny Node/TS API. Pal, a sous-chef companion, turns a shared cooking video into a recipe and a multi-day plan. Pal levels up from three actions only: share a recipe, eat a planned meal, cook with Pal.

## Stack (do not swap without asking)
- Expo SDK 58, expo-router, TypeScript. Must run in Expo Go.
  (Changed from SDK 57 with the owner's OK on 2026-10-23: the Expo Go in the app stores only opens SDK 58.)
- API: Node/TS (Express), deployed on Google Cloud Run. The phone only talks to this API. API keys never go in the app.
- Gemini reads the video (YouTube) or the page text/caption (Instagram, TikTok, recipe sites; the API fetches it, best effort, else asks for the caption). Claude (small model) builds the plan.
- Local state: AsyncStorage on the phone (XP, level, passport, plan). No database yet.
- Sound: expo-audio (added with the owner's OK, 2026-10-23). Sounds are original and synthesized in-house; do not copy anyone's recordings or voice.
- Landing page + hidden Google Sheet (Apps Script) for the "be Pal's pal" count and feedback, added with the owner's OK, 2026-10-23.
- Animation: react-native-reanimated springs. Rings: react-native-svg. Haptics: expo-haptics.
- Pal in 3D: three.js rendered through expo-gl (both run in Expo Go). Approved by the owner on 2026-10-25, to be added at build step 4.

## Rules
- XP: Share = 10, Eat = 25, Cook = 50. Nothing else earns XP. Shares: first 3 a day count. Eat: once per planned meal. Cook: no cap.
- Levels: one flat cost per level (XP_PER_LEVEL in app/src/lib/xp.ts, 100 for now, a placeholder until the owner confirms). Levels unlock Pal skins and props.
- Every ingredient and macro has source: "stated" | "estimated". Estimated ones show a "~" in the UI.
- Numbers on screen show the result only, with "~" on estimates. No formulas on screen. A "Details" button opens the math plus one sentence from Pal. Never round up. (Owner's change, 2026-10-25. Before this every number showed its math on screen.)
- Secrets only in env vars listed in .env.example. Never commit them.
- Ask before adding a dependency or a new service.
- Explain non-obvious choices in plain English. I'm not an engineer.
- Smallest diff that works. One task at a time. Run the app after each change.

## Out of scope for v1
Clerk, SurrealDB, real Instacart cart, calendar, share sheet, Live Activities/Dynamic Island, friend swap, chef orders, weekly recap, cook-along mode.
