# How we share the repo

Plain-English version: each of us has our own copy of the code (a "branch") to work in, so we don't overwrite each other. When a piece of work is ready, we ask to merge it into the shared copy (`main`) with a pull request, and someone else looks at it first.

| Person | GitHub | Branch |
| :- | :- | :- |
| Vicente | man-in-finance-65 | `dev/man-in-finance-65` |
| Arjun | ArjunB3hl | `dev/ArjunB3hl` |
| Mohit Solanki | MohitS2004 | `dev/MohitS2004` |

## Rules
1. Work only on your own branch. Pull `main` into it often (`git pull origin main`) so you don't drift.
2. Small pull requests into `main`, one gate or one piece of a gate at a time.
3. Update `STATUS.md` in the same pull request that passes or fails a gate.
4. Never commit `.env`, `saved_posts.json`, `conversations.json`, or anyone's personal data.
5. Roles are still to be agreed. Until then, write your name next to a gate in `STATUS.md` before you start it, so two people don't build the same thing.

## Getting access
Arjun and Mohit need to accept the GitHub invite to `man-in-finance-65/scroll_pal` (Settings > Collaborators on GitHub) before they can push.
