import { env } from "../env.js";
import { db } from "../db.js";

function authHeaders() {
  return {
    Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
    "Content-Type": "application/json"
  };
}

async function putKvValue(key: string, value: string) {
  if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID || !env.EDGE_KV_NAMESPACE_ID) {
    return;
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${env.EDGE_KV_NAMESPACE_ID}/values/${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: authHeaders(),
    body: value
  });

  if (!response.ok) {
    throw new Error(`Cloudflare KV write failed for ${key}: ${response.status}`);
  }
}

export async function syncDeploymentMappings(projectId: string, deploymentId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { customDomains: true }
  });

  if (!project) {
    return;
  }

  const hostnames = [project.subdomain, ...project.customDomains.map((domain) => domain.hostname)];
  for (const hostname of hostnames) {
    await putKvValue(`host:${hostname}`, deploymentId);
  }

  if (env.EDGE_ROOT_DOMAIN) {
    await putKvValue(`project:${project.subdomain}`, deploymentId);
  }
}

export async function resolveDeploymentForHost(host: string) {
  const project = await db.project.findFirst({
    where: {
      OR: [{ subdomain: host }, { customDomains: { some: { hostname: host } } }]
    },
    include: {
      customDomains: true
    }
  });

  if (!project || !project.latestSuccessfulDeploymentId) {
    return null;
  }

  return {
    deploymentId: project.latestSuccessfulDeploymentId,
    projectId: project.id
  };
}

