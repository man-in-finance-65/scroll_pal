# ScrollPal

A Pal that turns your doomscrolling into productivity.

Saw a recipe, workout or tip in a reel? Paste the link, caption or a screenshot. Pal (Gemini) turns it into a **Pod**: a summary, a checklist of steps and a shopping list with Instacart links. Pods are saved on the phone.

## Run it on your phone

1. Install **Expo Go** from the App Store or Play Store.
2. On a computer:
   ```sh
   npm install
   npx expo start --tunnel
   ```
3. Scan the QR code with your camera (iPhone) or Expo Go (Android).
4. In the app, open **Settings** and paste your Gemini API key (or set `EXPO_PUBLIC_GEMINI_API_KEY` in a `.env` file before `expo start`).

Every push also publishes an update to Expo through `.github/workflows/publish.yml`, using the `EXPO_TOKEN` and `GEMINI_TOKEN` repository secrets.

## Not in the MVP yet

- Downloading the reel video itself (Apify) — Pal reads the caption and screenshot instead.
- Sign-in (Clerk) and a cloud database — Pods live on the device.
- Instacart checkout — items open an Instacart search instead.
