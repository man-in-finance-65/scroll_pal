# Deploy ScrollPal (run these on your laptop)

Two parts: put the API on Google Cloud Run, then publish the app with `eas update` so friends can open it in Expo Go.
You need: a Google Cloud project with billing on, the `gcloud` CLI, Node 20+, a free Expo account, a Gemini key and an Anthropic key.

---

## Part 1: API on Cloud Run (about 10 minutes)

```bash
# 1. Sign in and pick your project
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 2. Turn on the services Cloud Run needs (one time)
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

# 3. Store the two keys in Secret Manager. `read -s` hides what you paste, so the key never lands in your shell history.
read -s -p "Gemini key: " K && printf %s "$K" | gcloud secrets create gemini-api-key --data-file=- ; unset K; echo
read -s -p "Anthropic key: " K && printf %s "$K" | gcloud secrets create anthropic-api-key --data-file=- ; unset K; echo

# 4. Let Cloud Run read those secrets
PN=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')
for S in gemini-api-key anthropic-api-key; do
  gcloud secrets add-iam-policy-binding $S --member="serviceAccount:${PN}-compute@developer.gserviceaccount.com" --role=roles/secretmanager.secretAccessor
done

# 5. Deploy (run from the repo root). It builds api/Dockerfile in the cloud.
gcloud run deploy scrollpal-api \
  --source api \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest,ANTHROPIC_API_KEY=anthropic-api-key:latest \
  --set-env-vars MOCK_AI=0 \
  --timeout 120 \
  --max-instances 2
```

It prints a **Service URL** like `https://scrollpal-api-abc123-uc.a.run.app`. Check that it works:

```bash
URL=https://scrollpal-api-abc123-uc.a.run.app   # yours
curl $URL/                                       # {"ok":true,"mock":false}
curl -X POST $URL/v1/ingest -H 'content-type: application/json' -d '{"url":"https://youtube.com/shorts/PASTE_A_RECIPE_SHORT"}'
```

Why these flags:
- `--allow-unauthenticated`: the app has no login, so the API is public. Only the keys are secret, and they stay on the server.
- `--max-instances 2`: caps how much a burst of traffic can cost.
- The recipe cache lives in memory, so it resets when Cloud Run restarts. That's fine for v1.

**Zero-spend demo instead:** use `--set-env-vars MOCK_AI=1` and drop `--set-secrets`. Every link then returns the sample recipe.

**Count taps** (share / plan / done / skip):

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND textPayload:"EVENT type="' --limit 1000 --format='value(textPayload)' \
  | awk '{print $2}' | sort | uniq -c
```

---

## Part 2: Publish the app for Expo Go (about 5 minutes)

```bash
cd app
npm install

# 1. Sign in to Expo and create the project (writes the project ID into app.json)
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest update:configure
#    After this, app.json must still have  "runtimeVersion": { "policy": "sdkVersion" }.
#    That setting is what lets Expo Go open the update. If the command changed it, change it back.

# 2. Tell the app where the API is, and where the feedback form is
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://scrollpal-api-abc123-uc.a.run.app --visibility plaintext
npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_FEEDBACK_FORM_URL --value https://forms.gle/YOUR_FORM --visibility plaintext

# 3. Publish
npx eas-cli@latest update --branch preview --environment preview --message "ScrollPal v1"
```

The last command prints an **EAS Dashboard** link (`https://expo.dev/accounts/<you>/projects/scrollpal/updates/...`).
Open it, tap **Preview**, and you'll see a QR code. **That page is the link you send your friends.**

What friends do:
1. Install **Expo Go** (App Store / Play Store). It must be the current version (SDK 58).
2. Open your link and scan the QR code: with the Camera app on iPhone, or from inside Expo Go on Android.
3. ScrollPal opens. No Expo account needed to open a published update.

To ship a fix later, run the same `eas update` command again. Friends get it the next time they open the app.

---

## Run on your own phone first

Do this before sending the link to anyone. In `app/.env`, set `EXPO_PUBLIC_API_URL` to the Cloud Run URL. Then:

```bash
npx expo login      # iPhone + Expo Go needs your laptop and phone signed in to the same Expo account
npx expo start
```
