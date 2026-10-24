#!/usr/bin/env bash
# One-time: lets GitHub deploy Pal's server and publish the Pal app by itself whenever Claude pushes a change.
# Run it in Google Cloud Shell, inside the scroll_pal folder:   bash scripts/connect-github.sh
# It signs you in to GitHub (browser code), makes a Google "robot account" that may only deploy, and stores
# its key plus the app password as GitHub secrets. Nothing secret is printed.
set -euo pipefail
REPO=man-in-finance-65/scroll_pal
REGION=us-central1
PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
[ -n "$PROJECT" ] || { echo "No Google Cloud project selected. Run: gcloud config set project muse-x-scroll-pal-youtube"; exit 1; }
echo "Project: $PROJECT"

echo "1/4  GitHub sign-in..."
gh auth status >/dev/null 2>&1 || gh auth login --hostname github.com --git-protocol https --web

echo "2/4  Making the deploy robot account (pal-deployer)..."
SA="pal-deployer@$PROJECT.iam.gserviceaccount.com"
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 || gcloud iam service-accounts create pal-deployer --display-name "Pal GitHub deployer" >/dev/null
for ROLE in roles/run.admin roles/cloudbuild.builds.editor roles/artifactregistry.writer roles/storage.admin roles/iam.serviceAccountUser roles/serviceusage.serviceUsageConsumer roles/viewer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA" --role "$ROLE" --condition=None >/dev/null
done

echo "3/4  Storing secrets in GitHub (not shown)..."
KEYFILE="$(mktemp)"
gcloud iam service-accounts keys create "$KEYFILE" --iam-account "$SA" >/dev/null 2>&1
gh secret set GCP_SA_KEY --repo "$REPO" < "$KEYFILE"
rm -f "$KEYFILE"
gh secret set GCP_PROJECT_ID --repo "$REPO" --body "$PROJECT"
gcloud secrets versions access latest --secret pal-app-secret | gh secret set PAL_APP_SECRET --repo "$REPO"
URL=$(gcloud run services describe pal-server --region "$REGION" --format 'value(status.url)')
gh variable set PAL_API_URL --repo "$REPO" --body "$URL"

echo "4/4  Shipping the latest server code once..."
gcloud run deploy pal-server --source pal-server --region "$REGION" --quiet >/dev/null 2>&1
curl -fsS "$URL/health" && echo
echo "=============================================="
echo " Connected. GitHub can now deploy Pal by itself."
echo " Tell Claude: done"
echo "=============================================="
