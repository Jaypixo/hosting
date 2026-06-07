import { env } from "../env.js";
import type { GitHubRepository } from "../types.js";
import { db } from "../db.js";

export async function exchangeGitHubCode(code: string) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.GITHUB_CALLBACK_URL
    })
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    scope: string;
  };

  if (!payload.access_token) {
    throw new Error("GitHub access token missing from response");
  }

  return payload;
}

export async function fetchGitHubUser(accessToken: string) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "hosting-platform"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub user fetch failed: ${response.status}`);
  }

  return (await response.json()) as {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

export async function listAccessibleRepositories(accessToken: string): Promise<GitHubRepository[]> {
  const repos: GitHubRepository[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(`https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "hosting-platform"
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub repository listing failed: ${response.status}`);
    }

    const pageRepos = (await response.json()) as Array<{
      id: number;
      name: string;
      full_name: string;
      private: boolean;
      default_branch: string;
      html_url: string;
    }>;

    repos.push(
      ...pageRepos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        default_branch: repo.default_branch,
        html_url: repo.html_url
      }))
    );

    if (pageRepos.length < 100) {
      break;
    }
  }

  return repos;
}

export async function fetchRepositoryByFullName(accessToken: string, fullName: string) {
  const response = await fetch(`https://api.github.com/repos/${fullName}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "hosting-platform"
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub repository fetch failed: ${response.status}`);
  }

  return (await response.json()) as GitHubRepository;
}

export async function getUserAccessToken(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }
  return user.githubAccessToken;
}
