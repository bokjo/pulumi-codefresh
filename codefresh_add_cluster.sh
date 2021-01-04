#!/bin/bash 

CF_API_HOST="${CF_API_HOST:-https://g.codefresh.io}"

echo "CF_API_HOST: $CF_API_HOST"

REQUIRED_ENV_VARS=(
    "CF_API_KEY"
    "GKE_CLUSTER_NAME"
    "GCP_PROJECT"
)

K8S_NAME="${GKE_CLUSTER_NAME}@${GCP_PROJECT}"

for VAR in ${REQUIRED_ENV_VARS[@]}; do
    if [ "${!VAR}" == "" ]; then
        echo "Env missing ${VAR}"
        echo "Must have: ${REQUIRED_ENV_VARS[@]}"
        exit 1
    fi
done

# Check if cluster already exists and delete if so
./codefresh_remove_cluster.sh

echo "Adding new cluster \"$K8S_NAME\"..."
# This is based on what the UI sends to the API when adding a GCP cluster from the integrations page.
curl -s --fail \
    -H "Authorization: $CF_API_KEY" \
    -H "content-type: application/json;charset=UTF-8" \
    -d \
"{
  \"selector\": \"${K8S_NAME}\",
  \"provider\": \"gcloud\",
  \"data\": {
    \"project\": {
      \"name\": \"${GCP_PROJECT}\",
      \"value\": \"${GCP_PROJECT}\",
      \"ticked\": true
    },
    \"cluster\": {
      \"name\": \"${GKE_CLUSTER_NAME}\",
      \"ticked\": true
    },
    \"name\": \"${K8S_NAME}\"
  }
}" \
    "$CF_API_HOST/api/clusters/gcloud/cluster"
echo

