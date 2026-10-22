# Pal (ScrollPal): CLAUDE.md

## What this is
Pal is a mobile app with an AI companion (mascot "Pal"). It turns the user's saved Instagram reels into a weekly meal plan that fits their schedule and weight-loss goal, plus a shopping list and a simple "I ate it" log. Built for the Build North hackathon. **Submissions close Sun Oct 25, 2026, 11:59 PM ET. Internal freeze: Sat Oct 24, 12:00 PM ET.**

The builder (Vicente) is a business/finance person, not an engineer. Explain anything non-obvious in plain English. Never assume a technical term is known.

## Team and branches
- Contributors: man-in-finance-65 (Vicente), ArjunB3hl (Arjun), MohitS2004 (Mohit Solanki).
- Each contributor works on `dev/<github-username>` and merges into `main` through a pull request.
- Roles are not assigned yet. Do not assume who owns a gate.

## Core flow: Meal Prep Swap (Oct 21)
Pods of 3 (invite code). Each member sets a goal and submits one dish (reel link + caption, or screenshot), which Claude turns into JSON. Once all 3 dishes are in: each member gets 3 portions of each dish (9 meals), 27 portions are cooked in one session, and code builds the merged grocery list, the prep sheet and the cost split (estimate from data/prices.json until someone enters the real receipt total, divided by 3). "Add to Instacart" sends the list to Instacart's official API. Reel links: Apify fetches the video, Gemini watches it. Creator chefs (influencer, Stan-store vibe) are "Coming soon". No payments. Logic: engine/swap.ts, engine/pods.ts. The earlier solo weekly plan is still reachable from the home screen.

## Stack (do not substitute without asking)
- **Expo (React Native, TypeScript, Expo Router)**: one codebase for iPhone and Android; share extension lets Pal receive reels from Instagram. Needs a development build (not Expo Go).
- **Clerk (@clerk/clerk-expo)**: sign-in and user profiles.
- **SurrealDB Cloud**: app data (users, recipes, plans, logs, signup counter). **SurrealDB Agent Memory**: Pal's scoped memory, only if access is granted (see Gate 0); otherwise a profile_fact table with a scope column.
- **Backend: small TypeScript API (Hono) on Google Cloud Run.** Mobile app never holds API keys.
- **Gemini (Google AI API)**: watches video (reels) and, later, live voice. **Claude (Anthropic API)**: reasoning, profile extraction, plan writing.
- **USDA FoodData Central API**: nutrient values. All numbers come from code, never from an LLM.
- **Apify Instagram scraper** (or yt-dlp fallback): fetch the media for a reel URL the user supplied.

## Hard rules
1. **No secrets in code.** Read from env vars listed in .env.example.
2. **Never ask for or store an Instagram password or any third-party login.** Reels arrive via (a) the user's own Instagram data export file, or (b) the share button.
3. **LLMs never invent numbers.** Calories, macros, targets = deterministic code. LLM picks and arranges; code verifies.
   Exception (Vicente, Oct 21): Meal Prep Swap shows Claude's per-serving macro estimates for submitted dishes, labelled as estimates. Scaling, merging, prices, the cost split and the solo plan's targets stay in code.
4. **Health statements need a source.** Pal may only state nutrition advice that maps to an entry in evidence/pack.json; otherwise it says it doesn't know.
5. **Consent before memory.** Nothing extracted from a user's chat export is saved until the user ticks it. Sensitive categories default OFF. Raw export is deleted after processing.
6. **Memory scopes don't mix.** A feature loads only the scopes it needs (food_health, schedule, location, work, personal).
7. **Adults only; screening can decline the plan** (see BUILD_PLAN.md §5). Store only eligible: true/false, not the reasons.
8. Ask before adding a new paid service or dependency.

## Gate protocol (how we know it's working)
- Work gate by gate (BUILD_PLAN.md §3). Each gate has an objective PASS test. Run it, record the result in STATUS.md with evidence (command output summary), then move on.
- **Timebox: 90 minutes per blocker.** At 90 minutes, write the blocker in DECISIONS.md, switch to the listed fallback, and tell the user in one line. Never silently shrink scope.
- Max 3 different attempts at the same failing command before the timebox rule applies.
- Stop and ask the user only for: spending money, credentials/API keys, privacy or legal choices, deleting data.
- Update STATUS.md after every gate, even failures. It is how the user sees progress without watching.

## Out of scope (do NOT build)
Floating overlay over other apps; automating Instagram (liking/commenting/"training the algorithm"); travel, hiking, or other non-food buckets; booking anything; macro tracking beyond the simple "I ate it" tick; character evolution levels; ChatGPT export import unless the real file format has been inspected; voice (stretch only, Gate F).

## Brand
Mascot Pal with four states: Listening, Thinking, Excited, Helping. Palette: blue-violet gradient, mint, orange, pink, deep navy; sparkle-star app icon. Reference image: assets/brand/ScrollPal_Brand_Concept_Board.png. Mascot needs separate transparent assets; ask the user for them rather than cropping the board.
