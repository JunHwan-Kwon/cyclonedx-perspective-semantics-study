import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isWithinPrefix } from "./evaluate-perspective.mjs";
import { PR1067_HEAD } from "./upstream.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resultsDir = path.join(root, "results");

async function load(name) {
  return JSON.parse(await readFile(path.join(resultsDir, `${name}.result.json`), "utf8"));
}

function findMapping(report, nativeName) {
  const evaluation = report.evaluations[0];
  const mapping = evaluation.mappings.find((entry) => entry.native_name === nativeName);
  if (!mapping) throw new Error(`Missing mapping ${nativeName}`);
  return { evaluation, mapping };
}

function compare(report, nativeName) {
  const { evaluation, mapping } = findMapping(report, nativeName);
  const seeds = evaluation.scope.seed_paths;
  const perSeed = seeds.map((seed) => {
    const matches = mapping.matched_nodes.filter((node) => isWithinPrefix(node.path, seed));
    return {
      seed_path: seed,
      matched_paths: matches.map((node) => node.path),
      present: matches.length > 0,
      non_empty: matches.some((node) => !node.empty)
    };
  });
  return {
    mapping: nativeName,
    mapping_any_match: mapping.match_count > 0,
    per_seed_subject_presence: perSeed.length > 0 && perSeed.every((entry) => entry.present),
    per_seed_subject_non_empty: perSeed.length > 0 && perSeed.every((entry) => entry.non_empty),
    subjects: perSeed
  };
}

const f2 = compare(await load("f2-subject-coverage"), "License");
const f5 = compare(await load("f5-empty-values"), "License");
const report = {
  record_type: "independent.cyclonedx.pr1067.required-policy-comparison.v3",
  normative_status: "observational replay of candidate policies; this probe does not define conformance",
  source_interpretation: {
    head: PR1067_HEAD,
    direct_mapping_satisfaction: "at least one selected node within the scope",
    per_subject_verdict: "declare one scope per subject",
    selected_empty_collection_sufficiency: "consumer policy",
    traversal_attribution: "not evaluated by these direct-mapping fixtures"
  },
  definitions: {
    mapping_any_match: "At least one path is selected by the mapping in the scope.",
    per_seed_subject_presence: "Every initial scope seed has at least one selected path, without judging the selected value.",
    per_seed_subject_non_empty: "Every initial scope seed has at least one selected value that is not null, an empty string, an empty array, or an empty object. This bounded comparator does not define via association semantics."
  },
  matrix: [
    { fixture: "F2 model B has no licenses property", ...f2 },
    { fixture: "F5 model has licenses: []", ...f5 }
  ],
  conclusion: "At d3fca0c the source prose resolves the direct-mapping cases as any-match per scope, with one scope per subject for a per-subject verdict; it leaves the sufficiency of a selected empty collection to consumer policy. The alternative columns remain observational comparisons, not conformance verdicts."
};
await mkdir(resultsDir, { recursive: true });
await writeFile(path.join(resultsDir, "required-policy-comparison.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
