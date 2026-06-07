const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

export function getMimeType(pathname: string, fallback = "application/octet-stream") {
  const extension = pathname.slice(pathname.lastIndexOf(".")).toLowerCase();
  return MIME_TYPES[extension] || fallback;
}

export function isHtmlAsset(pathname: string) {
  return pathname.endsWith(".html") || pathname.endsWith(".htm") || pathname === "/" || !pathname.includes(".");
}

