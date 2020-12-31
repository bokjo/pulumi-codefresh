import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

import * as cluster from "./gcp";
import { projectName } from "./config";

export const kubeconfig = pulumi.secret(cluster.kubeconfig);

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
const nginxLb = new k8s.core.v1.Service(`${projectName}-nginx-lb`, {
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
const nginxLbIngress = nginxLb.status.loadBalancer.ingress[0]
export const nginxLbIp = nginxLbIngress.apply(x => x.ip ?? x.hostname)

// Deploy the bitnami chart.
const chartName = "nginx"
const helmAppName = `${projectName}-website`
const helmApp = new k8s.helm.v3.Chart(helmAppName, {
    version: "8.2.3",
    chart: chartName,
    fetchOpts: {
        repo: "https://charts.bitnami.com/bitnami",
    },
    values: {
        cloneStaticSiteFromGit: {
            enabled: true,
            repository: "https://github.com/MitchellGerdisch/simple_static_website.git",
            branch: "main"
        }
    },
}, { parent: namespace});
const helmAppFrontend = helmApp.getResourceProperty("v1/Service", `${helmAppName}-${chartName}`, "status");
const helmAppIngress = helmAppFrontend.loadBalancer.ingress[0];
export const helmAppIp = helmAppIngress.apply(x => x.ip ?? x.hostname);

export const clusterName = cluster.k8sName
export const gcpProject = cluster.gcpProject
