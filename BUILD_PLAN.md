# Pal: Build Plan (Oct 19 to Oct 25, 2026)

## 1. The product in one flow
1. User signs in (Clerk), confirms they are 18+ and passes the health screen.
2. **Goal + schedule** (typed). Optional: upload Claude chat export; Pal proposes facts about them; user ticks which Pal may keep.
3. User uploads Instagram export (saved_posts.json) or shares single reels to Pal.
4. Pal finds the food reels, watches each with Gemini, turns each into a recipe (ingredients, quantities, steps) and asks the user to confirm quantities.
5. Code computes calorie and protein targets. Pal builds a week that fits the user's schedule, using only confirmed recipes, then code verifies the numbers.
6. Output: weekly plan, shopping list, step-by-step cooking view, "I ate it" tick that updates the day's totals.
7. Demo extra: a web page with a live "Yes, I want Pal" counter.

Pal is the face, but the product is the result. Chat is where Pal confirms what it did.

## 2. Architecture (plain English)
Phone app (Expo) talks only to our API on Cloud Run. The API holds all keys and calls: Gemini (watch reels), Claude (write plans, extract profile facts), USDA (nutrient values), Apify (fetch reel media), SurrealDB (store everything). Clerk proves who the user is; the API checks that proof on every call.

## 3. Gates (do in this order; riskiest first)
| **Gate** | **Day** | **What** | **PASS test** | **If it fails (fallback)** |
| :- | :- | :- | :- | :- |
| **0** Setup | Sun night | Keys and exports requested | All keys in .env; Instagram export requested; Claude export requested; SurrealDB Agent Memory access confirmed or marked "no" | No Agent Memory access: use profile_fact table with scope; skip that prize |
| **B** Reel to recipe | Mon | Script only, no app. 10 of Vicente's own saved reels, URL in, recipe JSON out | At least 7 of 10 give a recipe; at least 80% of ingredients have a quantity or are flagged "estimate"; each under 90 s; cost per reel logged | (1) feed caption text plus video; (2) user pastes caption; (3) pre-process 15 reels for the demo and show 1 live |
| **A** App shell | Tue | Dev build on a real phone, Clerk sign-in, row appears in SurrealDB | Sign in on phone, see user row in DB | Web build for sign-in; native later |
| **C** Nutrition engine | Wed | Targets, plan builder, verifier, screening | 20 unit tests pass; plan within 5% of calorie target and protein at or above target minus 10% | If the LLM misses after 2 retries, pick meals in code from confirmed recipes |
| **D** Consent import | Thu | Chat export to candidate facts to consent screen | At least 15 facts with categories from Vicente's real export; **test: an unticked fact is never returned by any query or prompt** | Cap to latest 200 conversations; typed onboarding instead |
| **E** Share to Pal | Thu | Share a reel from Instagram into Pal on iOS and Android | URL lands in queue | Paste-link box inside the app |
| **F** Live counter | Fri | Web page, button, counter | Two phones press; count updates on a big screen in under 2 s | Poll every 2 s instead of live query |
| **G** Testers | Sat | 10 testers finish onboarding to plan | 10 completions logged | Web build for testers; Android APK |
| **H** Submit | Sun | Devpost text, partner-use write-up, 2-min video | Submitted by 6:00 PM ET (about 6 hours of buffer) | n/a |
| Stretch | Sat | Voice with Gemini Live | Spoken question gets a spoken answer inside the app | Skip; demo voice on web only |

Day plan: Mon B; Tue A; Wed C; Thu D+E; Fri polish, brand, F; Sat G, video, freeze at noon; Sun H only.

## 4. Cost math (assumptions labelled)
- Reel fetch via Apify: about $0.002 per reel (from the reel-watcher README; verify). 25 reels x $0.002 = $0.05. 200 reels x $0.002 = $0.40.
- Gemini video: unknown until Gate B logs tokens per reel. Do not guess.
- Chat import: **assumption** 200 conversations x 3,000 tokens = 600,000 tokens. At an **assumed** $3 per 1,000,000 input tokens: 600,000 x 3 / 1,000,000 = $1.80 per user. 10 testers x $1.80 = $18.00. Replace the price with the current one.
- Guard: cache every reel by URL, cap reels per user (50), cap import to 200 conversations.

## 5. Nutrition engine: how Pal gets quality advice
**Principle: no personalities, no vibes. Numbers from code, claims from a vetted source, recipes from reels.**
- **Reels supply recipes only.** Pal strips health claims from reels. Every recipe is re-scored against the user's computed targets.
- **Targets (code, constants in config/nutrition.ts, each with a source id):**
  - Energy need: Mifflin-St Jeor resting rate, times an activity factor. Men: 10 x kg + 6.25 x cm - 5 x age + 5. Women: 10 x kg + 6.25 x cm - 5 x age - 161.
  - Deficit: default 500 kcal/day (Harvard Health summary of its weight center's approach). 500 x 7 = 3,500 kcal/week, roughly 1 lb (rule of thumb, not exact).
  - Cap: no more than 1 to 2 lb of loss per week (same source).
  - Floor: do not plan below 1,200 kcal (women) or 1,500 kcal (men), the low end of the ranges in the same source.
  - Protein: 1.4 to 2.0 g/kg/day for exercising adults (ISSN position stand). Default 1.6 g/kg (design choice inside that range). Example: 80 kg x 1.6 = 128 g/day. Per meal about 0.25 g/kg (80 x 0.25 = 20 g), stand range 20 to 40 g.
  - The 2.3 to 3.1 g/kg range in the ISSN stand is for resistance-trained people dieting for fat loss. Do **not** apply by default.
- **Evidence pack (evidence/pack.json)**: 10 to 15 vetted sources, each with id, title, URL, what it supports. Checked already: ISSN protein position stand (PubMed abstract), Harvard Health calorie-deficit article. To fetch and verify: Canada's Food Guide, Health Canada dietary reference intakes, Obesity Canada clinical guideline, WHO healthy diet fact sheet, Dietitians of Canada. Pal cites pack ids; no id, no claim ("I don't have a reliable source for that").
- **Who to trust (rule, not names):** guideline bodies and position stands first; systematic reviews second; individual experts only when they are a registered dietitian or hold a research PhD in nutrition, exercise physiology or medicine, publish peer-reviewed work, and agree with the consensus. A famous podcast host is not a source. Starting names to *check*, not endorse: Stuart Phillips (McMaster, protein and muscle), Kevin Hall (NIH, energy balance), Brad Schoenfeld (resistance training).
- **Human check:** one registered dietitian reviews config/nutrition.ts, the screening rules and the evidence pack before any tester uses it. Ask Georgian mentors at office hours.
- **Verifier:** after Claude proposes a week, code recomputes totals from confirmed ingredients (USDA values). Outside tolerance: retry twice, then code-built fallback.
- **Screening (adults only; decline and refer to doctor or dietitian):** pregnant or breastfeeding; diagnosed eating disorder or history; diabetes or glucose-lowering medication; underweight (BMI under 18.5); any condition needing supervised diet change. Store only eligible.
- **Check-ins:** weekly, Pal asks about persistent fatigue, irritability or preoccupation with food (warning signs named in the Harvard source) and suggests easing off or seeing a professional.
- Pal never gives medical advice. It says so once at onboarding.

## 6. Data model (SurrealDB)
user(clerk_id, eligible, goal, schedule_json) | source_item(user, url, status, error) | recipe(source_item, title, ingredients[{name,qty,unit,confirmed}], steps, computed_nutrition) | profile_fact(user, text, scope, sensitive, approved) | plan(user, week, meals[]) | shopping_item(plan, name, qty) | meal_log(user, meal, eaten_at) | signup(created_at). Scopes: food_health, schedule, location, work, personal. Sensitive facts default unticked.

## 7. Risk register (things that could delay us)
| **Risk** | **Early signal** | **Mitigation** |
| :- | :- | :- |
| Reel media can't be fetched | Gate B under 7 of 10 | Caption path; paste caption; pre-processed demo set |
| Instagram terms / scraping optics | Judges' Security & ethics criterion | Only user-supplied URLs from their own export; no logins; disclose in Devpost |
| Gemini misreads quantities | Ingredients without quantity | "Estimate" flag; user confirms before macros count |
| Instagram export takes long (async, emailed) | No email by Mon | Request tonight; share-to-Pal and paste-link as other doors |
| iOS dev build / signing problems | Gate A stuck past 90 min | Android build and web build; Apple developer account needed for iPhone testers (about US$99/yr, verify) |
| Share extension fails on iOS | Gate E | Paste-link box |
| Clerk Expo issue | Gate A | Email-code sign-in; web sign-in |
| Agent Memory access not granted | Gate 0 | Plain table with scopes |
| Chat export huge or odd format | Parse errors | Stream-parse, cap 200 conversations, inspect real file first |
| Nutrition hallucination | Verifier fails; claim without source id | Pack-only claims; code numbers; dietitian review |
| Cost creep | Daily spend check | Cache, caps, budget alert in Google Cloud |
| Solo bandwidth | Behind by half a day at any gate | Cut in this order: voice, Eon, check-ins, F, E |
| Demo Day wifi | Venue | Recorded video plus local build |
| Teammates reply late | Arjun / Mohit | Split to be agreed with the team (draft: one backend + Gates B/C, one app + E; Vicente brand, consent UX, testers, demo) |

## 8. Prizes (be ambitious, stay honest)
Best Overall: automatic. Expo: real native app + share extension + EAS builds. Clerk: sign-in and eligibility profile. SurrealDB Agent Memory: scoped, consent-gated memory, the core of the product. Eon: optional, read its Resources tab first and see whether Era can benchmark Pal's nutrition answers against the evidence pack. Only claim a prize where the tool does real work in the product.
