import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createGallery, readArtifactIndex } from "../src/index";

let library: string;

beforeEach(async () => {
  library = await mkdtemp(join(tmpdir(), "artifact-library-"));
  await mkdir(join(library, "risk-report"));
  await writeFile(join(library, "risk-report", "index.html"), "<h1>Risk</h1>");
  await writeFile(
    join(library, "risk-report", "artifact.json"),
    JSON.stringify({ title: "Risk report", description: "A <script>review</script>", thumbnail: "preview.png" }),
  );
  await mkdir(join(library, ".reviewed"));
  await mkdir(join(library, ".reviewed", "design-review"));
  await writeFile(join(library, ".reviewed", "design-review", "index.html"), "<h1>Design</h1>");
});

afterEach(async () => {
  await rm(library, { recursive: true, force: true });
});

describe("Artifact Index", () => {
  test("derives queue and archive entries from the Artifact Library", async () => {
    const index = await readArtifactIndex({ library, artifactOrigin: "https://artifacts.example.ts.net" });

    expect(index.queue).toEqual([
      {
        name: "risk-report",
        title: "Risk report",
        description: "A <script>review</script>",
        thumbnail: "preview.png",
        location: "queue",
        url: "https://artifacts.example.ts.net/risk-report/index.html",
      },
    ]);
    expect(index.archive[0]).toMatchObject({
      name: "design-review",
      title: "Design Review",
      location: "archive",
      url: "https://artifacts.example.ts.net/.reviewed/design-review/index.html",
    });
  });

  test("excludes invalid and symlinked artifact directories without failing the index", async () => {
    await mkdir(join(library, "Invalid_Name"));
    await writeFile(join(library, "Invalid_Name", "index.html"), "invalid");
    await symlink(join(library, "risk-report"), join(library, "linked-artifact"));
    await mkdir(join(library, "broken-metadata"));
    await writeFile(join(library, "broken-metadata", "index.html"), "valid");
    await writeFile(join(library, "broken-metadata", "artifact.json"), "not json");

    const index = await readArtifactIndex({ library, artifactOrigin: "https://artifacts.example.ts.net" });

    expect(index.queue.map((artifact) => artifact.name)).toEqual(["broken-metadata", "risk-report"]);
    expect(index.queue[0].title).toBe("Broken Metadata");
  });
});

describe("Gallery API", () => {
  test("returns a catalog that links to the configured Artifact Origin", async () => {
    const fetchGallery = createGallery({ library, artifactOrigin: "https://artifacts.example.ts.net" });
    const response = await fetchGallery(new Request("http://gallery.test/api/artifacts"));
    const index = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(index).toMatchObject({
      queue: [{ url: "https://artifacts.example.ts.net/risk-report/index.html" }],
    });
  });

  test("accepts only GET requests at the API route", async () => {
    const fetchGallery = createGallery({ library, artifactOrigin: "https://artifacts.example.ts.net" });

    expect((await fetchGallery(new Request("http://gallery.test/api/artifacts", { method: "POST" }))).status).toBe(405);
    expect((await fetchGallery(new Request("http://gallery.test/missing"))).status).toBe(404);
  });
});
