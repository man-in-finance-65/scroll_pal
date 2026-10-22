# STATUS

Updated after every gate, pass or fail. Newest at the top.

| Gate | State | Evidence | Updated |
| :- | :- | :- | :- |
| Meal Prep Swap | WORKING IN PREVIEW; LIVE PARTS BUILT, NOT RUN | Preview: demo pod to finished swap, creator-chefs page, receipt split, all clicked through with no errors. 66 engine/app + 11 API tests pass. Built but untested against the real services (this cloud environment blocks them): reel link to Apify to Gemini, Add to Instacart, SurrealDB, Clerk | 2026-10-22 |
| MVP demo | WORKING (no keys needed) | Full flow in the app and on the web: about you, safety check, targets, 7-day plan, "I ate it" totals, shopping list, recipe steps. Plan passes the code check for 15 of 15 test profiles (2, 3 and 4 meals a day). Clicked through end to end in a phone-sized browser with no errors. Runs on 10 demo recipes until reels are processed | 2026-10-21 |
| 0 Setup | IN PROGRESS | Claude export requested. Missing: Gemini key, Apify token in .env, Instagram export, Agent Memory answer | 2026-10-19 |
| B Reel to recipe | SCRIPT WRITTEN, NOT RUN | Waiting on GEMINI_API_KEY, APIFY_TOKEN and 10 reel links (the saved page is login-only, so links come from the export or by hand) | 2026-10-19 |
| A App shell | BUILT, NOT RUN ON A PHONE | App: Clerk sign-in (Clerk-hosted screen) then calls the API; typecheck clean, iOS bundle compiles. API: /v1/me creates the user row, /v1/screening stores only eligible; 5 of 5 API tests pass with a stand-in database. Waiting on Clerk keys, SurrealDB connection details and a phone run (docs/GATE_A_PHONE.md) | 2026-10-20 |
| C Nutrition engine | ENGINE PASSES, NOT WIRED | `npm test`: 36 of 36 pass (31 engine). Code-built week lands within 5% of calories and above protein minus 10% for both test profiles; LLM retry-then-fallback loop tested with a stand-in. Still to do: USDA lookup, Claude as plan proposer, dietitian review. Built on dev/man-in-finance-65 | 2026-10-19 |
| D Consent import | NOT STARTED | | |
| E Share to Pal | NOT STARTED | | |
| F Live counter | NOT STARTED | | |
| G Testers | NOT STARTED | | |
| H Submit | NOT STARTED | | |
