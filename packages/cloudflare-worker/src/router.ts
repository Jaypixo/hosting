import { getMimeType, isHtmlAsset } from "./mime.js";
import { resolveDeploymentId, type EdgeEnv } from "./resolve.js";

function cacheHeaders(pathname: string) {
  if (isHtmlAsset(pathname)) {
    return {
      "Cache-Control": "public, max-age=0, must-revalidate"
    };
  }

  return {
    "Cache-Control": "public, max-age=31536000, immutable"
  };
}

async function fetchAsset(bucket: R2Bucket, deploymentId: string, pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  const candidatePaths = [
    `deployments/${deploymentId}/${normalizedPath}`,
    `deployments/${deploymentId}/${normalizedPath || "index.html"}`,
    `deployments/${deploymentId}/${normalizedPath.endsWith("/") ? `${normalizedPath}index.html` : normalizedPath}`,
    `deployments/${deploymentId}/index.html`
  ];

  for (const key of candidatePaths) {
    const object = await bucket.get(key);
    if (!object) {
      continue;
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Type", object.httpMetadata?.contentType || getMimeType(key));
    for (const [keyName, value] of Object.entries(cacheHeaders(pathname))) {
      headers.set(keyName, value);
    }
    headers.set("X-Deployment-Id", deploymentId);

    return new Response(object.body, { status: 200, headers });
  }

  return null;
}

export async function handleEdgeRequest(request: Request, env: EdgeEnv): Promise<Response> {
  const url = new URL(request.url);
  const hostname = request.headers.get("host") || url.hostname;
  const deploymentId = await resolveDeploymentId(hostname, env);

  if (!deploymentId) {
    return new Response("Deployment not found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }

  const asset = await fetchAsset(env.ASSETS, deploymentId, url.pathname);
  if (asset) {
    return asset;
  }

  if (isHtmlAsset(url.pathname)) {
    const fallback = await fetchAsset(env.ASSETS, deploymentId, "/index.html");
    if (fallback) {
      return fallback;
    }
  }

  return new Response("Not found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

