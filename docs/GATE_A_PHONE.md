# Gate A: Pal on your phone

PASS test: sign in on a real phone, then see your user row in SurrealDB.

## One-time setup (about 20 minutes)
1. **Clerk** (dashboard.clerk.com): create an application named ScrollPal with **Email** sign-in on.
   - Turn on **Native applications** (Configure > Native applications). Without it, phone sign-in fails.
   - API Keys page: copy the Publishable key into `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and the Secret key into `CLERK_SECRET_KEY`.
2. **SurrealDB Cloud**: create an instance. From its **Connect** panel, copy the connection URL into `SURREAL_URL`. Create a namespace and database (for example `pal` and `pal`) and a database user, then fill in the `SURREAL_*` lines.
   - Open the instance's query editor and paste in all of `api/db/schema.surql`. That creates the tables.
3. Put the keys in `.env` at the repo root. Put the two `EXPO_PUBLIC_` lines in `app/.env` too.

## Run it
In one terminal (the server):
```
cd api && npm install && npm run dev
```
It should print `Pal API listening on :8080`.

Find your laptop's Wi-Fi address: on Mac, System Settings > Wi-Fi > Details > IP address (looks like 192.168.x.x). In `app/.env`, set `EXPO_PUBLIC_API_URL=http://192.168.x.x:8080`. Your phone must be on the same Wi-Fi.

In a second terminal (the app):
```
cd app && npm install && npx expo start
```

**Quick check, 2 minutes:** install **Expo Go** on your phone and scan the QR code. Tap Get started, sign in with your email code, and you should see "You're in. Pal saved your account." This is enough to show sign-in works.

**Real Gate A (development build):** Gate A needs a development build, because the share button in Gate E won't run inside Expo Go.
- Android: `npx eas-cli@latest build --profile development --platform android`. It's free and gives you a link to install the app.
- iPhone: needs an Apple Developer account (US$99/year). Decide whether to pay before we start this.

## Check the database
In the SurrealDB query editor, run `SELECT * FROM user;`. Your row should be there with your Clerk id. Write that in STATUS.md and Gate A passes.
