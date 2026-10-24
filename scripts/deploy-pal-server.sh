#!/usr/bin/env bash
# Deploys Pal's server (pal-server/) to Google Cloud Run as the service "pal-server". Run it in Google Cloud Shell:
#
#   git clone https://github.com/man-in-finance-65/scroll_pal && cd scroll_pal   (first time only)
#   git fetch origin claude/relaxed-hypatia-vwaro9 && git checkout claude/relaxed-hypatia-vwaro9 && git pull
#   bash scripts/deploy-pal-server.sh
#
# First run: asks for your keys (typing is hidden), stores them in Google Secret Manager, makes the app password.
# Later runs: press Enter at each question to keep what is stored, and it just ships the new code.
set -euo pipefail

PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
[ -n "$PROJECT" ] || { echo "No Google Cloud project selected. Run: gcloud config set project YOUR_PROJECT_ID"; exit 1; }
REGION=us-central1
echo "Project: $PROJECT"

echo "1/4  Turning on the Google Cloud services Pal needs..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com >/dev/null

has_secret() { gcloud secrets describe "$1" >/dev/null 2>&1; }
put_secret() { # name value
  if has_secret "$1"; then printf %s "$2" | gcloud secrets versions add "$1" --data-file=- >/dev/null
  else printf %s "$2" | gcloud secrets create "$1" --data-file=- >/dev/null; fi
}
ask_secret() { # secret-name "question"
  local v=""
  if has_secret "$1"; then
    read -r -s -p "$2 (already saved: press Enter to keep it): " v; echo
  else
    while [ -z "$v" ]; do read -r -s -p "$2: " v; echo; done
  fi
  if [ -n "$v" ]; then put_secret "$1" "$v"; fi
}

echo
echo "2/4  Your keys. Typing is hidden and nothing is shown or saved on this computer."
ask_secret pal-anthropic-key "Anthropic key (starts with sk-ant-)"
ask_secret pal-openai-key "OpenAI key (starts with sk-)"
ask_secret pal-usda-key "USDA FoodData Central key"
if ! has_secret pal-app-secret; then
  put_secret pal-app-secret "$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)"
  echo "Made a new app password (pal-app-secret)."
fi

echo
echo "3/4  Letting Cloud Run read the keys..."
PN=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
RUNSA="${PN}-compute@developer.gserviceaccount.com"
for ROLE in roles/secretmanager.secretAccessor roles/cloudbuild.builds.builder roles/logging.logWriter roles/artifactregistry.writer roles/storage.objectViewer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$RUNSA" --role "$ROLE" --condition=None >/dev/null
done

echo
echo "4/4  Building and deploying (4 to 6 minutes the first time)..."
gcloud run deploy pal-server \
  --source pal-server \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-secrets "ANTHROPIC_API_KEY=pal-anthropic-key:latest,OPENAI_API_KEY=pal-openai-key:latest,USDA_API_KEY=pal-usda-key:latest,APP_SECRET=pal-app-secret:latest" \
  --memory 1Gi \
  --timeout 300 \
  --max-instances 2 \
  --quiet

URL=$(gcloud run services describe pal-server --region "$REGION" --format 'value(status.url)')
echo
curl -fsS "$URL/health" && echo
echo "=============================================="
echo " Pal's server is live: $URL"
echo " App password: $(gcloud secrets versions access latest --secret pal-app-secret)"
echo " Send Claude these two lines. They are not your API keys: the app password"
echo " only lets the Pal app talk to this server. Never send your API keys."
echo "=============================================="
