import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

import * as cluster from "./gcp";
import { projectName } from "./config";

export const kubeconfig = cluster.kubeconfig //pulumi.secret(cluster.kubeconfig);

// Create a Kubernetes Namespace
const namespace = new k8s.core.v1.Namespace(projectName, {
    metadata: {
        name: projectName,
    }
}, { provider: cluster.k8sProvider });
export const namespaceName = namespace.metadata.name;

const configMap = new k8s.core.v1.ConfigMap(projectName, {
    metadata: {
        namespace: namespaceName,
    },
    data: { storageBucketName: cluster.storageBucketName },
}, { provider: cluster.k8sProvider });

/**
 * Create a NGINX Deployment using pulumi/k8s
 */
const appLabels = { appClass: projectName };
const deployment = new k8s.apps.v1.Deployment(projectName, {
    metadata: {
        namespace: namespaceName,
        labels: appLabels,
    },
    spec: {
        replicas: 1,
        selector: { matchLabels: appLabels },
        template: {
            metadata: {
                labels: appLabels,
            },
            spec: {
                containers: [{
                    name: projectName,
                    image: "nginx:1.18", // 1.18 -> 1.19
                    ports: [{ containerPort: 80, name: "http" }],
                    envFrom: [{ configMapRef: { name: configMap.metadata.apply(m => m.name) } }],
                }],
            },
        },
    },
}, { parent: namespace });

// Create a LoadBalancer Service for the NGINX Deployment
const service = new k8s.core.v1.Service(projectName, {
    metadata: {
        labels: appLabels,
        namespace: namespaceName,
    },
    spec: {
        type: "LoadBalancer",
        ports: [{ port: 80, targetPort: "http" }],
        selector: appLabels,
    },
}, { parent: deployment });

/**
 * Create a NGINX Deployment using Helm
 */
const nginxHelm = new k8s.helm.v3.Chart(`${projectName}-helm`, {
    namespace: namespaceName,
    fetchOpts: {
        repo: "https://charts.bitnami.com/bitnami",
    },
    chart: "nginx",
    version: "5.6.0", // 5.6.0 -> 5.7.0
    transformations: [ // Helm Chart: https://github.com/bitnami/charts/blob/master/bitnami/nginx/templates/deployment.yaml
        // (obj: any) => {
        //     if (obj.kind == "Deployment") {
        //         obj.spec.replicas = 2
        //     }
        // }
    ],
}, { parent: namespace });

export const k8sName = cluster.k8sName
export const k8sEndpoint = cluster.k8sEndpoint
export const k8sMasterAuth = cluster.k8sMasterAuth

// ci/cd test
