# Pal milestone 1 (pal-server + pal-app)

Runs next to the existing ScrollPal code; nothing in /app or /api was touched.

## Run it
1. Install yt-dlp and ffmpeg (`brew install yt-dlp ffmpeg` or `pip install yt-dlp` + your package manager's ffmpeg).
2. `cd pal-server && cp .env.example .env` and fill in ANTHROPIC_API_KEY, OPENAI_API_KEY, USDA_API_KEY.
3. `npm install && npm run dev` (port 3000). `npm test` runs the tests.
4. `cd pal-app && npm install && npx expo start`, open in Expo Go. The app finds your computer automatically; override with EXPO_PUBLIC_API_URL if needed.

## Try the API
curl -X POST localhost:3000/v1/ingest -H 'content-type: application/json' -d '{"url":"<reel URL>"}'

## Choices
- Server uses Express: one small dependency, and the repo's existing API already uses it.
- Macros are per portion, computed from USDA in code. Ingredients USDA can't match (or can't convert to grams) are listed in `unmatched` and left out. Numbers are truncated, never rounded up.
- goal-fit swaps also carry `delta` (that swap's macro change) so the app can toggle swaps with no network call. Totals = original + sum of enabled swap deltas.
- Extra packages in the app: @tanstack/react-query (asked for), expo-clipboard (paste + clipboard snackbar), expo-font + the two @expo-google-fonts packages (Plus Jakarta Sans, Inter).
