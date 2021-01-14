import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

import * as cluster from "./gcp";
import { projectName, codefreshApiKey } from "./config";
import { setAuth, CodefreshGke } from "./codefresh-dashboard-gke"

// Instantiate a GKE cluster and 
// "secrefy" the kubeconfig data from the cluster so it is not seen in local outputs or in the console.
export const kubeconfig = pulumi.secret(cluster.kubeconfig);

// Create a Kubernetes Namespace using Pulumi's native k8s provider.
const namespace = new k8s.core.v1.Namespace(projectName, {
    metadata: {
        name: projectName,
    }
}, { provider: cluster.k8sProvider });
export const namespaceName = namespace.metadata.name;

// Create configmap
const configMap = new k8s.core.v1.ConfigMap(projectName, {
    metadata: {
        namespace: namespaceName,
    },
    data: { storageBucketName: cluster.storageBucketName },
}, { provider: cluster.k8sProvider });

 // Create a NGINX Deployment using pulumi/k8s provider
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
                    image: "nginx:1.18", // other versions to try 1.18 -> 1.19
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
// Get and output the link to this deployment.
const nginxLbIngress = nginxLb.status.loadBalancer.ingress[0]
const nginxLbIp = nginxLbIngress.apply(x => x.ip ?? x.hostname)
export const nginxLbUrl = pulumi.interpolate`http://${nginxLbIp}`

// Use Pulumi's native k8s/helm provider to deploy a Helm chart for an nginx website.
const chartName = "nginx"
const helmAppName = `${projectName}-website`
const helmApp = new k8s.helm.v3.Chart(helmAppName, {
    chart: chartName,
    version: "8.2.3",
    namespace: namespaceName,
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
// Create and output the URL for the chart-based website.
const helmResourceName = pulumi.interpolate`${namespaceName}/${helmAppName}-${chartName}`
const helmAppFrontend = helmResourceName.apply(name => helmApp.getResourceProperty("v1/Service", name, "status"))
const helmAppIngress = helmAppFrontend.loadBalancer.ingress[0];
const helmAppIp = helmAppIngress.apply(x => x.ip ?? x.hostname)
export const helmAppUrl = pulumi.interpolate`http://${helmAppIp}`

// Output the cluster name and related GCP project
export const clusterName = cluster.k8sName
export const gcpProject = pulumi.interpolate`${cluster.gcpProject}` 

// Create Codefresh K8s dashboard for the GKE cluster.
/*
const auth = codefreshApiKey.apply(key => setAuth(key))
const codefreshGkeDashboard = new CodefreshGke('gke-cf-dash', {
    clusterName: clusterName,
    gcpProject: gcpProject,
})
*/
