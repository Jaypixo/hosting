import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttpImport from "pino-http";
import { env } from "./env.js";
import { logger } from "./logger.js";
import authRoutes from "./routes/auth.js";
import githubRoutes from "./routes/github.js";
import webhookRoutes from "./routes/webhooks.js";
import deploymentRoutes from "./routes/deployments.js";
import edgeRoutes from "./routes/edge.js";

const app = express();
const pinoHttp = pinoHttpImport as unknown as (options: { logger: typeof logger }) => express.RequestHandler;

app.use(pinoHttp({ logger }));
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true
}));
app.use(cookieParser());
app.use("/webhooks/github", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRoutes);
app.use("/github", githubRoutes);
app.use("/deployments", deploymentRoutes);
app.use("/webhooks", webhookRoutes);
app.use("/edge", edgeRoutes);

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(error);
  res.status(500).json({ error: error.message || "Internal server error" });
});

app.listen(env.API_PORT, () => {
  logger.info(`API listening on http://localhost:${env.API_PORT}`);
});
