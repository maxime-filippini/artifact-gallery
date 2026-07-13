import {
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
} from "node:fs/promises";
import { Hono } from "hono";
import type { Dirent } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve, sep } from "node:path";

const DEFAULT_LIBRARY = "~/dev/review-artifacts";
const DEFAULT_ORIGIN = "http://127.0.0.1:8766";
const DEFAULT_PORT = 8765;
const ARTIFACT_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ACTION_PATH =
  /^\/api\/artifacts\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(review|restore)$/;

export interface ReviewArtifact {
  description?: string;
  location: "archive" | "queue";
  name: string;
  thumbnail?: string;
  title: string;
  url: string;
}

export interface ArtifactIndex {
  archive: ReviewArtifact[];
  queue: ReviewArtifact[];
}

export interface GalleryOptions {
  artifactOrigin: string;
  csrfToken?: string;
  library: string;
  staticRoot?: string;
}

interface ArtifactMetadata {
  description?: string;
  thumbnail?: string;
  title?: string;
}

function configuredPath(path: string): string {
  return path.startsWith("~/")
    ? resolve(process.env.HOME ?? "", path.slice(2))
    : resolve(path);
}

function titleFromName(name: string): string {
  return name
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function safeThumbnail(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    !value ||
    value.startsWith("/") ||
    value.includes("\\")
  )
    return undefined;
  const segments = value.split("/");
  return segments.some(
    (segment) => !segment || segment === "." || segment === "..",
  )
    ? undefined
    : value;
}

async function readMetadata(directory: string): Promise<ArtifactMetadata> {
  try {
    const value: unknown = JSON.parse(
      await readFile(join(directory, "artifact.json"), "utf8"),
    );
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const metadata = value as Record<string, unknown>;
    return {
      title:
        typeof metadata.title === "string" && metadata.title.trim()
          ? metadata.title
          : undefined,
      description:
        typeof metadata.description === "string" && metadata.description.trim()
          ? metadata.description
          : undefined,
      thumbnail: safeThumbnail(metadata.thumbnail),
    };
  } catch {
    return {};
  }
}

async function regularFile(path: string): Promise<boolean> {
  try {
    const stats = await lstat(path);
    return stats.isFile() && !stats.isSymbolicLink();
  } catch {
    return false;
  }
}

async function artifactLibraryRoot(
  library: string,
): Promise<string | undefined> {
  try {
    const root = await realpath(configuredPath(library));
    const stats = await lstat(root);
    return stats.isDirectory() && !stats.isSymbolicLink() ? root : undefined;
  } catch {
    return undefined;
  }
}

async function artifactDirectory(path: string): Promise<boolean> {
  try {
    const stats = await lstat(path);
    return (
      stats.isDirectory() &&
      !stats.isSymbolicLink() &&
      (await regularFile(join(path, "index.html")))
    );
  } catch {
    return false;
  }
}

async function ensureArchiveDirectory(path: string): Promise<boolean> {
  try {
    await mkdir(path);
  } catch {
    // An existing archive is expected; its type is checked below.
  }

  try {
    const stats = await lstat(path);
    return stats.isDirectory() && !stats.isSymbolicLink();
  } catch {
    return false;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

async function moveArtifact(
  library: string,
  name: string,
  action: "review" | "restore",
): Promise<number> {
  if (!ARTIFACT_NAME.test(name)) return 404;
  const root = await artifactLibraryRoot(library);
  if (!root) return 404;

  const archive = join(root, ".reviewed");
  if (action === "review" && !(await ensureArchiveDirectory(archive)))
    return 500;

  const source = action === "review" ? join(root, name) : join(archive, name);
  const target = action === "review" ? join(archive, name) : join(root, name);
  if (!(await artifactDirectory(source))) return 404;
  if (await pathExists(target)) return 409;

  try {
    await rename(source, target);
    return 204;
  } catch {
    return 500;
  }
}

function artifactUrl(
  origin: string,
  location: ReviewArtifact["location"],
  name: string,
): string {
  const prefix = location === "archive" ? ".reviewed/" : "";
  return new URL(
    `${prefix}${encodeURIComponent(name)}/index.html`,
    `${origin.replace(/\/$/, "")}/`,
  ).toString();
}

async function readArtifacts(
  directory: string,
  location: ReviewArtifact["location"],
  origin: string,
): Promise<ReviewArtifact[]> {
  let entries: Dirent<string>[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const artifacts = await Promise.all(
    entries.map(async (entry): Promise<ReviewArtifact | undefined> => {
      if (
        !entry.isDirectory() ||
        entry.isSymbolicLink() ||
        !ARTIFACT_NAME.test(entry.name)
      )
        return undefined;

      const artifactDirectory = join(directory, entry.name);
      if (!(await regularFile(join(artifactDirectory, "index.html"))))
        return undefined;

      const metadata = await readMetadata(artifactDirectory);
      return {
        description: metadata.description,
        location,
        name: entry.name,
        thumbnail: metadata.thumbnail,
        title: metadata.title ?? titleFromName(entry.name),
        url: artifactUrl(origin, location, entry.name),
      };
    }),
  );

  return artifacts
    .filter((artifact): artifact is ReviewArtifact => artifact !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function readArtifactIndex({
  library,
  artifactOrigin,
}: GalleryOptions): Promise<ArtifactIndex> {
  const root = await artifactLibraryRoot(library);
  let resolvedOrigin: string;
  try {
    resolvedOrigin = new URL(artifactOrigin).toString();
  } catch {
    return { queue: [], archive: [] };
  }
  if (!root) return { queue: [], archive: [] };

  const [queue, archive] = await Promise.all([
    readArtifacts(root, "queue", resolvedOrigin),
    readArtifacts(join(root, ".reviewed"), "archive", resolvedOrigin),
  ]);

  return { queue, archive };
}

async function serveStaticFile(
  staticRoot: string,
  pathname: string,
): Promise<Response> {
  const root = resolve(staticRoot);
  const target =
    pathname === "/" ? join(root, "index.html") : resolve(root, `.${pathname}`);
  if (!target.startsWith(`${root}${sep}`))
    return new Response(null, { status: 404 });

  try {
    const stats = await lstat(target);
    if (!stats.isFile() || stats.isSymbolicLink())
      return new Response(null, { status: 404 });
    return new Response(Bun.file(target), {
      headers: { "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

export function createGallery(options: GalleryOptions) {
  const csrfToken = options.csrfToken ?? crypto.randomUUID();
  const app = new Hono();

  app.get("/api/artifacts", async (context) => {
    const index = await readArtifactIndex(options);
    context.header("Cache-Control", "no-store");
    context.header("X-Content-Type-Options", "nosniff");
    return context.json({ ...index, csrfToken });
  });

  app.post("/api/artifacts/:name/:action", async (context) => {
    const { action, name } = context.req.param();
    if (
      !ACTION_PATH.test(context.req.path) ||
      (action !== "review" && action !== "restore")
    ) {
      return context.notFound();
    }

    const fetchSite = context.req.header("Sec-Fetch-Site");
    const sameSite =
      !fetchSite || fetchSite === "same-origin" || fetchSite === "same-site";
    if (!sameSite || context.req.header("X-CSRF-Token") !== csrfToken) {
      return context.body(null, 403);
    }

    const status = await moveArtifact(options.library, name, action);
    return context.body(null, status as 204 | 404 | 409 | 500);
  });

  app.all("/api/*", (context) =>
    context.body(null, 405, { Allow: "GET, POST" }),
  );

  app.get("*", (context) => {
    return options.staticRoot
      ? serveStaticFile(options.staticRoot, context.req.path)
      : context.notFound();
  });
  app.all("*", (context) => context.body(null, 405, { Allow: "GET" }));

  return app.fetch;
}

if (import.meta.main) {
  const port = Number(process.env.GALLERY_PORT ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("GALLERY_PORT must be an integer between 0 and 65535.");
  }

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    fetch: createGallery({
      artifactOrigin: process.env.ARTIFACT_ORIGIN ?? DEFAULT_ORIGIN,
      library: process.env.ARTIFACT_LIBRARY ?? DEFAULT_LIBRARY,
      staticRoot: fileURLToPath(new URL("../dist", import.meta.url)),
    }),
  });
  console.log(`Gallery listening on http://127.0.0.1:${server.port}`);
}

export { DEFAULT_LIBRARY, DEFAULT_ORIGIN, DEFAULT_PORT };
