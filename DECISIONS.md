# DECISIONS

Every fallback, blocker and non-obvious choice. Newest at the top.

## 2026-10-19: One branch per contributor
- Branches: `dev/man-in-finance-65`, `dev/ArjunB3hl`, and one for Mohit (GitHub username pending).
- Shared files (CLAUDE.md, BUILD_PLAN.md, README, .env.example, STATUS.md, DECISIONS.md) live on the base branch; each person merges into `main` through a pull request.
- Roles are NOT assigned yet. The team split in BUILD_PLAN.md §7 is a proposal until Vicente talks to Arjun and Mohit.

## 2026-10-19: Gate B reads a plain list of reel URLs
- The Gate B script takes `scripts/gate-b/reels.txt` (one URL per line) instead of parsing `saved_posts.json`.
- Reason: the kickoff rule says to inspect the real export before writing a parser. The parser is written once the real file arrives.
