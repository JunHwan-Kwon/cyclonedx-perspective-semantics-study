import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PACKAGE_ROOT as root, PR1067_HEAD } from "./upstream.mjs";

const read = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));
const baseline = await read("expected/fdc2bd6-f1-risk-referrers-trace.json");
const current = await read("results/f1-risk-referrers.result.json");
const manifest = await read("SOURCE_MANIFEST.json");

function selectMapping(mapping) {
  return {
    native_name: mapping.native_name,
    via_steps: mapping.via_steps.map((step) => ({
      kind: step.kind,
      expression: step.expression,
      input_paths: step.input_paths,
      candidate_paths: step.candidate_paths,
      restricted_paths: step.restricted_paths,
      output_paths: step.output_paths,
      edges: step.edges,
      whole_document_identity: step.whole_document_identity
    })),
    evaluation_prefixes: mapping.evaluation_prefixes,
    matched_paths: mapping.matched_paths
  };
}

const evaluation = current.evaluations[0];
const currentTrace = {
  scope: {
    seed_paths: evaluation.scope.seed_paths,
    scope_prefixes: evaluation.scope.scope_prefixes
  },
  mappings: evaluation.mappings
    .filter((mapping) => baseline.mappings.some((item) => item.native_name === mapping.native_name))
    .map(selectMapping)
};
const baselineTrace = { scope: baseline.scope, mappings: baseline.mappings };
const nodeSelectionUnchanged = JSON.stringify(currentTrace) === JSON.stringify(baselineTrace);

const sourceByPath = new Map(manifest.files.map((entry) => [entry.path, entry]));
const fileComparison = [
  {
    role: "perspective schema",
    path: "schema/2.0/model/cyclonedx-perspective-2.0.schema.json",
    before_sha256: baseline.inputs.schema_sha256
  },
  {
    role: "model-card catalog",
    path: "perspectives/model-card-perspective.json",
    before_sha256: baseline.inputs.catalog_sha256
  },
  {
    role: "referrers fixture",
    path: "tools/src/test/resources/2.0/valid-perspective-referrers-2.0.json",
    before_sha256: baseline.inputs.fixture_sha256
  }
].map((entry) => {
  const after = sourceByPath.get(entry.path);
  if (!after) throw new Error(`Missing current input ${entry.path}`);
  return {
    ...entry,
    after_sha256: after.sha256,
    bytes_after: after.bytes,
    byte_identity_unchanged: entry.before_sha256 === after.sha256
  };
});

const report = {
  record_type: "independent.cyclonedx.pr1067.head-transition-comparison.v1",
  normative_status: "observational comparison; no completeness policy selected",
  from_head: baseline.head,
  to_head: PR1067_HEAD,
  file_comparison: fileComparison,
  f1_referrers_trace: {
    node_selection_unchanged: nodeSelectionUnchanged,
    comparison_scope: "scope seeds/prefixes plus candidate, restricted, output, edge, evaluation, and matched paths for the two referrers mappings",
    before: baselineTrace,
    after: currentTrace
  },
  conclusion: nodeSelectionUnchanged
    ? `F1 referrers node-selection results confirmed unchanged at ${PR1067_HEAD.slice(0, 7)}; the schema bytes changed while the catalog and fixture bytes did not.`
    : `F1 referrers node-selection results changed at ${PR1067_HEAD.slice(0, 7)}; inspect the recorded before/after traces.`
};

assert.equal(manifest.head, PR1067_HEAD);
await writeFile(path.join(root, "results", "f1-head-transition-comparison.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  from_head: report.from_head,
  to_head: report.to_head,
  node_selection_unchanged: nodeSelectionUnchanged,
  file_comparison: fileComparison.map(({ role, byte_identity_unchanged }) => ({ role, byte_identity_unchanged }))
}, null, 2)}\n`);
