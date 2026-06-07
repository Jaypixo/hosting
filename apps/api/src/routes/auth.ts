import { Router } from "express";
import crypto from "crypto";
import { env } from "../env.js";
import { db } from "../db.js";
import { exchangeGitHubCode, fetchGitHubUser } from "../services/github.js";
import { signSession } from "../auth.js";

const router = Router();

router.get("/github/start", (req, res) => {
  const requestedRedirect = typeof req.query.redirectTo === "string" ? req.query.redirectTo : "";
  const redirectTo = requestedRedirect.startsWith(env.WEB_APP_URL) ? requestedRedirect : `${env.WEB_APP_URL}/auth/callback`;
  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: env.GITHUB_CALLBACK_URL,
    scope: "repo read:user user:email",
    state
  });

  res.cookie("github_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 10 * 60 * 1000
  });
  res.cookie("github_redirect_to", redirectTo, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 10 * 60 * 1000
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

router.get("/github/callback", async (req, res, next) => {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    const cookieState = req.cookies.github_oauth_state;
    const redirectTo = typeof req.cookies.github_redirect_to === "string" && req.cookies.github_redirect_to.startsWith(env.WEB_APP_URL)
      ? req.cookies.github_redirect_to
      : `${env.WEB_APP_URL}/auth/callback`;

    if (!code || !state || !cookieState || cookieState !== state) {
      return res.status(400).send("Invalid GitHub OAuth state");
    }

    const tokenResponse = await exchangeGitHubCode(code);
    const githubUser = await fetchGitHubUser(tokenResponse.access_token);

    const user = await db.user.upsert({
      where: { githubId: String(githubUser.id) },
      create: {
        githubId: String(githubUser.id),
        githubLogin: githubUser.login,
        name: githubUser.name,
        email: githubUser.email,
        avatarUrl: githubUser.avatar_url || null,
        githubAccessToken: tokenResponse.access_token,
        githubRefreshToken: tokenResponse.refresh_token
      },
      update: {
        githubLogin: githubUser.login,
        name: githubUser.name,
        email: githubUser.email,
        avatarUrl: githubUser.avatar_url || null,
        githubAccessToken: tokenResponse.access_token,
        githubRefreshToken: tokenResponse.refresh_token
      }
    });

    const sessionToken = signSession({ userId: user.id });
    res.clearCookie("github_oauth_state");
    res.clearCookie("github_redirect_to");
    res.redirect(`${redirectTo}?token=${encodeURIComponent(sessionToken)}`);
  } catch (error) {
    next(error);
  }
});

export default router;
