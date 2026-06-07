import { DeploymentStatus } from "@prisma/client";
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { createBuildWorker } from "./queue.js";
import { db } from "./db.js";
import { env } from "./env.js";
import { putObjectToR2 } from "./services/r2.js";
import { appendDeploymentLog, finalizeDeploymentFailed, finalizeDeploymentReady } from "./services/deployments.js";
import { syncDeploymentMappings } from "./services/edge.js";
import { fetchRepositoryByFullName, getUserAccessToken } from "./services/github.js";

async function appendLog(deploymentId: string, text: string) {
  await appendDeploymentLog(deploymentId, text);
}

function runCommand(command: string, args: string[], cwd: string, envVars: NodeJS.ProcessEnv = {}) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...envVars },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk) => {
      void appendLog(envVars.DEPLOYMENT_ID!, chunk.toString());
    });
    child.stderr.on("data", (chunk) => {
      void appendLog(envVars.DEPLOYMENT_ID!, chunk.toString());
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(0);
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

function runShellCommand(command: string, cwd: string, envVars: NodeJS.ProcessEnv = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      env: { ...process.env, ...envVars },
      shell: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk) => {
      void appendLog(envVars.DEPLOYMENT_ID!, chunk.toString());
    });
    child.stderr.on("data", (chunk) => {
      void appendLog(envVars.DEPLOYMENT_ID!, chunk.toString());
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Build command failed with exit code ${code}`));
      }
    });
  });
}

async function copyDirectory(source: string, target: string) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

async function createGitAskPassScript(dir: string, token: string) {
  const isWindows = process.platform === "win32";
  const scriptPath = path.join(dir, isWindows ? "git-askpass.cmd" : "git-askpass.sh");
  const safeToken = token.replace(/'/g, "'\\''");
  const script = isWindows
    ? `@echo off\r\nsetlocal enabledelayedexpansion\r\nset prompt=%~1\r\necho !prompt! | findstr /I "Username" >nul\r\nif not errorlevel 1 (\r\necho x-access-token\r\nexit /b 0\r\n)\r\necho ${token}\r\n`
    : `#!/usr/bin/env sh
case "$1" in
  *Username*) printf '%s' 'x-access-token' ;;
  *) printf '%s' '${safeToken}' ;;
esac
`;
  await fs.writeFile(scriptPath, script, { mode: 0o700 });
  return scriptPath;
}

async function listFilesRecursive(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function uploadDirectoryToR2(deploymentId: string, outputDir: string) {
  const files = await listFilesRecursive(outputDir);
  for (const filePath of files) {
    const relative = path.relative(outputDir, filePath).split(path.sep).join("/");
    const key = `deployments/${deploymentId}/${relative}`;
    const body = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ext === ".html"
        ? "text/html; charset=utf-8"
        : ext === ".js"
          ? "text/javascript; charset=utf-8"
          : ext === ".css"
            ? "text/css; charset=utf-8"
            : ext === ".json"
              ? "application/json; charset=utf-8"
              : ext === ".svg"
                ? "image/svg+xml"
                : ext === ".png"
                  ? "image/png"
                  : ext === ".jpg" || ext === ".jpeg"
                    ? "image/jpeg"
                    : ext === ".webp"
                      ? "image/webp"
                      : "application/octet-stream";

    await putObjectToR2(key, body, contentType);
  }
}

async function syncEdge(deployment: any) {
  await syncDeploymentMappings(deployment.project.id, deployment.id);
}

createBuildWorker(async (job) => {
  const deploymentId = job.data.deploymentId as string;
  const deployment = await db.deployment.findUnique({
    where: { id: deploymentId },
    include: { project: { include: { user: true, customDomains: true } } }
  });

  if (!deployment) {
    throw new Error(`Deployment ${deploymentId} not found`);
  }

  const project = deployment.project;
  const accessToken = project.user.githubAccessToken;
  await fetchRepositoryByFullName(accessToken, project.githubRepoFullName);

  await db.deployment.update({
    where: { id: deployment.id },
    data: {
      status: DeploymentStatus.building,
      startedAt: new Date(),
      logs: ""
    }
  });

  const buildRoot = path.resolve(env.BUILDER_SANDBOX_ROOT);
  await fs.mkdir(buildRoot, { recursive: true });
  const tempDir = await fs.mkdtemp(path.join(buildRoot, `${deployment.id}-`));
  const repoDir = path.join(tempDir, "repo");
  const outputDir = path.join(tempDir, "output");
  const askPassScript = await createGitAskPassScript(tempDir, accessToken);

  try {
    await appendLog(deployment.id, `Cloning ${project.githubRepoFullName} on branch ${deployment.branch}\n`);
    await runCommand(env.BUILDER_GIT_BIN, ["clone", "--depth", "1", "--branch", deployment.branch, `https://github.com/${project.githubRepoFullName}.git`, repoDir], tempDir, {
      DEPLOYMENT_ID: deployment.id,
      GIT_TERMINAL_PROMPT: "0",
      GIT_ASKPASS: askPassScript
    });

    await appendLog(deployment.id, "Installing dependencies...\n");
    await runCommand(env.BUILDER_NPM_BIN, ["install"], repoDir, { DEPLOYMENT_ID: deployment.id });

    await appendLog(deployment.id, `Running build command: ${project.buildCommand}\n`);
    await runShellCommand(project.buildCommand, repoDir, {
      DEPLOYMENT_ID: deployment.id,
      CI: "true"
    });

    const compiledOutput = path.join(repoDir, project.outputDir);
    const exists = await fs
      .stat(compiledOutput)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      throw new Error(`Output directory not found: ${project.outputDir}`);
    }

    await copyDirectory(compiledOutput, outputDir);
    await appendLog(deployment.id, "Uploading files to R2...\n");
    await uploadDirectoryToR2(deployment.id, outputDir);

    const artifactPath = `deployments/${deployment.id}/`;
    await finalizeDeploymentReady(deployment, artifactPath);
    await syncEdge(deployment);
    await appendLog(deployment.id, "Deployment ready.\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Build failed";
    await appendLog(deployment.id, `\n${message}\n`);
    await finalizeDeploymentFailed(deployment.id, message);
    throw error;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
