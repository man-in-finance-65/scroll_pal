# Pal (ScrollPal)

A Pal that turns your doomscrolling into productivity: Pal turns your saved Instagram reels into a weekly meal plan, a shopping list and a simple "I ate it" log.

Hackathon build. Submissions close **Sun Oct 25, 2026, 11:59 PM ET**.

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
| B Reel to recipe | copy `scripts/gate-b/reels.example.txt` to `reels.txt`, add 10 reel links, then `npm run gate:b` (add `-- --caption` for fallback 1) | script ready, needs keys |
| B and C unit tests | `npm test` | 36 pass |

| A App shell | see `docs/GATE_A_PHONE.md` | built, needs keys and a phone |
| API tests | `cd api && npm test` | 5 pass |

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
