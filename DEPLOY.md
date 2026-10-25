# Deploy ScrollPal

Everything deploys from GitHub (Actions), using the secrets stored on the repo. You never paste a key into a terminal.

**Current way (since 2026-10-25): `Ship ScrollPal (server + app)`** (`.github/workflows/ship.yml`).
Every push to `claude/nice-thompson-6oeu73` that touches `api/` or `app/` updates the server (`scrollpal-api` on
Cloud Run, keys stay in Secret Manager) and then publishes the app to Expo Go branch `v1` pointed at it. It signs in
to Google with the keyless setup from `scripts/connect-github.sh` (repo variables `GCP_WIF_PROVIDER`, `GCP_SA_EMAIL`,
`GCP_PROJECT_ID`) and uses the `EXPO_TOKEN` secret. Open the app with the always-latest link in section 1.
The older sections below still work but are no longer needed.

| What | Workflow | Secrets it uses |
|---|---|---|
| The app, for Expo Go | `Publish app to Expo Go` | `EXPO_TOKEN` (already set) |
| The API + landing page, on Google Cloud Run | `scripts/deploy-cloud-shell.sh` (easiest) or `Deploy API to Cloud Run` | Cloud Shell asks for the keys; the GitHub route needs `GCP_PROJECT_ID`, `GCP_SA_KEY`, `GEMINI_TOKEN` |

Run a workflow by hand: GitHub → **Actions** → pick it → **Run workflow**. Both also run when you push changes to their folders.

---

## Web and Android (same code as the phone app)

One React Native codebase in `app/` runs on iPhone, Android and the web.

- **Try the web version locally:** `cd app && npx expo start --web`
- **Make the web files:** `cd app && npm run build:web` (puts a ready-to-host site in `app/dist`)
- **Host it with Expo (EAS Hosting):** `cd app && npm run deploy:web` (needs `EXPO_TOKEN`, or `npx eas-cli login` once). Set `EXPO_PUBLIC_API_URL` to the Cloud Run address first, same as for the phone app.
- **Android APK (installable file):** `cd app && npx eas-cli build --platform android --profile apk`
- On the web, phone-only extras (vibration, reminders) quietly do nothing; everything else works.

---

## 1. The app (Expo Go): already working

Every push that touches `app/` publishes to the Expo project **scroll-pal**, branch **v1**.

**Why your old QR code didn't change:** each QR code on an Expo update page points at *one exact update*, frozen in time. A new publish makes a *new* update with a *new* QR code. The old one keeps opening the old app forever.

Two ways to always get the latest:
- **Stable link (recommended):** `exp://u.expo.dev/79b48e89-9dc9-4e6f-9e1a-183307fbc025?channel-name=v1&runtime-version=exposdk:58.0.0`. Open it on your phone with Expo Go installed. It always loads the newest update on branch `v1`. This is the link the landing page uses.
- **Exact update:** the workflow run's summary prints `exp://u.expo.dev/<project>/group/<update>` for that one publish.

Then fully close Expo Go and reopen it. Expo Go keeps the last app it opened.

## 2. The API + landing page on Google Cloud Run (about 10 minutes, once)

Pal's server is what digests links and saves chat answers. **Until it exists, the app says "I'm not connected to my server yet".**
You need a Google Cloud project with billing turned on (Google gives free credit to new accounts; Pal costs a few cents per recipe).

**Easiest way: one paste in Google Cloud Shell (no GitHub secrets needed)**

1. Open https://shell.cloud.google.com (signed in to the Google account that owns the project).
2. Run (replace `YOUR_REAL_PROJECT_ID` with the project ID shown in Cloud Shell's prompt, e.g. `muse-x-scroll-pal-youtube`; don't type it literally):
   ```bash
   git clone https://github.com/man-in-finance-65/scroll_pal && cd scroll_pal
   git checkout claude/gracious-keller-6lrp79
   bash scripts/deploy-cloud-shell.sh YOUR_REAL_PROJECT_ID
   ```
3. It asks for your Gemini key (and optionally the Anthropic key). What you type is hidden and goes straight into Google's Secret Manager. (If the server is already deployed it tells you to use `scripts/update-server.sh` instead.)
4. After 3 to 5 minutes it prints your address, like `https://scrollpal-api-xxxx-uc.a.run.app`.
5. **Send that address to Claude**, who re-publishes the app with it. Or do it yourself: GitHub → **Actions → Publish app to Expo Go → Run workflow**, paste the address into the box.

Your landing page is that same address. Open it on your phone.

Check it: `curl https://YOUR-ADDRESS/health` shows `{"ok":true,"mock":false}`. (Not `/healthz`: Google reserves that one.)

**Alternative: let GitHub deploy for you.** Needs the secrets `GCP_PROJECT_ID` and `GCP_SA_KEY` (run `bash scripts/gcp-setup.sh YOUR_REAL_PROJECT_ID` in Cloud Shell to create the key). Then GitHub → **Actions → Deploy API to Cloud Run → Run workflow**. It deploys and re-publishes the app with the new address by itself. If a run says "Missing GCP_PROJECT_ID or GCP_SA_KEY", GitHub can't see those secrets (check the name and that they're **Repository** secrets, not Environment secrets).

**Updating the server later** (after I change the API code). In Cloud Shell, inside the `scroll_pal` folder:
```bash
git pull origin claude/gracious-keller-6lrp79 && gcloud run deploy scrollpal-api --source api --region us-central1 --quiet
```
It keeps your keys and settings. No questions asked.

**Remember the address for every future publish:** put it in a file called `app/.api-url` (just the address, one line), or set a repo variable `API_URL`. Otherwise later publishes ship an app with no server.

Cost note: the API is capped at 2 instances. The recipe cache is in memory, so it resets on restart.

## 3. The live tracker (Google Sheet)

Every tap and every message people send to Pal is saved to a private Google Sheet, live.
**Your tracker:** https://docs.google.com/spreadsheets/d/1ZXnv2aLX2tc93qWDKJvOK97DOzEDR8v3fA6-RjUyaKU/edit (only you and the server can open it).

Tabs:
- **Summary**: the numbers at a glance (said yes, people using the app, links digested, cooks, advice messages).
- **Users**: one row per person (an anonymous random code per phone): when they started, last active, links, plans, cooks, skips, how many advice messages, their **latest advice**, and where they are (Hooked, Cooking, Planned...).
- **Feedback**: every advice message, in order, with the question Pal asked and exactly what they said. Filter column B to read one person's whole conversation.
- **Events** and **Pals**: the raw log of taps, and everyone who said yes on the landing page.

The sheet fills itself once the server has the update (next section). People are anonymous: no names or emails are collected.

To update the server so it writes to the sheet (and to ship any other server change), in Cloud Shell inside the `scroll_pal` folder:
```bash
git pull origin claude/gracious-keller-6lrp79
bash scripts/update-server.sh
```
It keeps your keys. It turns on the Sheets service, lets the server write to the tracker, and redeploys.

If rows don't appear: the sheet must be shared (Editor) with your server's account, `YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com`. Check the Cloud Run logs for lines starting `sheet `.

## Count taps (share / plan / done / skip)

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND textPayload:"EVENT type="' --limit 1000 --format='value(textPayload)' | awk '{print $2}' | sort | uniq -c
```

## Run it on your laptop instead

See README.md. For the landing page locally: `cd api && npm run dev:mock`, then open http://localhost:8080.
