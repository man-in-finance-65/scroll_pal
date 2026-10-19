# Gate 0 checklist

PASS test: every key below is in `.env`, the Instagram export is requested, the Claude export is requested, and SurrealDB Agent Memory is marked yes or no.

Paste each value into `.env` (copy `.env.example` first). Never paste keys into chat, GitHub or a doc.

| # | What | Where | Paste into `.env` as | Done |
| :- | :- | :- | :- | :- |
| 1 | Claude chat export | claude.ai > Settings > Privacy > Export data | (file, keep private) | yes |
| 2 | Instagram saved posts | See `docs/INSTAGRAM_IMPORT.md`, option 1 | (file, keep private) | |
| 3 | Gemini API key | aistudio.google.com > Get API key | `GEMINI_API_KEY` | |
| 4 | Gemini prices | ai.google.dev/pricing, the row for `GEMINI_MODEL` | `GEMINI_PRICE_INPUT_PER_M`, `GEMINI_PRICE_OUTPUT_PER_M` | |
| 5 | Anthropic API key | console.anthropic.com > API Keys | `ANTHROPIC_API_KEY` | |
| 6 | Apify token | console.apify.com > Settings > Integrations > API token | `APIFY_TOKEN` | |
| 7 | USDA key | fdc.nal.usda.gov/api-key-signup (free) | `USDA_API_KEY` | |
| 8 | Clerk app | dashboard.clerk.com > create app > API Keys | `CLERK_SECRET_KEY`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | |
| 9 | SurrealDB Cloud instance | surrealdb.com/cloud > create instance; make a database user | `SURREAL_URL`, `SURREAL_NAMESPACE`, `SURREAL_DATABASE`, `SURREAL_USER`, `SURREAL_PASS` | |
| 10 | Agent Memory access | Ask the SurrealDB hackathon contact | `SURREAL_AGENT_MEMORY=yes` or `no` | |
| 11 | Google Cloud project with billing and a budget alert | console.cloud.google.com > new project > Billing > Budgets | `GCP_PROJECT_ID` | |
| 12 | Expo account | expo.dev > sign up (needed for phone builds) | (no key yet) | |

Items 3 and 6 are all Gate B needs. Do those first.

Spending: Apify, Gemini, Anthropic and Google Cloud can charge money. Set a spending limit or budget alert on each before adding a card.
