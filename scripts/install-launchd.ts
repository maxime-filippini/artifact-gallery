import { access, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const home = homedir();
const uid = process.getuid?.();
if (uid === undefined) throw new Error("launchd installation requires a macOS user ID.");

const artifactLibrary = process.env.ARTIFACT_LIBRARY ?? join(home, "dev/review-artifacts");
const artifactOrigin = process.env.ARTIFACT_ORIGIN;
if (!artifactOrigin) throw new Error("ARTIFACT_ORIGIN is required, for example https://mmbp.example.ts.net:8766.");

const buildRoot = join(projectRoot, "build");
const logDirectory = join(home, "Library/Logs/artifact-gallery");
const agentDirectory = join(home, "Library/LaunchAgents");
const labels = {
  artifactServer: "com.artifact-gallery.artifact-server",
  gallery: "com.artifact-gallery.gallery",
};

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]!);
}

function plist(label: string, executable: string, environment: Record<string, string>): string {
  const environmentValues = Object.entries(environment)
    .map(([key, value]) => `    <key>${escapeXml(key)}</key>\n    <string>${escapeXml(value)}</string>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapeXml(label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(executable)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${escapeXml(projectRoot)}</string>
  <key>EnvironmentVariables</key>
  <dict>
${environmentValues}
  </dict>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>${escapeXml(join(logDirectory, `${label}.out.log`))}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(join(logDirectory, `${label}.err.log`))}</string>
</dict>
</plist>
`;
}

function launchctl(arguments_: string[], ignoreFailure = false): void {
  const result = Bun.spawnSync({ cmd: ["/bin/launchctl", ...arguments_], stderr: "pipe", stdout: "pipe" });
  if (!ignoreFailure && result.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(result.stderr));
  }
}

const artifactServer = join(buildRoot, "artifact-server/artifact-server");
const gallery = join(buildRoot, "gallery/gallery");
await Promise.all([access(artifactServer), access(gallery)]).catch(() => {
  throw new Error("Compiled services are missing. Run `bun run build:release` first.");
});

await mkdir(artifactLibrary, { recursive: true });
await mkdir(logDirectory, { recursive: true });
await mkdir(agentDirectory, { recursive: true });

const artifactServerPlist = join(agentDirectory, `${labels.artifactServer}.plist`);
const galleryPlist = join(agentDirectory, `${labels.gallery}.plist`);
await writeFile(artifactServerPlist, plist(labels.artifactServer, artifactServer, {
  ARTIFACT_LIBRARY: artifactLibrary,
  ARTIFACT_PORT: "8766",
}));
await writeFile(galleryPlist, plist(labels.gallery, gallery, {
  ARTIFACT_LIBRARY: artifactLibrary,
  ARTIFACT_ORIGIN: artifactOrigin,
  GALLERY_PORT: "8765",
  GALLERY_STATIC_ROOT: join(buildRoot, "gallery/dist"),
}));

for (const label of Object.values(labels)) {
  launchctl(["bootout", `gui/${uid}/${label}`], true);
}
for (const [label, plistPath] of Object.entries({
  [labels.artifactServer]: artifactServerPlist,
  [labels.gallery]: galleryPlist,
})) {
  launchctl(["bootstrap", `gui/${uid}`, plistPath]);
  launchctl(["kickstart", "-k", `gui/${uid}/${label}`]);
}

console.log(`Installed and started ${labels.artifactServer} and ${labels.gallery}.`);
