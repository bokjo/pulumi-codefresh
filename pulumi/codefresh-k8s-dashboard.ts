// Implements a basic, simple dynamic provider for adding/removing GKE clusters to/from the Codefresh Kubernetes dashboard.
// See: https://codefresh.io/docs/docs/deploy-to-kubernetes/manage-kubernetes/
//

import * as pulumi from "@pulumi/pulumi";
import { CreateResult } from "@pulumi/pulumi/dynamic";
import axios from 'axios';

let codefreshApiKey = "noToken"
export function setAuth(token: string) { 
    codefreshApiKey = token; 
}

export interface CodefreshK8sDashboardArgs {
    clusterName: pulumi.Input<string>;
    gcpProject: pulumi.Input<string>;
}

const codefreshApiUrl  = "https://g.codefresh.io/api"

const codefreshK8sDashboardProvider: pulumi.dynamic.ResourceProvider = {
    async create(inputs: CodefreshK8sDashboardArgs) {
        const clusterName = inputs.clusterName
        const gcpProject = inputs.gcpProject
        const gkeName =`${clusterName}@${gcpProject}`
        const url  = `${codefreshApiUrl}/clusters/gcloud/cluster`

        const headers =  {
            'Authorization': codefreshApiKey,
            'content-type': 'application/json;charset=UTF-8',
        }
        const data =  {
            project: {
                name: gcpProject,
                value: gcpProject,
                ticked: true
            },
            cluster: {
                name: clusterName,
                ticked: true
            },
            name: gkeName
        }
        const createResults = await axios.post(url, {
            selector: gkeName,
            provider: "gcloud",
            data: data
        }, {
            headers: headers
        })
        return { id: createResults.data._id.toString() };
    },
    async delete(id) {
        const deleteApiUrl = `${codefreshApiUrl}/clusters/local/cluster/${id}`
        const headers =  {
            'Authorization': codefreshApiKey
        }
        const deleteResults = await axios.delete(deleteApiUrl, 
            {
                headers: headers
            })
    },
}

export class CodefreshK8sDashboard extends pulumi.dynamic.Resource {
    constructor(name: string, args: CodefreshK8sDashboardArgs, opts?: pulumi.CustomResourceOptions) {
        super(codefreshK8sDashboardProvider, name, args, opts);
    }
}