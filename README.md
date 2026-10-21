# Scroll Pal

A Pal that turns your doomscrolling into productivity: Pal turns your saved Instagram reels into a weekly meal plan, a shopping list and a simple "I ate it" log.

Hackathon build. Submissions close **Sun Oct 25, 2026, 11:59 PM ET**.

## Meal Prep Swap
Three friends form a pod with an invite code. Each sets a goal and adds one dish from a reel (link plus caption) or a screenshot; Claude turns it into a recipe. When all three dishes are in, a chef cooks 27 portions: everyone gets 3 of each dish, 9 meals. Pal builds the grocery list, the chef's prep sheet and the cost split, and the pod votes on a chef.

## Use it
- **Demo, no setup:** open the app (or the web link) and tap **Try the demo pod**. Maya and Dev are already in; set your goal, add a dish, vote for a chef, then open **Swap ready**.
- **On your phone:** `cd app && npm install && npx expo start`, then scan the QR code with Expo Go. With no keys it runs the demo.
- **Live mode (real reels, shared pods):** fill in `ANTHROPIC_API_KEY`, the `SURREAL_*` lines and the Clerk keys in `.env`, run the schema in `api/db/schema.surql`, start the API (`cd api && npm run dev`), and set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in `app/.env`.

## Change it
| To change | Edit |
| :- | :- |
| Grocery prices | `data/prices.json` |
| Chefs, demo members, sample dishes | `CHEFS`, `DEMO_MEMBERS`, `SAMPLE_DISHES` in `engine/pods.ts` |
| Portions (3 per member, 27 total), goal rules, prep-sheet order, cost split | `engine/swap.ts` |
| What Claude extracts and how | `api/src/extract.ts` |
| Screens and wording | `app/src/features/swap/SwapApp.tsx` |
| Colours | `app/src/lib/theme.ts` |
Run `npm test` after a change; the tests cover the swap maths.

## Read these first
- `CLAUDE.md`: the rules (stack, hard rules, gate protocol, out of scope).
- `BUILD_PLAN.md`: the gates, their pass tests, and fallbacks.
- `STATUS.md`: where every gate stands right now.
- `DECISIONS.md`: every fallback and judgment call, with the reason.
- `docs/GATE0_CHECKLIST.md`: accounts and keys to set up.
- `docs/INSTAGRAM_IMPORT.md`: how a user gets their saved reels into Pal.
- `docs/BRANCHES.md`: how the three of us share the repo.
- `docs/GATE_A_PHONE.md`: get Pal running on your phone.
- `docs/LAUNCH_PLAN.md`: testers and partners (dietitian, trainers, run clubs).

## Setup
1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and fill in the keys (see `docs/GATE0_CHECKLIST.md`). Never commit `.env`.
3. `npm install`

## Run the gate tests
| Gate | Command | Status |
| :- | :- | :- |
| B Reel to recipe | `npm run gate:b` (your 10 reels in `scripts/gate-b/reels.food.txt`; add `-- --caption` for fallback 1) | script ready, needs Gemini + Apify keys |
| B filter test | `npm run gate:b -- --file reels.not-food.txt --expect-none` | ready |
| B and C unit tests | `npm test` | 36 pass |

| Swap + engine tests | `npm test` | 64 pass |
| A App shell | see `docs/GATE_A_PHONE.md` | built, needs keys and a phone |
| API tests | `cd api && npm test` | 9 pass |

Other gates are added here as they are built.

## Repo layout
```
scripts/gate-b/   reel URL -> recipe JSON test script
api/              Hono API for Cloud Run: sign-in check, user rows, screening (Gate A)
app/              Expo app: Clerk sign-in, talks only to the API (Gate A)
engine/           targets, screening, plan checker, backup planner, shopping list (Gate C)
config/           nutrition constants, each tagged with a source id (Gate C)
evidence/         evidence pack: the only sources Pal may cite (Gate C)
docs/             checklists and guides
```
