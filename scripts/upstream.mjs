import path from "node:path";
import { fileURLToPath } from "node:url";

export const PR1067_HEAD = "d3fca0c0c4750008e2bc250b47f5692caa416d73";
export const PR1067_HEAD_SHORT = PR1067_HEAD.slice(0, 7);
export const PR990_HEAD = "38dfe9ca4b9b161510dd98b477dd78e4eefe7ec8";
export const PR990_CROSS_PR_COMMIT = "f6d07fef1cf6b7342d6debf909c1b5d35977b95d";

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const UPSTREAM_SOURCE_ROOT = path.join(
  PACKAGE_ROOT,
  ".cache",
  `specification-pr1067-${PR1067_HEAD_SHORT}-source-v2`
);
