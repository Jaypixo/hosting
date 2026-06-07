import type { NextFunction, Request, Response } from "express";
import { verifySession } from "./auth.js";

export type AuthedRequest = Request & { userId?: string };

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.header("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const session = verifySession(token);
    req.userId = session.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }
}

