import { Router } from "express";
import { env } from "../env.js";
import { resolveDeploymentForHost } from "../services/edge.js";

const router = Router();

router.post("/mapping", async (req, res) => {
  if (req.header("x-edge-secret") !== env.EDGE_API_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.json({ ok: true });
});

router.get("/resolve", async (req, res) => {
  if (req.header("x-edge-secret") !== env.EDGE_API_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const host = typeof req.query.host === "string" ? req.query.host : null;
  if (!host) {
    return res.status(400).json({ error: "Missing host" });
  }

  const result = await resolveDeploymentForHost(host);
  if (!result) {
    return res.status(404).json({ error: "Mapping not found" });
  }

  res.json(result);
});

export default router;
