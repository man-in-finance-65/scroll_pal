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
4. Scan the QR code with your phone camera (iPhone) or Expo Go (Android). Phone and laptop must be on the same Wi-Fi.

## 3. Tests

```bash
cd app && npm test     # XP and level rules
```

## 4. Deploy and share

See **DEPLOY.md**.
