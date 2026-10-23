# Deploy ScrollPal

Everything deploys from GitHub (Actions), using the secrets stored on the repo. You never paste a key into a terminal.

| What | Workflow | Secrets it uses |
|---|---|---|
| The app, for Expo Go | `Publish app to Expo Go` | `EXPO_TOKEN` (already set) |
| The API + landing page, on Google Cloud Run | `Deploy API to Cloud Run` | `GCP_PROJECT_ID`, `GCP_SA_KEY` (new, one time), `GEMINI_TOKEN` (already set), `ANTHROPIC_API_KEY` (optional), `SHEET_WEBHOOK_URL` + `SHEET_SECRET` (optional) |

Run a workflow by hand: GitHub → **Actions** → pick it → **Run workflow**. Both also run when you push changes to their folders.

---

## 1. The app (Expo Go): already working

Every push that touches `app/` publishes to the Expo project **scroll-pal**, branch **v1**.

**Why your old QR code didn't change:** each QR code on an Expo update page points at *one exact update*, frozen in time. A new publish makes a *new* update with a *new* QR code. The old one keeps opening the old app forever.

Two ways to always get the latest:
- **Stable link (recommended):** `exp://u.expo.dev/79b48e89-9dc9-4e6f-9e1a-183307fbc025?channel-name=v1&runtime-version=exposdk:58.0.0`. Open it on your phone with Expo Go installed. It always loads the newest update on branch `v1`. This is the link the landing page uses.
- **Exact update:** the workflow run's summary prints `exp://u.expo.dev/<project>/group/<update>` for that one publish.

Then fully close Expo Go and reopen it. Expo Go keeps the last app it opened.

## 2. The API + landing page on Google Cloud Run (one-time setup, about 10 minutes)

This needs a Google Cloud project (with billing on) and a key that lets GitHub deploy to it. I can't create that from here, so:

1. Open **Google Cloud Shell**: https://shell.cloud.google.com (signed in to the Google account that owns the project).
2. Run (replace `YOUR_PROJECT_ID`):
   ```bash
   git clone https://github.com/man-in-finance-65/scroll_pal && cd scroll_pal
   git checkout claude/gracious-keller-6lrp79
   bash scripts/gcp-setup.sh YOUR_PROJECT_ID
   ```
3. It prints a key. In GitHub → repo **Settings → Secrets and variables → Actions → New repository secret**, add:
   - `GCP_PROJECT_ID` = your project id
   - `GCP_SA_KEY` = the whole key text it printed
4. In Cloud Shell, delete the key file: `rm scrollpal-deployer-key.json`.
5. Add `ANTHROPIC_API_KEY` as a secret too if you want Claude-written plans. Without it Pal uses a simple built-in plan and everything still works.
6. GitHub → **Actions → Deploy API to Cloud Run → Run workflow**. When it finishes, the run summary shows your address, like `https://scrollpal-api-xxxx-uc.a.run.app`.
7. Tell the app where the API is: repo **Settings → Secrets and variables → Actions → Variables tab → New repository variable**: `API_URL` = that address. Then re-run **Publish app to Expo Go**.

Your landing page is now the same address. Open it on your phone.

Check it: `curl https://YOUR-ADDRESS/healthz` shows `{"ok":true,"mock":false}`.

Cost note: the API is capped at 2 instances. Gemini and Claude calls cost a few cents per recipe. The recipe cache is in memory, so it resets on restart.

## 3. Hidden Google Sheet (counts + feedback, about 3 minutes)

The landing page and Pal chat save rows to a private Google Sheet. Visitors never see it. If you skip this, rows still go to the Cloud Run logs (`EVENT type=pal_yes`, `EVENT type=feedback`).

1. Create a Google Sheet (or use "ScrollPal Pals" if one exists). Keep it private.
2. **Extensions → Apps Script**. Paste all of `docs/sheet-webhook.gs`. Change `SECRET` to a long random string and remember it.
3. In the editor, choose the function `setup` and press **Run**. Approve the permissions. It creates the tabs **Summary**, **Pals** and **Feedback**.
4. **Deploy → New deployment →** gear icon → **Web app** → Execute as **Me**, Who has access **Anyone** → **Deploy**. Copy the web app URL.
5. Add two GitHub secrets: `SHEET_WEBHOOK_URL` = that URL, `SHEET_SECRET` = the `SECRET` you chose. Re-run **Deploy API to Cloud Run**.

"Anyone" only means anyone with the long URL can try to post; the API's secret check rejects them. Only your API knows the secret.

The **Summary** tab shows how many pals said yes and how many feedback answers came in.

## Count taps (share / plan / done / skip)

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND textPayload:"EVENT type="' --limit 1000 --format='value(textPayload)' | awk '{print $2}' | sort | uniq -c
```

## Run it on your laptop instead

See README.md. For the landing page locally: `cd api && npm run dev:mock`, then open http://localhost:8080.
