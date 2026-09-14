import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PR1067_HEAD } from "./upstream.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async (name) => JSON.parse(await readFile(path.join(root, "results", name), "utf8"));
const readRoot = async (name) => JSON.parse(await readFile(path.join(root, name), "utf8"));
const mapping = (report, name) => report.evaluations[0].mappings.find((entry) => entry.native_name === name);

const f1Risk = await read("f1-risk-referrers.result.json");
assert.equal(f1Risk.interpretation_profile.scoped_referrers, "replace the current set with matching referring objects; do not retain input nodes, per #1067 head d3fca0c prose");
assert.equal(f1Risk.record_type, "independent.cyclonedx.pr1067.perspective-evaluation.v2");
assert.equal(f1Risk.interpretation_profile.id, "independent.cyclonedx.pr1067.candidate-interpretation.v2");
assert.match(f1Risk.interpretation_profile.whole_document_referrers, /identity whenever the current node set contains the document root/);
assert.equal(Object.hasOwn(f1Risk.interpretation_profile, "unscoped_referrers"), false);
assert.deepEqual(mapping(f1Risk, "Ethical Considerations").matched_paths, ["$['risks']['risks'][0]"]);
assert.deepEqual(mapping(f1Risk, "Ethical Considerations").via_steps[0].input_paths, ["$['components'][0]"]);
assert.deepEqual(mapping(f1Risk, "Ethical Considerations").via_steps[0].output_paths, ["$['risks']['risks'][0]"]);
assert.equal(mapping(f1Risk, "Ethical Considerations").via_steps[0].output_paths.includes("$['components'][0]"), false);
assert.deepEqual(mapping(f1Risk, "Fairness Assessments").via_steps[0].output_paths, ["$['risks']['risks'][0]"]);
assert.deepEqual(mapping(f1Risk, "Fairness Assessments").matched_paths, []);

const f1Dataset = await read("f1-dataset-refs.result.json");
assert.deepEqual(mapping(f1Dataset, "Dataset Identity and Licensing").evaluation_prefixes, ["$['components'][2]"]);
assert.deepEqual(mapping(f1Dataset, "Dataset Identity and Licensing").matched_paths, [
  "$['components'][2]['licenses']",
  "$['components'][2]['name']",
  "$['components'][2]['version']"
]);

const f4 = await read("f4-one-hop-closure.result.json");
assert.deepEqual(f4.evaluations[0].scope.scope_prefixes, ["$['components'][0]", "$['risks']['risks'][0]"]);
assert.equal(f4.evaluations[0].scope.scope_prefixes.includes("$['components'][1]"), false);

const f6 = await read("f6-external-bom-link.result.json");
assert.equal(f6.diagnostics.external_bom_links.length, 1);
assert.equal(f6.evaluations[0].scope.scope_prefixes.includes("$['components'][0]"), true);

const ibmHfSubjects = await readRoot("source/ibm-hf-scope-subjects.json");
assert.equal(ibmHfSubjects.sources.length, 4);
assert.match(ibmHfSubjects.measurement_snapshot, /evidence-pr990-38dfe9c-gguf-v1/);

const expectedDirectScope = [
  "$['components'][0]",
  "$['components'][1]",
  "$['components'][2]",
  "$['formulation'][0]"
];
const f7 = await read("f7-ibm-hf-formulation-expression-scope.result.json");
const f8 = await read("f8-ibm-hf-formulation-target-scope.result.json");
assert.deepEqual(f7.evaluations[0].scope.scope_prefixes, expectedDirectScope);
assert.deepEqual(f8.evaluations[0].scope.scope_prefixes, expectedDirectScope);
assert.deepEqual(mapping(f7, "Referenceable objects").matched_paths, expectedDirectScope);
assert.deepEqual(mapping(f8, "Referenceable objects").matched_paths, expectedDirectScope);
assert.equal(f7.evaluations[0].scope.scope_prefixes.includes("$['components'][3]"), false);
assert.deepEqual(mapping(f7, "Selected workflow roles").matched_paths, [
  "$['formulation'][0]['evidence'][0]['role']",
  "$['formulation'][0]['evidence'][1]['role']",
  "$['formulation'][0]['evidence'][2]['role']"
]);

const f9 = await read("f9-ibm-hf-formulation-one-hop-chain.result.json");
assert.deepEqual(f9.evaluations[0].scope.scope_prefixes, [
  "$['components'][0]",
  "$['formulation'][0]"
]);
assert.equal(f9.evaluations[0].scope.scope_prefixes.includes("$['components'][1]"), false);
assert.equal(f9.evaluations[0].scope.scope_prefixes.includes("$['components'][2]"), false);

const f10 = await read("f10-ibm-hf-duplicate-reference.result.json");
assert.equal(f10.diagnostics.duplicate_bom_refs.length, 1);
assert.equal(f10.diagnostics.unresolved_refs.length, 1);
assert.equal(f10.diagnostics.unresolved_refs[0].reason, "duplicate_bom_ref");
assert.deepEqual(f10.evaluations[0].scope.scope_prefixes, ["$['formulation'][0]"]);

const f11 = await read("f11-ibm-hf-external-bom-link.result.json");
assert.equal(f11.diagnostics.external_bom_links.length, 1);
assert.equal(f11.diagnostics.external_bom_links[0].action, "recorded_not_followed");
assert.deepEqual(f11.evaluations[0].scope.scope_prefixes, ["$['formulation'][0]"]);

const policies = await read("required-policy-comparison.json");
assert.equal(policies.record_type, "independent.cyclonedx.pr1067.required-policy-comparison.v3");
assert.equal(policies.source_interpretation.head, PR1067_HEAD);
assert.equal(policies.source_interpretation.direct_mapping_satisfaction, "at least one selected node within the scope");
assert.equal(policies.source_interpretation.selected_empty_collection_sufficiency, "consumer policy");
assert.equal(Object.hasOwn(policies.definitions, "per_expanded_target_non_empty"), false);
assert.deepEqual(policies.matrix.map((row) => [
  row.mapping_any_match,
  row.per_seed_subject_presence,
  row.per_seed_subject_non_empty
]), [
  [true, false, false],
  [true, true, false]
]);

const transition = await read("f1-head-transition-comparison.json");
assert.equal(transition.to_head, PR1067_HEAD);
assert.equal(transition.f1_referrers_trace.node_selection_unchanged, false);
assert.equal(transition.f1_referrers_trace.traversal_node_sets_unchanged, true);
assert.equal(transition.f1_referrers_trace.mapping_selections_unchanged, false);
assert.deepEqual(transition.f1_referrers_trace.mapping_selection_comparison.map((item) => [item.native_name, item.unchanged]), [
  ["Ethical Considerations", true],
  ["Fairness Assessments", false]
]);
assert.deepEqual(transition.file_comparison.map((item) => item.byte_identity_unchanged), [false, false, true]);

const fairnessIntegration = await read("fairness-domain-integration-observation.json");
assert.equal(fairnessIntegration.observations.pr1067_predefined_risk_domain_contains_fairness, false);
assert.equal(fairnessIntegration.observations.pr990_predefined_risk_domain_contains_fairness, true);
assert.deepEqual(fairnessIntegration.observations.referrers_output_paths, ["$['risks']['risks'][0]"]);
assert.deepEqual(fairnessIntegration.observations.fairness_matched_paths, []);
assert.equal(fairnessIntegration.observations.fairness_match_count, 0);

process.stdout.write("PR #1067 evidence checks passed.\n");
