import jwt from "jsonwebtoken";
import { env } from "./env.js";
import type { JwtSession } from "./types.js";

export function signSession(session: JwtSession) {
  return jwt.sign(session, env.JWT_SECRET, { expiresIn: "30d" });
}

export function verifySession(token: string): JwtSession {
  return jwt.verify(token, env.JWT_SECRET) as JwtSession;
}

