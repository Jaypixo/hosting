export type EdgeEnv = {
  ASSETS: R2Bucket;
  DEPLOYMENT_MAP?: KVNamespace;
  EDGE_API_BASE_URL?: string;
  EDGE_API_SECRET?: string;
  EDGE_ROOT_DOMAIN?: string;
};

export async function resolveDeploymentId(hostname: string, env: EdgeEnv): Promise<string | null> {
  const normalized = hostname.toLowerCase().split(":")[0];

  const exactKey = `host:${normalized}`;
  const kvExact = await env.DEPLOYMENT_MAP?.get(exactKey);
  if (kvExact) {
    return kvExact;
  }

  if (env.EDGE_ROOT_DOMAIN && normalized.endsWith(`.${env.EDGE_ROOT_DOMAIN}`)) {
    const label = normalized.slice(0, -(env.EDGE_ROOT_DOMAIN.length + 1));
    const projectKey = `project:${label}`;
    const kvProject = await env.DEPLOYMENT_MAP?.get(projectKey);
    if (kvProject) {
      return kvProject;
    }
  }

  if (env.EDGE_API_BASE_URL && env.EDGE_API_SECRET) {
    const response = await fetch(`${env.EDGE_API_BASE_URL}/edge/resolve?host=${encodeURIComponent(normalized)}`, {
      headers: {
        "x-edge-secret": env.EDGE_API_SECRET
      }
    });

    if (response.ok) {
      const data = (await response.json()) as { deploymentId?: string };
      return data.deploymentId || null;
    }
  }

  return null;
}
