import type { DeploymentStatus } from "@prisma/client";

export type JwtSession = {
  userId: string;
};

export type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
};

export type DeploymentJob = {
  deploymentId: string;
};

export type CreateProjectInput = {
  githubRepoId: string;
  githubRepoFullName: string;
  githubRepoName: string;
  githubDefaultBranch: string;
  buildCommand: string;
  outputDir: string;
  subdomain?: string;
};

export type DeploymentSnapshot = {
  id: string;
  status: DeploymentStatus;
  logs: string;
};

