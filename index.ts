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

// Deploy the bitnami/wordpress chart.
const wpName = `${projectName}-wp`
const wordpress = new k8s.helm.v3.Chart(wpName, {
    version: "9.6.0",
    chart: "wordpress",
    fetchOpts: {
        repo: "https://charts.bitnami.com/bitnami",
    },
}, { parent: namespace});

// Get the status field from the wordpress service, and then grab a reference to the ingress field.
const wpFrontend = wordpress.getResourceProperty("v1/Service", `${wpName}-wordpress`, "status");
const wpIngress = wpFrontend.loadBalancer.ingress[0];

export const clusterName = cluster.k8sName
export const gcpProject = cluster.gcpProject
// Export the public IPs for the simple Nginx LB and for the WP site
export const nginxLbIp = nginxLbIngress.apply(x => x.ip ?? x.hostname)
export const wpIp = wpIngress.apply(x => x.ip ?? x.hostname);