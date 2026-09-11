import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  PACKAGE_ROOT as root,
  PR1067_HEAD as head,
  PR990_CROSS_PR_COMMIT as pr990Commit,
  UPSTREAM_SOURCE_ROOT as upstreamSourceRoot
} from "./upstream.mjs";

const sourceDir = path.join(root, "source");
const files = [
  "schema/2.0/model/cyclonedx-perspective-2.0.schema.json",
  "perspectives/model-card-perspective.json",
  "tools/src/test/resources/2.0/valid-perspective-referrers-2.0.json"
];

await mkdir(sourceDir, { recursive: true });
const records = [];
for (const remotePath of files) {
  const url = `https://raw.githubusercontent.com/CycloneDX/specification/${head}/${remotePath}`;
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Failed ${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const filename = remotePath.split("/").at(-1);
  await writeFile(path.join(sourceDir, filename), bytes);
  records.push({
    path: remotePath,
    local_file: `source/${filename}`,
    url,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex")
  });
}
const githubHeaders = {
  accept: "application/vnd.github+json",
  "user-agent": "cyclonedx-pr1067-independent-semantic-study"
};
async function captureApi(url, filename) {
  const response = await fetch(url, { headers: githubHeaders });
  if (!response.ok) throw new Error(`Failed ${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const relative = `source/upstream-state/${filename}`;
  const output = path.join(root, relative);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, bytes);
  return { url, local_file: relative, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}
const observations = [];
observations.push(await captureApi("https://api.github.com/repos/CycloneDX/specification/pulls/1067", "pr-1067.json"));
observations.push(await captureApi(`https://api.github.com/repos/CycloneDX/specification/commits/${head}/check-runs`, "pr-1067-check-runs.json"));
observations.push(await captureApi("https://api.github.com/repos/CycloneDX/specification/pulls/990", "pr-990.json"));
observations.push(await captureApi(`https://api.github.com/repos/CycloneDX/specification/commits/${pr990Commit}`, "pr-990-f6d07fe-commit.json"));

const cacheDir = path.dirname(upstreamSourceRoot);
const archiveUrl = `https://codeload.github.com/CycloneDX/specification/zip/${head}`;
let sourceSnapshotReused = false;
try {
  const existingPinnedFiles = await Promise.all(files.map(async (remotePath) => {
    const bytes = await readFile(path.join(upstreamSourceRoot, ...remotePath.split("/")));
    return createHash("sha256").update(bytes).digest("hex");
  }));
  await readFile(path.join(upstreamSourceRoot, "schema", "2.0", "cyclonedx-2.0.schema.json"));
  sourceSnapshotReused = existingPinnedFiles.every((digest, index) => digest === records[index].sha256);
} catch {
  sourceSnapshotReused = false;
}

let validationSourceSnapshot;
if (!sourceSnapshotReused) {
  const archiveResponse = await fetch(archiveUrl, { redirect: "follow" });
  if (!archiveResponse.ok) throw new Error(`Failed ${archiveResponse.status} ${archiveUrl}`);
  const archiveBytes = Buffer.from(await archiveResponse.arrayBuffer());
  const archivePath = path.join(cacheDir, `specification-pr1067-${head.slice(0, 7)}.zip`);
  await mkdir(cacheDir, { recursive: true });
  await writeFile(archivePath, archiveBytes);
  await mkdir(upstreamSourceRoot, { recursive: true });
  const existingEntries = await readdir(upstreamSourceRoot);
  if (existingEntries.length > 0) {
    throw new Error(`Unverified snapshot directory is not empty; preserve it for inspection and use a new cache path: ${upstreamSourceRoot}`);
  }
  const archiveEntries = unzipSync(archiveBytes);
  const expectedPrefix = `specification-${head}/`;
  const resolvedRootWithSeparator = `${path.resolve(upstreamSourceRoot)}${path.sep}`;
  for (const [entryName, entryBytes] of Object.entries(archiveEntries)) {
    const normalizedName = entryName.replaceAll("\\", "/");
    if (!normalizedName.startsWith(expectedPrefix)) throw new Error(`Unexpected archive root: ${entryName}`);
    const relativeName = normalizedName.slice(expectedPrefix.length);
    if (!relativeName) continue;
    const segments = relativeName.split("/").filter(Boolean);
    if (segments.some((segment) => segment === "..")) throw new Error(`Unsafe archive entry: ${entryName}`);
    const destination = path.resolve(upstreamSourceRoot, ...segments);
    if (destination !== path.resolve(upstreamSourceRoot) && !destination.startsWith(resolvedRootWithSeparator)) {
      throw new Error(`Archive entry escaped snapshot directory: ${entryName}`);
    }
    if (normalizedName.endsWith("/")) await mkdir(destination, { recursive: true });
    else {
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, entryBytes);
    }
  }
  validationSourceSnapshot = {
    revision: head,
    transport: "GitHub codeload zip of the immutable commit; entries extracted only after root and path-boundary validation",
    transport_url: archiveUrl,
    transport_bytes: archiveBytes.length,
    transport_sha256: createHash("sha256").update(archiveBytes).digest("hex"),
    local_directory_ignored: `.cache/${path.basename(upstreamSourceRoot)}`,
    reused_existing_verified_snapshot: false
  };
} else {
  let previousSnapshot = null;
  try {
    const previousManifest = JSON.parse(await readFile(path.join(root, "SOURCE_MANIFEST.json"), "utf8"));
    if (previousManifest.head === head && previousManifest.validation_source_snapshot?.revision === head) {
      previousSnapshot = previousManifest.validation_source_snapshot;
    }
  } catch {
    previousSnapshot = null;
  }
  validationSourceSnapshot = {
    revision: head,
    transport: previousSnapshot?.transport || "existing snapshot verified against the three immutable pinned files",
    ...(previousSnapshot?.transport_url ? { transport_url: previousSnapshot.transport_url } : {}),
    ...(previousSnapshot?.transport_bytes ? { transport_bytes: previousSnapshot.transport_bytes } : {}),
    ...(previousSnapshot?.transport_sha256 ? { transport_sha256: previousSnapshot.transport_sha256 } : {}),
    local_directory_ignored: `.cache/${path.basename(upstreamSourceRoot)}`,
    reused_existing_verified_snapshot: true
  };
}

const manifest = {
  record_type: "independent.cyclonedx.pr1067.source-manifest.v1",
  repository: "CycloneDX/specification",
  pull_request: 1067,
  head,
  immutable_inputs: true,
  files: records,
  validation_source_snapshot: validationSourceSnapshot,
  mutable_observations: {
    captured_at: new Date().toISOString(),
    files: observations
  },
  cross_pr_commit: {
    pull_request: 990,
    commit: pr990Commit
  }
};
await writeFile(path.join(root, "SOURCE_MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await new Promise((resolve) => process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`, resolve));
process.exit(0);
