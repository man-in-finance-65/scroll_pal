#!/usr/bin/env bash
# One-time Google Cloud setup so GitHub can deploy the API for you.
# Run it in Google Cloud Shell (https://shell.cloud.google.com) or any terminal with `gcloud` signed in.
#   bash scripts/gcp-setup.sh YOUR_PROJECT_ID
# At the end it prints the service-account key. Paste it into the GitHub secret GCP_SA_KEY, then delete the local file.
set -euo pipefail
PROJECT="${1:?Usage: bash scripts/gcp-setup.sh YOUR_PROJECT_ID}"
SA="scrollpal-deployer"
EMAIL="$SA@$PROJECT.iam.gserviceaccount.com"

gcloud config set project "$PROJECT"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud iam service-accounts describe "$EMAIL" >/dev/null 2>&1 || gcloud iam service-accounts create "$SA" --display-name "ScrollPal deployer"
for ROLE in roles/run.admin roles/cloudbuild.builds.editor roles/artifactregistry.writer roles/storage.admin roles/iam.serviceAccountUser roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$EMAIL" --role "$ROLE" --condition=None >/dev/null
done
gcloud iam service-accounts keys create scrollpal-deployer-key.json --iam-account "$EMAIL"

echo
echo "Done. Now, in GitHub -> repo Settings -> Secrets and variables -> Actions:"
echo "  New secret  GCP_PROJECT_ID = $PROJECT"
echo "  New secret  GCP_SA_KEY     = (the whole contents of scrollpal-deployer-key.json, printed below)"
echo "Then delete the key file:  rm scrollpal-deployer-key.json"
echo "---------------- key ----------------"
cat scrollpal-deployer-key.json
