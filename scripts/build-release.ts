import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const buildRoot = join(projectRoot, "build");
const artifactServerDirectory = join(buildRoot, "artifact-server");
const galleryDirectory = join(buildRoot, "gallery");

function run(command: string[]): void {
  const result = Bun.spawnSync({
    cmd: [process.execPath, ...command],
    cwd: projectRoot,
    stderr: "inherit",
    stdout: "inherit",
  });
  if (result.exitCode !== 0)
    throw new Error(`Build command failed: bun ${command.join(" ")}`);
}

await rm(buildRoot, { force: true, recursive: true });
await mkdir(artifactServerDirectory, { recursive: true });
await mkdir(galleryDirectory, { recursive: true });

run(["run", "gallery:build"]);
run([
  "build",
  "--compile",
  "apps/artifact-server/src/index.ts",
  "--outfile",
  join(artifactServerDirectory, "artifact-server"),
]);
run([
  "build",
  "--compile",
  "apps/gallery/src/index.ts",
  "--outfile",
  join(galleryDirectory, "gallery"),
]);
await cp(
  join(projectRoot, "apps/gallery/dist"),
  join(galleryDirectory, "dist"),
  { recursive: true },
);

console.log(`Built standalone services in ${buildRoot}`);
