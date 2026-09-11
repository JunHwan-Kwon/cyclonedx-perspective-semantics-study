import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PACKAGE_ROOT as root } from "./upstream.mjs";

const manifest = JSON.parse(await readFile(path.join(root, "PACKAGE_INTEGRITY.json"), "utf8"));
assert.equal(manifest.record_type, "independent.cyclonedx.pr1067.package-integrity.v1");

const failures = [];
for (const entry of manifest.files) {
  try {
    const bytes = await readFile(path.join(root, ...entry.path.split("/")));
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (bytes.length !== entry.bytes || digest !== entry.sha256) {
      failures.push({ path: entry.path, expected_bytes: entry.bytes, actual_bytes: bytes.length, expected_sha256: entry.sha256, actual_sha256: digest });
    }
  } catch (error) {
    failures.push({ path: entry.path, error: error.code || error.message });
  }
}

if (failures.length) {
  process.stderr.write(`${JSON.stringify({ integrity: "failed", failures }, null, 2)}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({ integrity: "verified", file_count: manifest.files.length }, null, 2)}\n`);
}
