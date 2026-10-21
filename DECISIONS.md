# DECISIONS

Every fallback, blocker and non-obvious choice. Newest at the top.

## 2026-10-21: Demo mode MVP
- The app runs the whole meal-plan flow without Clerk, SurrealDB, Gemini or Apify keys ("demo mode"). Sign-in appears once Clerk keys exist.
- 10 demo recipes stand in for processed reels. Their per-100 g values are typical USDA figures typed in by hand and labelled approximate in the app; calories and protein are still computed by the engine from grams. Replace with live USDA lookups.
- Planner change: a day must land within 5% of the calorie target first; protein is next. Before this, a 90 kg woman's plan overshot calories chasing protein.
- For the dietitian: protein is 1.6 g per kg of current body weight. For people with a high BMI that gives a target the calorie budget can't reach (144 g at 1,392 kcal). Ask whether to base it on a goal or adjusted weight instead.

## 2026-10-20: Clerk application and iPhone builds
- Clerk application: `app_3KxNEYnchYLltwg5H3bS7ls5TrZ` (picked in the Clerk Dashboard, Expo). The app already uses `@clerk/expo`, so we link and pull keys instead of running `clerk init` (init could create a second application). Steps in docs/GATE_A_PHONE.md.
- iPhone: installing our own app (with the share button) on testers' iPhones needs a paid Apple Developer account. Google Cloud can't replace it, because it hosts the server and has nothing to do with signing iPhone apps. Free path until Vicente decides: Android development build, plus Expo Go or the web version for iPhone users (with the paste-link box instead of the share button).

## 2026-10-20: Gate B reel lists in the repo
- `scripts/gate-b/reels.food.txt` (Vicente's 10 picks) and `reels.not-food.txt` (filter test) are committed without tracking parameters, so any teammate can rerun Gate B.

## 2026-10-20: Gate A choices
- Clerk's Expo package is now `@clerk/expo` (v4); `@clerk/clerk-expo` in the stack list is its old name. Same product, not a substitution.
- Sign-in uses Clerk's hosted sign-in screen (`useHostedAuth`). Clerk maintains that screen, it works in Expo Go for a quick test, and it needs no extra native modules. Swap for Clerk's native components later if we want it styled in Pal colours.
- Expo SDK 58 (latest). App id `com.scrollpal.app` is a placeholder; change it before the first store build if you want a different one.
- The API is plain Node (no build step) with the screening and nutrition engine imported directly. Cloud Run builds it from `api/Dockerfile`.

## 2026-10-20: Gate B reel set
- Vicente's 10 picked reels (Drive doc "MY ALGORITHM") are AI and comedy reels, not food. They make a good **filter test** (Pal must answer "not a recipe" for all 10) but can't pass Gate B, which needs food reels. 10 food reels are still needed.

## 2026-10-19: Instagram import paths
- Main path: Instagram's official "Download your information" export (Saved, JSON). Backups: share button (Gate E) and paste-link box.
- Not building the desktop "copy my saved links" button (Vicente agreed). Revisit only if the export email is slow.
- Why the saved page can't be read directly: `instagram.com/<user>/saved/` is only visible when logged in. Apify's Instagram scraper sees only public, logged-out pages, and Pal never takes an Instagram login. So reel links have to come from the export, the share button or a paste.

## 2026-10-19: Apify cost per reel
- `apify/instagram-scraper` charges per result: $2.70 per 1,000 on the Free plan, so $0.0027 per reel. The plan's earlier $0.002 estimate is replaced.

## 2026-10-19: One branch per contributor
- Branches: `dev/man-in-finance-65`, `dev/ArjunB3hl`, `dev/MohitS2004`.
- Shared files (CLAUDE.md, BUILD_PLAN.md, README, .env.example, STATUS.md, DECISIONS.md) live on the base branch; each person merges into `main` through a pull request.
- Roles are NOT assigned yet. The team split in BUILD_PLAN.md §7 is a proposal until Vicente talks to Arjun and Mohit.

## 2026-10-19: Gate B reads a plain list of reel URLs
- The Gate B script takes `scripts/gate-b/reels.txt` (one URL per line) instead of parsing `saved_posts.json`.
- Reason: the kickoff rule says to inspect the real export before writing a parser. The parser is written once the real file arrives.
