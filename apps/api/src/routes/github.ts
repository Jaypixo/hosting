import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware.js";
import { getUserAccessToken, listAccessibleRepositories } from "../services/github.js";
import { db } from "../db.js";
import { createProjectForUser } from "../services/deployments.js";

const router = Router();

router.get("/repos", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const accessToken = await getUserAccessToken(req.userId!);
    const repos = await listAccessibleRepositories(accessToken);
    res.json({ repos });
  } catch (error) {
    next(error);
  }
});

router.post("/projects", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { githubRepoId, githubRepoFullName, githubRepoName, githubDefaultBranch, buildCommand, outputDir, subdomain } = req.body as {
      githubRepoId: string;
      githubRepoFullName: string;
      githubRepoName: string;
      githubDefaultBranch: string;
      buildCommand?: string;
      outputDir?: string;
      subdomain?: string;
    };

    if (!githubRepoId || !githubRepoFullName || !githubRepoName || !githubDefaultBranch) {
      return res.status(400).json({ error: "Missing project fields" });
    }

    const project = await createProjectForUser({
      userId: req.userId!,
      githubRepoId,
      githubRepoFullName,
      githubRepoName,
      githubDefaultBranch,
      buildCommand: buildCommand || "npm run build",
      outputDir: outputDir || "dist",
      subdomain
    });

    res.status(201).json({ project });
  } catch (error) {
    next(error);
  }
});

router.get("/projects", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const projects = await db.project.findMany({
      where: { userId: req.userId! },
      include: { deployments: { orderBy: { createdAt: "desc" }, take: 10 }, customDomains: true }
    });

    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

router.patch("/projects/:id", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { buildCommand, outputDir, subdomain, githubDefaultBranch } = req.body as Partial<{
      buildCommand: string;
      outputDir: string;
      subdomain: string;
      githubDefaultBranch: string;
    }>;

    const existing = await db.project.findFirst({
      where: { id, userId: req.userId! }
    });

    if (!existing) {
      return res.status(404).json({ error: "Project not found" });
    }

    const project = await db.project.update({
      where: { id },
      data: {
        ...(buildCommand ? { buildCommand } : {}),
        ...(outputDir ? { outputDir } : {}),
        ...(subdomain ? { subdomain } : {}),
        ...(githubDefaultBranch ? { githubDefaultBranch } : {})
      }
    });

    res.json({ project });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:id/deploy", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const project = await db.project.findFirst({
      where: { id: projectId, userId: req.userId! }
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const { createProjectDeployment } = await import("../services/deployments.js");
    const deployment = await createProjectDeployment(project.id, req.body.commitSha || "manual", project.githubDefaultBranch, "manual");
    res.status(201).json({ deployment });
  } catch (error) {
    next(error);
  }
});

export default router;
