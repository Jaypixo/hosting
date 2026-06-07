import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware.js";
import { db } from "../db.js";

const router = Router();

router.get("/:id", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const deploymentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deployment = await db.deployment.findFirst({
      where: {
        id: deploymentId,
        project: { userId: req.userId! }
      },
      include: { project: true }
    });

    if (!deployment) {
      return res.status(404).json({ error: "Deployment not found" });
    }

    res.json({ deployment });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/logs", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const deploymentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deployment = await db.deployment.findFirst({
      where: {
        id: deploymentId,
        project: { userId: req.userId! }
      }
    });

    if (!deployment) {
      return res.status(404).json({ error: "Deployment not found" });
    }

    res.json({ logs: deployment.logs, status: deployment.status });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/logs/stream", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const deploymentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const deployment = await db.deployment.findFirst({
      where: {
        id: deploymentId,
        project: { userId: req.userId! }
      }
    });

    if (!deployment) {
      return res.status(404).end();
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let lastLength = deployment.logs.length;
    const interval = setInterval(async () => {
      const current = await db.deployment.findUnique({
        where: { id: deployment.id }
      });

      if (!current) {
        clearInterval(interval);
        res.write(`event: end\ndata: ${JSON.stringify({ reason: "missing" })}\n\n`);
        return res.end();
      }

      if (current.logs.length > lastLength) {
        const chunk = current.logs.slice(lastLength);
        lastLength = current.logs.length;
        res.write(`event: log\ndata: ${JSON.stringify({ chunk, status: current.status })}\n\n`);
      }

      if (current.status === "ready" || current.status === "failed") {
        clearInterval(interval);
        res.write(`event: done\ndata: ${JSON.stringify({ status: current.status })}\n\n`);
        res.end();
      }
    }, 1000);

    req.on("close", () => clearInterval(interval));
  } catch (error) {
    next(error);
  }
});

export default router;
