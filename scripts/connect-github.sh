#!/usr/bin/env bash
# One-time: lets GitHub deploy Pal's server and publish the Pal app by itself whenever Claude pushes a change.
# Run it in Google Cloud Shell, inside the scroll_pal folder:   bash scripts/connect-github.sh
# It signs you in to GitHub (browser code), makes a Google "robot account" that may only deploy, and lets
# GitHub Actions in this repository (and only this one) act as it, with no key file. Nothing secret is printed.
set -euo pipefail
trap 'echo; echo "STOPPED at line $LINENO. Copy the lines above and send them to Claude."' ERR
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

echo "3/4  Letting GitHub act as that account, for this repository only (no key file)..."
PN=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com >/dev/null
gcloud iam workload-identity-pools describe github --location=global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create github --location=global --display-name="GitHub"
gcloud iam workload-identity-pools providers describe github --location=global --workload-identity-pool=github >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc github --location=global --workload-identity-pool=github \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository=='$REPO'"
gcloud iam service-accounts add-iam-policy-binding "$SA" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PN/locations/global/workloadIdentityPools/github/attribute.repository/$REPO" >/dev/null

echo "     Storing settings in GitHub (the app password is not shown)..."
gh variable set GCP_WIF_PROVIDER --repo "$REPO" --body "projects/$PN/locations/global/workloadIdentityPools/github/providers/github"
gh variable set GCP_SA_EMAIL --repo "$REPO" --body "$SA"
gh variable set GCP_PROJECT_ID --repo "$REPO" --body "$PROJECT"
gcloud secrets versions access latest --secret pal-app-secret | gh secret set PAL_APP_SECRET --repo "$REPO"
URL=$(gcloud run services describe pal-server --region "$REGION" --format 'value(status.url)')
gh variable set PAL_API_URL --repo "$REPO" --body "$URL"

echo "4/4  Shipping the latest server code once (about 3 minutes)..."
gcloud run deploy pal-server --source pal-server --region "$REGION" --quiet
curl -fsS "$URL/health" && echo
echo "=============================================="
echo " Connected. GitHub can now deploy Pal by itself."
echo " Tell Claude: done"
echo "=============================================="
