#!/usr/bin/env bash
# Deploys Pal's server + landing page to Google Cloud Run. Run it in Google Cloud Shell (https://shell.cloud.google.com).
#
#   git clone https://github.com/man-in-finance-65/scroll_pal && cd scroll_pal
#   git checkout claude/gracious-keller-6lrp79
#   bash scripts/deploy-cloud-shell.sh YOUR_PROJECT_ID
#
# It asks for your keys (typed hidden, never shown or saved in a file), stores them in Google's Secret Manager,
# deploys, and prints the address. Give that address to Claude (or run the GitHub "Publish app to Expo Go" workflow with it).
set -euo pipefail

PROJECT="${1:-$(gcloud config get-value project 2>/dev/null || true)}"
if [ -z "$PROJECT" ]; then echo "Usage: bash scripts/deploy-cloud-shell.sh YOUR_PROJECT_ID"; exit 1; fi
gcloud config set project "$PROJECT" >/dev/null
REGION=us-central1
if gcloud run services describe scrollpal-api --region "$REGION" >/dev/null 2>&1; then
  echo "scrollpal-api is already deployed in $PROJECT. To update it (keeps your keys), run instead:"
  echo "    bash scripts/update-server.sh"
  exit 0
fi

echo "1/4  Turning on the Google Cloud services Pal needs (about a minute)..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com sheets.googleapis.com iamcredentials.googleapis.com

put_secret() { # name value
  if gcloud secrets describe "$1" >/dev/null 2>&1; then printf %s "$2" | gcloud secrets versions add "$1" --data-file=- >/dev/null
  else printf %s "$2" | gcloud secrets create "$1" --data-file=- >/dev/null; fi
}

echo
echo "2/4  Your keys. Typing is hidden. Press Enter to skip the optional ones."
read -r -s -p "Gemini key (needed, reads the videos): " GEMINI; echo
[ -n "$GEMINI" ] || { echo "The Gemini key is required."; exit 1; }
read -r -s -p "Anthropic key (optional, smarter meal plans): " ANTHROPIC; echo
read -r    -p "Live-tracker Google Sheet ID (optional, press Enter to use the default one): " SHEET_ID_IN
SHEET_ID="${SHEET_ID_IN:-1ZXnv2aLX2tc93qWDKJvOK97DOzEDR8v3fA6-RjUyaKU}"

SECRETS="GEMINI_API_KEY=pal-gemini-key:latest"
put_secret pal-gemini-key "$GEMINI"
if [ -n "$ANTHROPIC" ]; then put_secret pal-anthropic-key "$ANTHROPIC"; SECRETS="$SECRETS,ANTHROPIC_API_KEY=pal-anthropic-key:latest"; fi
ENVVARS="MOCK_AI=0,SHEET_ID=$SHEET_ID"
unset GEMINI ANTHROPIC

echo
echo "3/4  Letting Cloud Run read the keys and build the app..."
PN=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
RUNSA="${PN}-compute@developer.gserviceaccount.com"
gcloud iam service-accounts add-iam-policy-binding "$RUNSA" --member "serviceAccount:$RUNSA" --role roles/iam.serviceAccountTokenCreator --condition=None >/dev/null
for ROLE in roles/secretmanager.secretAccessor roles/cloudbuild.builds.builder roles/logging.logWriter roles/artifactregistry.writer roles/storage.objectViewer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$RUNSA" --role "$ROLE" --condition=None >/dev/null
done

echo
echo "4/4  Deploying (3 to 5 minutes the first time)..."
gcloud run deploy scrollpal-api \
  --source api \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-secrets "$SECRETS" \
  --set-env-vars "$ENVVARS" \
  --timeout 120 \
  --max-instances 2 \
  --quiet

URL=$(gcloud run services describe scrollpal-api --region "$REGION" --format 'value(status.url)')
echo
echo "Checking it is alive..."
curl -fsS "$URL/health" && echo
echo
echo "=============================================="
echo " Pal's server + landing page:  $URL"
echo "=============================================="
echo "Send that address to Claude, or paste it into GitHub -> Actions -> 'Publish app to Expo Go' -> Run workflow."
