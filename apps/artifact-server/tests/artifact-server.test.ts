import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createArtifactServer } from "../src/index";

let library: string;
let fetchArtifact: ReturnType<typeof createArtifactServer>;

beforeEach(async () => {
  library = await mkdtemp(join(tmpdir(), "artifact-library-"));
  await mkdir(join(library, "risk-report"));
  await writeFile(join(library, "risk-report", "index.html"), "<h1>Risk report</h1>");
  await writeFile(join(library, "risk-report", "data.json"), '{"risk":"high"}');
  fetchArtifact = createArtifactServer({ library });
});

afterEach(async () => {
  await rm(library, { recursive: true, force: true });
});

describe("Artifact Server", () => {
  test("serves regular artifact files with a restrictive content policy", async () => {
    const response = await fetchArtifact(new Request("http://artifact.test/risk-report/index.html"));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<h1>Risk report</h1>");
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("content-security-policy")).toContain("https://cdn.jsdelivr.net");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("returns headers but no body for HEAD requests", async () => {
    const response = await fetchArtifact(new Request("http://artifact.test/risk-report/data.json", { method: "HEAD" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(await response.text()).toBe("");
  });

  test("assigns a text content type to plain-text artifact files", async () => {
    await writeFile(join(library, "risk-report", "notes.txt"), "Review notes");

    const response = await fetchArtifact(new Request("http://artifact.test/risk-report/notes.txt"));

    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  });

  test("does not serve directories, hidden paths, traversal attempts, or symlinks", async () => {
    await mkdir(join(library, ".hidden"));
    await writeFile(join(library, ".hidden", "secret.html"), "secret");
    await symlink(join(library, "risk-report", "index.html"), join(library, "risk-report", "linked.html"));

    for (const path of [
      "/",
      "/risk-report",
      "/.hidden/secret.html",
      "/risk-report/%2e%2e/.hidden/secret.html",
      "/risk-report/linked.html",
    ]) {
      expect((await fetchArtifact(new Request(`http://artifact.test${path}`))).status).toBe(404);
    }
  });

  test("only accepts GET and HEAD", async () => {
    const response = await fetchArtifact(
      new Request("http://artifact.test/risk-report/index.html", { method: "POST" }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
  });
});
