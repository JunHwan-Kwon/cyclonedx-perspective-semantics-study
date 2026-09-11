import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256Json(value) {
  return sha256Bytes(Buffer.from(canonicalJson(value), "utf8"));
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function fileIdentity(filePath, recordedPath = filePath) {
  const bytes = await readFile(filePath);
  return { path: recordedPath.replaceAll("\\", "/"), bytes: bytes.length, sha256: sha256Bytes(bytes) };
}

export function stableUnique(values) {
  return [...new Set(values)].sort();
}

export function isExternalBomLink(value) {
  return typeof value === "string" && value.startsWith("urn:cdx:");
}

export function isEmptyValue(value) {
  if (value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  return value && typeof value === "object" && Object.keys(value).length === 0;
}
