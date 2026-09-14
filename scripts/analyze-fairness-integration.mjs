import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PACKAGE_ROOT as root, PR1067_HEAD, PR990_HEAD } from "./upstream.mjs";

const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));
const manifest = await readJson("SOURCE_MANIFEST.json");
const pr1067Risk = await readJson("source/cyclonedx-risk-2.0-pr1067.schema.json");
const pr990Risk = await readJson("source/cyclonedx-risk-2.0-pr990.schema.json");
const catalog = await readJson("source/model-card-perspective.json");
const fixture = await readJson("source/valid-perspective-referrers-2.0.json");
const evaluation = await readJson("results/f1-risk-referrers.result.json");

function predefinedRiskDomains(schema) {
  const choices = schema.$defs?.riskDomain?.properties?.type?.oneOf;
  const predefined = choices?.find((choice) => Array.isArray(choice.enum));
  if (!predefined) throw new Error("Could not locate the predefined riskDomain enum");
  return predefined.enum;
}

function manifestFile(revision, filePath) {
  const record = manifest.files.find((entry) => entry.revision === revision && entry.path === filePath);
  if (!record) throw new Error(`Missing manifest record ${revision}:${filePath}`);
  return {
    revision: record.revision,
    path: record.path,
    local_file: record.local_file,
    sha256: record.sha256,
    bytes: record.bytes
  };
}

const riskSchemaPath = "schema/2.0/model/cyclonedx-risk-2.0.schema.json";
const pr1067Domains = predefinedRiskDomains(pr1067Risk);
const pr990Domains = predefinedRiskDomains(pr990Risk);
const modelCard = catalog.perspectives?.[0];
const fairnessMapping = modelCard?.mappings?.find((mapping) => mapping.nativeName === "Fairness Assessments");
if (!fairnessMapping) throw new Error("Missing Fairness Assessments mapping");
const risks = fixture.risks?.risks || [];
const fixtureDomains = risks.map((risk) => ({
  bom_ref: risk["bom-ref"],
  name: risk.name,
  domain_types: (risk.domains || []).map((domain) => domain.type),
  impact_categories: risk.inherentRisk?.impact?.categories || []
}));
const evaluatedMapping = evaluation.evaluations?.[0]?.mappings?.find((mapping) => mapping.native_name === "Fairness Assessments");
if (!evaluatedMapping) throw new Error("Missing evaluated Fairness Assessments mapping");

const report = {
  record_type: "independent.cyclonedx.pr1067.fairness-domain-integration-observation.v1",
  normative_status: "observational cross-PR integration check; no schema change is prescribed",
  inputs: {
    pr1067_risk_schema: manifestFile(PR1067_HEAD, riskSchemaPath),
    pr990_risk_schema: manifestFile(PR990_HEAD, riskSchemaPath),
    model_card_catalog: manifestFile(PR1067_HEAD, "perspectives/model-card-perspective.json"),
    referrers_fixture: manifestFile(PR1067_HEAD, "tools/src/test/resources/2.0/valid-perspective-referrers-2.0.json")
  },
  observations: {
    fairness_mapping_expression: fairnessMapping.expression,
    fairness_mapping_via: fairnessMapping.via,
    pr1067_predefined_risk_domain_contains_fairness: pr1067Domains.includes("fairness"),
    pr990_predefined_risk_domain_contains_fairness: pr990Domains.includes("fairness"),
    fixture_risks: fixtureDomains,
    referrers_output_paths: evaluatedMapping.via_steps?.at(-1)?.output_paths || [],
    fairness_matched_paths: evaluatedMapping.matched_paths,
    fairness_match_count: evaluatedMapping.match_count
  },
  interpretation: "At the pinned #1067 head the referrers step reaches risk-a, but the revised Fairness Assessments expression selects no node from the unchanged fixture. The fixture declares ethical domains, while fairness is not a predefined riskDomain value in the #1067 risk schema and is present in the pinned #990 risk schema.",
  boundary: "This records an integration dependency between the two pinned pull-request heads. It does not classify the revised expression as defective or prescribe merge order."
};

assert.equal(report.observations.pr1067_predefined_risk_domain_contains_fairness, false);
assert.equal(report.observations.pr990_predefined_risk_domain_contains_fairness, true);
assert.deepEqual(report.observations.referrers_output_paths, ["$['risks']['risks'][0]"]);
assert.deepEqual(report.observations.fairness_matched_paths, []);
assert.equal(report.observations.fairness_match_count, 0);
assert.equal(report.observations.fixture_risks.every((risk) => risk.domain_types.includes("ethical")), true);
assert.equal(report.observations.fixture_risks.every((risk) => !risk.domain_types.includes("fairness")), true);

await writeFile(path.join(root, "results", "fairness-domain-integration-observation.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  pr1067_has_fairness_domain: report.observations.pr1067_predefined_risk_domain_contains_fairness,
  pr990_has_fairness_domain: report.observations.pr990_predefined_risk_domain_contains_fairness,
  referrers_output_paths: report.observations.referrers_output_paths,
  fairness_match_count: report.observations.fairness_match_count
}, null, 2)}\n`);
