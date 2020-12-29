import * as gcp from "@pulumi/gcp";
import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";
import * as pulumi from "@pulumi/pulumi";
import { baseTags, projectName, stackName, } from "./config";

/**
 * Storage resource to mix in with k8s resources
 */
const bucket = new gcp.storage.Bucket(projectName);
export const storageBucketName = bucket.name;

/**
 * Kubernetes cluster resources
 */
const lastestMasterVersion = gcp.container.getEngineVersions();
const username = "gcloud-admin";
const password = new random.RandomPassword(projectName, { length: 16 }).result;

const k8sCluster = new gcp.container.Cluster(projectName, {
  initialNodeCount: 1,
  nodeVersion: lastestMasterVersion.then(it => it.latestNodeVersion),
  minMasterVersion: lastestMasterVersion.then(it => it.latestMasterVersion),
  masterAuth: { username, password },
  nodeConfig: {
    machineType: "n1-standard-1",
    oauthScopes: [
      "https://www.googleapis.com/auth/compute",
      "https://www.googleapis.com/auth/devstorage.read_only",
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring",
    ],
  },
  resourceLabels: {
    ...baseTags
  },
});

// Manufacture a GKE-style Kubeconfig. Note that this is slightly "different" because of the way GKE requires
// gcloud to be in the picture for cluster authentication (rather than using the client cert/key directly).
export const kubeconfig = pulumi.
  all([k8sCluster.name, k8sCluster.endpoint, k8sCluster.masterAuth]).
  apply(([name, endpoint, auth]) => {
    const context = `${gcp.config.project}_${gcp.config.zone}_${name}`;
    return `apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ${auth.clusterCaCertificate}
    server: https://${endpoint}
  name: ${context}
contexts:
- context:
    cluster: ${context}
    user: ${context}
  name: ${context}
current-context: ${context}
kind: Config
preferences: {}
users:
- name: ${context}
  user:
    auth-provider:
      config:
        cmd-args: config config-helper --format=json
        cmd-path: gcloud
        expiry-key: '{.credential.token_expiry}'
        token-key: '{.credential.access_token}'
      name: gcp
`;
  });

// Export a Kubernetes provider instance that uses our cluster from above.
export const k8sProvider = new k8s.Provider(projectName, {
  kubeconfig: kubeconfig,
}, { parent: k8sCluster });