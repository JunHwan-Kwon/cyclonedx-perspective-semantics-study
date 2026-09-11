import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PACKAGE_ROOT as root } from "./upstream.mjs";

const excludedDirectories = new Set([".cache", ".git", "node_modules"]);
const excludedFiles = new Set(["PACKAGE_INTEGRITY.json"]);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function filesBelow(relative = "") {
  const result = [];
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const child = path.join(relative, entry.name);
    const normalized = child.replaceAll("\\", "/");
    if (entry.isFile() && excludedFiles.has(normalized)) continue;
    if (entry.isDirectory()) result.push(...await filesBelow(child));
    else if (entry.isFile()) result.push(normalized);
  }
  return result;
}

const files = [];
for (const relative of (await filesBelow()).sort()) {
  const bytes = await readFile(path.join(root, relative));
  files.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) });
}
const manifest = {
  record_type: "independent.cyclonedx.pr1067.package-integrity.v1",
  exclusions: [".cache/**", ".git/**", "node_modules/**", "PACKAGE_INTEGRITY.json"],
  files
};
await writeFile(path.join(root, "PACKAGE_INTEGRITY.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ file_count: files.length, package_bytes: files.reduce((sum, item) => sum + item.bytes, 0) }, null, 2)}\n`);
