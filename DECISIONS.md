# DECISIONS

Every fallback, blocker and non-obvious choice. Newest at the top.

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
