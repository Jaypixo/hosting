import crypto from "crypto";
import { Router } from "express";
import { DeploymentStatus } from "@prisma/client";
import { env } from "../env.js";
import { db } from "../db.js";
import { buildQueue } from "../queue.js";

const router = Router();

function verifySignature(rawBody: string, signatureHeader: string | undefined, secret: string) {
  if (!signatureHeader) {
    return false;
  }

  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const expected = `sha256=${digest}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post("/github", async (req, res, next) => {
  try {
    const event = req.header("x-github-event");
    const signature = req.header("x-hub-signature-256");
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : typeof req.body === "string" ? req.body : JSON.stringify(req.body);

    if (event !== "push") {
      return res.status(200).json({ ignored: true });
    }

    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const repoFullName = payload?.repository?.full_name as string | undefined;
    const branch = (payload?.ref as string | undefined)?.replace("refs/heads/", "") || "main";
    const commitSha = payload?.after as string | undefined;

    if (!repoFullName || !commitSha) {
      return res.status(400).json({ error: "Missing repository or commit SHA" });
    }

    const project = await db.project.findUnique({
      where: { githubRepoFullName: repoFullName }
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const isValid = verifySignature(rawBody, signature, project.webhookSecret || env.GITHUB_WEBHOOK_SECRET);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const deployment = await db.deployment.create({
      data: {
        projectId: project.id,
        commitSha,
        branch,
        source: "webhook",
        status: DeploymentStatus.pending
      }
    });
    await buildQueue.add("build-project", { deploymentId: deployment.id });

    res.status(202).json({ deploymentId: deployment.id });
  } catch (error) {
    next(error);
  }
});

export default router;
