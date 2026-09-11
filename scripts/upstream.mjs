import path from "node:path";
import { fileURLToPath } from "node:url";

export const PR1067_HEAD = "7a7d2dd599968e528349ca3cf262120da2831ca8";
export const PR1067_HEAD_SHORT = PR1067_HEAD.slice(0, 7);
export const PR990_CROSS_PR_COMMIT = "f6d07fef1cf6b7342d6debf909c1b5d35977b95d";

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const UPSTREAM_SOURCE_ROOT = path.join(
  PACKAGE_ROOT,
  ".cache",
  `specification-pr1067-${PR1067_HEAD_SHORT}-source-v2`
);
