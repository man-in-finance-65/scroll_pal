# ScrollPal

Paste a cooking video link → Pal turns it into a recipe and a plan → tap **Done** on a meal → Pal reacts and gains XP.

- `api/` — tiny Node/TypeScript server (Express). Talks to Gemini (reads the video) and Claude (builds the plan). Deployed on Google Cloud Run.
- `app/` — Expo (SDK 58) app. Runs in Expo Go. Only talks to the API; it never holds API keys.

See `CLAUDE.md` for the rules this project follows.

## 1. Run the API on your laptop

```bash
cd api
npm install
cp ../.env.example .env        # then edit .env (see below)
npm run dev                    # prints "Pal API listening on :8080"
```

- **Zero-spend mode:** keep `MOCK_AI=1` in `api/.env`. Every link returns the same sample recipe and plan.
- **Real mode:** set `MOCK_AI=0`, plus `GEMINI_API_KEY` (from https://aistudio.google.com/apikey) and `ANTHROPIC_API_KEY` (from https://console.anthropic.com).
- **Test 3 real links** (costs a few cents):
  ```bash
  npm run test:links -- https://youtube.com/shorts/AAA https://youtube.com/shorts/BBB https://youtube.com/shorts/CCC
  ```
  Each prints `PASS` with the title, ingredient count and calories, or `FAIL` with the reason.
- `MOCK_AI=fail` simulates Gemini being down, so you can see the "paste the caption" fallback.

## 2. Run the app on your phone

1. Install **Expo Go** from the App Store or Play Store.
2. Find your laptop's Wi-Fi IP (Mac: System Settings → Wi-Fi → Details → IP address, looks like `192.168.x.x`).
3. Start the app:
   ```bash
   cd app
   npm install
   cp ../.env.example .env   # set EXPO_PUBLIC_API_URL=http://192.168.x.x:8080 (or your Cloud Run URL)
   npx expo start
   ```
4. Open the printed link or scan the QR code with your phone camera (iPhone) or Expo Go (Android). Phone and laptop must be on the same Wi-Fi.

## 3. Tests

```bash
cd app && npm test     # XP and level rules (11 tests)
```

## What to check on your phone

1. **Add:** paste a YouTube Shorts recipe link and tap *Make it a recipe*. Pal shows *Thinking*, then *Excited*, and the recipe opens.
2. **Recipe:** you see big number cards. Numbers Pal estimated start with `~`, and the time card shows its sum.
3. **Build my plan:** pick Bulk, Maintain or Cut and a number of days. The plan opens.
4. **Confirm plan:** a notification says "Cart ready, N items" and the grocery checklist opens. It is labelled as a checklist, not a cart.
5. **Done** on a cook:
   - You feel a haptic, see "+10 XP", and get a passport stamp.
   - After the 3rd Done, Pal reaches **Lv.2** with the maths shown (3 cooks × 10 = 30) and a stronger haptic.
   - The feedback screen appears after that.
6. **Skip** a cook: Pal goes *Slow* but keeps its level.
7. **Pal tab:** you see the XP maths, the weekly ring and the goal switch. Pal's body changes with your goal.
8. **Dark mode:** switch your phone to dark mode and check every screen.

Start over: Passport tab → *Start over*.

## 4. Deploy and share

See **DEPLOY.md**. It covers the app (Expo Go), the API + landing page (Cloud Run), and the hidden Google Sheet.

## Landing page

`api/landing/` is the "Do you want to be Pal's pal?" page, served at the API's address. A yes is counted in the private sheet, then the visitor is sent to the app in Expo Go. Edit `api/landing/config.json` to change where "Open ScrollPal" points.
