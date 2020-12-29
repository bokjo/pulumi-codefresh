import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();

export const projectName = pulumi.getProject();
export const stackName = pulumi.getStack();

export const baseTags = {
    "cost-center": projectName,
    "stack": stackName,
};
