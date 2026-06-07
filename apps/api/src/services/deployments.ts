import crypto from "crypto";
import { DeploymentStatus, type Deployment, type Project } from "@prisma/client";
import { db } from "../db.js";
import { buildQueue } from "../queue.js";

export async function createProjectDeployment(projectId: string, commitSha: string, branch: string, source = "push") {
  return db.$transaction(async (tx) => {
    const deployment = await tx.deployment.create({
      data: {
        projectId,
        commitSha,
        branch,
        source,
        status: DeploymentStatus.pending
      }
    });

    await buildQueue.add("build-project", {
      deploymentId: deployment.id
    });

    return deployment;
  });
}

export async function createProjectForUser(args: {
  userId: string;
  githubRepoId: string;
  githubRepoFullName: string;
  githubRepoName: string;
  githubDefaultBranch: string;
  buildCommand: string;
  outputDir: string;
  subdomain?: string;
}) {
  return db.project.create({
    data: {
      userId: args.userId,
      githubRepoId: args.githubRepoId,
      githubRepoFullName: args.githubRepoFullName,
      githubRepoName: args.githubRepoName,
      githubDefaultBranch: args.githubDefaultBranch,
      buildCommand: args.buildCommand,
      outputDir: args.outputDir,
      subdomain: args.subdomain || createSubdomain(args.githubRepoName),
      webhookSecret: crypto.randomBytes(32).toString("hex")
    }
  });
}

export function createSubdomain(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || `project-${crypto.randomBytes(3).toString("hex")}`;
}

export async function appendDeploymentLog(deploymentId: string, chunk: string) {
  const current = await db.deployment.findUnique({
    where: { id: deploymentId },
    select: { logs: true }
  });

  if (!current) {
    return;
  }

  await db.deployment.update({
    where: { id: deploymentId },
    data: { logs: current.logs + chunk }
  });
}

export async function setDeploymentLogs(deploymentId: string, logs: string, status?: DeploymentStatus, extra: Partial<Deployment> = {}) {
  await db.deployment.update({
    where: { id: deploymentId },
    data: {
      logs,
      ...(status ? { status } : {}),
      ...extra
    }
  });
}

export async function finalizeDeploymentReady(deployment: Deployment, artifactPath: string) {
  await db.$transaction(async (tx) => {
    await tx.deployment.update({
      where: { id: deployment.id },
      data: {
        status: DeploymentStatus.ready,
        finishedAt: new Date(),
        artifactPath
      }
    });

    await tx.project.update({
      where: { id: deployment.projectId },
      data: { latestSuccessfulDeploymentId: deployment.id }
    });
  });
}

export async function finalizeDeploymentFailed(deploymentId: string, errorMessage: string) {
  await db.deployment.update({
    where: { id: deploymentId },
    data: {
      status: DeploymentStatus.failed,
      finishedAt: new Date(),
      errorMessage
    }
  });
}

export async function getDeploymentWithProject(deploymentId: string) {
  return db.deployment.findUnique({
    where: { id: deploymentId },
    include: { project: { include: { user: true, customDomains: true } } }
  });
}
