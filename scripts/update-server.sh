#!/usr/bin/env bash
# Updates Pal's server that is ALREADY running on Google Cloud Run: new code, plus the live-tracker sheet connection.
# Keeps all your existing keys and settings. Run it in Google Cloud Shell, inside the scroll_pal folder:
#
#   git pull origin claude/gracious-keller-6lrp79
#   bash scripts/update-server.sh
#
# Optional: bash scripts/update-server.sh SHEET_ID   (to point at a different tracker sheet)
set -euo pipefail

SHEET_ID="${1:-1ZXnv2aLX2tc93qWDKJvOK97DOzEDR8v3fA6-RjUyaKU}"
REGION=us-central1
PROJECT="$(gcloud config get-value project 2>/dev/null)"
[ -n "$PROJECT" ] || { echo "No Google Cloud project is selected. Run: gcloud config set project YOUR_REAL_PROJECT_ID"; exit 1; }
echo "Project: $PROJECT"

echo "1/3  Turning on the Google Sheets services..."
gcloud services enable sheets.googleapis.com iamcredentials.googleapis.com

echo "2/3  Letting the server write to the tracker sheet..."
PN=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
RUNSA="${PN}-compute@developer.gserviceaccount.com"
gcloud iam service-accounts add-iam-policy-binding "$RUNSA" \
  --member "serviceAccount:$RUNSA" --role roles/iam.serviceAccountTokenCreator --condition=None >/dev/null
echo "     The tracker sheet must be shared (Editor) with: $RUNSA"

echo "3/3  Deploying the new server (3 to 5 minutes)..."
gcloud run deploy scrollpal-api \
  --source api \
  --region "$REGION" \
  --allow-unauthenticated \
  --update-env-vars "SHEET_ID=$SHEET_ID" \
  --quiet

URL=$(gcloud run services describe scrollpal-api --region "$REGION" --format 'value(status.url)')
echo
curl -fsS "$URL/health" && echo
echo "=============================================="
echo " Server updated: $URL"
echo " Tracker:        https://docs.google.com/spreadsheets/d/$SHEET_ID"
echo "=============================================="
