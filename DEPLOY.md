# Deploy ScrollPal

Everything deploys from GitHub (Actions), using the secrets stored on the repo. You never paste a key into a terminal.

| What | Workflow | Secrets it uses |
|---|---|---|
| The app, for Expo Go | `Publish app to Expo Go` | `EXPO_TOKEN` (already set) |
| The API + landing page, on Google Cloud Run | `scripts/deploy-cloud-shell.sh` (easiest) or `Deploy API to Cloud Run` | Cloud Shell asks for the keys; the GitHub route needs `GCP_PROJECT_ID`, `GCP_SA_KEY`, `GEMINI_TOKEN` |

Run a workflow by hand: GitHub → **Actions** → pick it → **Run workflow**. Both also run when you push changes to their folders.

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
2. Run (replace `YOUR_PROJECT_ID`):
   ```bash
   git clone https://github.com/man-in-finance-65/scroll_pal && cd scroll_pal
   git checkout claude/gracious-keller-6lrp79
   bash scripts/deploy-cloud-shell.sh YOUR_PROJECT_ID
   ```
3. It asks for your Gemini key (and optionally the Anthropic key and the sheet details). What you type is hidden and goes straight into Google's Secret Manager.
4. After 3 to 5 minutes it prints your address, like `https://scrollpal-api-xxxx-uc.a.run.app`.
5. **Send that address to Claude**, who re-publishes the app with it. Or do it yourself: GitHub → **Actions → Publish app to Expo Go → Run workflow**, paste the address into the box.

Your landing page is that same address. Open it on your phone.

Check it: `curl https://YOUR-ADDRESS/health` shows `{"ok":true,"mock":false}`. (Not `/healthz`: Google reserves that one.)

**Alternative: let GitHub deploy for you.** Needs the secrets `GCP_PROJECT_ID` and `GCP_SA_KEY` (run `bash scripts/gcp-setup.sh YOUR_PROJECT_ID` in Cloud Shell to create the key). Then GitHub → **Actions → Deploy API to Cloud Run → Run workflow**. It deploys and re-publishes the app with the new address by itself. If a run says "Missing GCP_PROJECT_ID or GCP_SA_KEY", GitHub can't see those secrets (check the name and that they're **Repository** secrets, not Environment secrets).

**Updating the server later** (after I change the API code). In Cloud Shell, inside the `scroll_pal` folder:
```bash
git pull origin claude/gracious-keller-6lrp79 && gcloud run deploy scrollpal-api --source api --region us-central1 --quiet
```
It keeps your keys and settings. No questions asked.

**Remember the address for every future publish:** put it in a file called `app/.api-url` (just the address, one line), or set a repo variable `API_URL`. Otherwise later publishes ship an app with no server.

Cost note: the API is capped at 2 instances. The recipe cache is in memory, so it resets on restart.

## 3. Hidden Google Sheet (counts + feedback, about 3 minutes)

The landing page and Pal chat save rows to a private Google Sheet. Visitors never see it. If you skip this, rows still go to the Cloud Run logs (`EVENT type=pal_yes`, `EVENT type=feedback`).

1. Create a new Google Sheet (name it anything, e.g. "ScrollPal Pals"). Keep it private; do not share the link.
2. **Extensions → Apps Script**. Paste all of `docs/sheet-webhook.gs`. Change `SECRET` to a long random string and remember it.
3. In the editor, choose the function `setup` and press **Run**. Approve the permissions. It creates the tabs **Summary**, **Pals** and **Feedback**.
4. **Deploy → New deployment →** gear icon → **Web app** → Execute as **Me**, Who has access **Anyone** → **Deploy**. Copy the web app URL.
5. Give the webhook URL and `SECRET` to the Cloud Shell deploy script (it asks), and run it again. (GitHub route: add secrets `SHEET_WEBHOOK_URL` and `SHEET_SECRET`, then re-run the deploy.)

"Anyone" only means anyone with the long URL can try to post; the API's secret check rejects them. Only your API knows the secret.

The **Summary** tab shows how many pals said yes and how many feedback answers came in.

## Count taps (share / plan / done / skip)

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND textPayload:"EVENT type="' --limit 1000 --format='value(textPayload)' | awk '{print $2}' | sort | uniq -c
```

## Run it on your laptop instead

See README.md. For the landing page locally: `cd api && npm run dev:mock`, then open http://localhost:8080.
