#!/bin/bash 

CF_API_HOST="${CF_API_HOST:-https://g.codefresh.io}"

JQ="/usr/bin/jq"

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
    $JQ -r ".[] | select(. | .selector == \"$K8S_NAME\") | ._id")

if [[ "$EXISTING_CLUSTER_ID" != "" ]]; then
    echo "Cluster already exists, deleting (id=$EXISTING_CLUSTER_ID)..."
    curl -s --fail -X DELETE \
    -H "Authorization: $CF_API_KEY" \
    "$CF_API_HOST/api/clusters/local/cluster/$EXISTING_CLUSTER_ID"
fi

echo