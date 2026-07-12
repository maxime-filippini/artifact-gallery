import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, resolve, sep } from "node:path";

const DEFAULT_LIBRARY = "~/dev/review-artifacts";
const DEFAULT_PORT = 8766;

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "connect-src 'self'",
  "font-src 'self' https://cdn.jsdelivr.net",
  "frame-ancestors 'none'",
  "img-src 'self' data: https://cdn.jsdelivr.net",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
].join("; ");

export interface ArtifactServerOptions {
  library: string;
}

function response(status: number, headers?: HeadersInit): Response {
  return new Response(null, { status, headers });
}

function contentType(path: string): string {
  const extension = path.slice(path.lastIndexOf(".")).toLowerCase();
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

function artifactHeaders(path: string): Headers {
  return new Headers({
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
    "Content-Type": contentType(path),
    "X-Content-Type-Options": "nosniff",
  });
}

function requestSegments(request: Request): string[] | undefined {
  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return undefined;
  }

  try {
    const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
    return segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\0") ||
        segment.includes("/") ||
        segment.includes("\\"),
    )
      ? undefined
      : segments;
  } catch {
    return undefined;
  }
}

async function isRegularNonSymlinkFile(root: string, path: string): Promise<boolean> {
  const relativePath = path.slice(root.length + 1);
  let current = root;

  for (const segment of relativePath.split(sep)) {
    current = resolve(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) return false;
    } catch {
      return false;
    }
  }

  try {
    return (await lstat(path)).isFile();
  } catch {
    return false;
  }
}

export function createArtifactServer({ library }: ArtifactServerOptions) {
  const configuredLibrary = library.startsWith("~/")
    ? resolve(process.env.HOME ?? "", library.slice(2))
    : resolve(library);

  return async function fetch(request: Request): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return response(405, { Allow: "GET, HEAD" });
    }

    const segments = requestSegments(request);
    if (!segments || segments.length === 0 || segments.includes(".hidden")) {
      return response(404);
    }

    let root: string;
    try {
      root = await realpath(configuredLibrary);
      if (!(await lstat(root)).isDirectory()) return response(404);
    } catch {
      return response(404);
    }

    const target = resolve(root, ...segments);
    if (!isAbsolute(target) || !target.startsWith(`${root}${sep}`)) return response(404);
    if (!(await isRegularNonSymlinkFile(root, target))) return response(404);

    const headers = artifactHeaders(target);
    if (request.method === "HEAD") return response(200, headers);
    return new Response(Bun.file(target), { headers });
  };
}

if (import.meta.main) {
  const library = process.env.ARTIFACT_LIBRARY ?? DEFAULT_LIBRARY;
  const port = Number(process.env.ARTIFACT_PORT ?? DEFAULT_PORT);

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("ARTIFACT_PORT must be an integer between 0 and 65535.");
  }

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    fetch: createArtifactServer({ library }),
  });
  console.log(`Artifact Server listening on http://127.0.0.1:${server.port}`);
}

export { CONTENT_SECURITY_POLICY, DEFAULT_LIBRARY, DEFAULT_PORT };
