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

## Setup
1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and fill in the keys (see `docs/GATE0_CHECKLIST.md`). Never commit `.env`.
3. `npm install`

## Run the gate tests
| Gate | Command | Status |
| :- | :- | :- |
| B Reel to recipe | `npm run gate:b` (reads `scripts/gate-b/reels.txt`) | script ready, needs keys |

Other gates are added here as they are built.

## Repo layout
```
scripts/gate-b/   reel URL -> recipe JSON test script
api/              Hono API for Cloud Run (to come, Gate A)
app/              Expo app (to come, Gate A)
config/           nutrition constants with source ids (Gate C)
evidence/         evidence pack (Gate C)
docs/             checklists and guides
```
