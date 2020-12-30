#!/bin/bash 

CF_API_HOST="${CF_API_HOST:-https://g.codefresh.io}"

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

echo "Checking if cluster \"$K8S_NAME\" already exists..."
EXISTING_CLUSTER_ID=$(curl -s \
    -H "Authorization: $CF_API_KEY" \
    "$CF_API_HOST/api/clusters" | \
    jq -r ".[] | select(. | .selector == \"$K8S_NAME\") | ._id")

if [[ "$EXISTING_CLUSTER_ID" != "" ]]; then
    echo "Cluster already exists, deleting (id=$EXISTING_CLUSTER_ID)..."
    curl -s --fail -X DELETE \
    -H "Authorization: $CF_API_KEY" \
    "$CF_API_HOST/api/clusters/local/cluster/$EXISTING_CLUSTER_ID"
fi

echo "Adding new cluster \"$K8S_NAME\"..."
# curl -v \ #-s --fail \
#     -H "Authorization: $CF_API_KEY" \
#     -H "content-type: application/json;charset=UTF-8" \
#     -d \
#     "{
#         \"type\": \"sat\",
#         \"selector\": \"$K8S_NAME\",
#         \"host\": \"$K8S_HOST\",
#         \"clientCa\": \"$K8S_CA\",
#         \"serviceAccountToken\": \"$K8S_TOKEN\",
#         \"provider\": \"glcoud\",
#         \"providerAgent\": \"gcloud\"
#     }" \
#     "$CF_API_HOST/api/clusters/gcloud/cluster"

# This is based on what the UI sends to the API when adding a GCP cluster from the integrations page.
# Kinda kludgey but it does work.``
curl -v \ #-s --fail \
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

