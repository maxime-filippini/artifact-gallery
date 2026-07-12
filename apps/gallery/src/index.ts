import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { join, resolve } from "node:path";

const DEFAULT_LIBRARY = "~/dev/review-artifacts";
const DEFAULT_ORIGIN = "http://127.0.0.1:8766";
const DEFAULT_PORT = 8765;
const ARTIFACT_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
  library: string;
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
  let root = configuredPath(library);
  let resolvedOrigin: string;
  try {
    resolvedOrigin = new URL(artifactOrigin).toString();
    root = await realpath(root);
    if (!(await lstat(root)).isDirectory()) return { queue: [], archive: [] };
  } catch {
    return { queue: [], archive: [] };
  }

  const [queue, archive] = await Promise.all([
    readArtifacts(root, "queue", resolvedOrigin),
    readArtifacts(join(root, ".reviewed"), "archive", resolvedOrigin),
  ]);

  return { queue, archive };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function artifactCard(artifact: ReviewArtifact): string {
  const description = artifact.description
    ? `<p>${escapeHtml(artifact.description)}</p>`
    : "";
  return `<li><a href="${escapeHtml(artifact.url)}" rel="noopener noreferrer">${escapeHtml(artifact.title)}</a>${description}<small>${escapeHtml(artifact.name)}</small></li>`;
}

function section(title: string, artifacts: ReviewArtifact[]): string {
  const content = artifacts.length
    ? `<ul>${artifacts.map(artifactCard).join("")}</ul>`
    : "<p>No artifacts.</p>";
  return `<section><h2>${title}</h2>${content}</section>`;
}

function galleryPage(index: ArtifactIndex): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Artifact Gallery</title><style>body{font-family:system-ui,sans-serif;line-height:1.5;margin:0 auto;max-width:48rem;padding:2rem}section{margin-block:2rem}ul{display:grid;gap:1rem;list-style:none;padding:0}li{border:1px solid #ddd;border-radius:.5rem;padding:1rem}a{font-weight:700}p,small{display:block;margin:.5rem 0 0}</style></head><body><header><h1>Artifact Gallery</h1><p>Review artifacts open at their separate Artifact Origin.</p></header><main>${section("Review Queue", index.queue)}${section("Review Archive", index.archive)}</main></body></html>`;
}

export function createGallery(options: GalleryOptions) {
  return async function fetch(request: Request): Promise<Response> {
    if (request.method !== "GET")
      return new Response(null, { status: 405, headers: { Allow: "GET" } });
    if (new URL(request.url).pathname !== "/")
      return new Response(null, { status: 404 });

    const index = await readArtifactIndex(options);
    return new Response(galleryPage(index), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  };
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
    }),
  });
  console.log(`Gallery listening on http://127.0.0.1:${server.port}`);
}

export { DEFAULT_LIBRARY, DEFAULT_ORIGIN, DEFAULT_PORT };
