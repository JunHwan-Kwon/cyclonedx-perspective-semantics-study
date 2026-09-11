import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluatePerspective } from "./evaluate-perspective.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = path.join(root, "source", "model-card-perspective.json");
const resultsDir = path.join(root, "results");
await mkdir(resultsDir, { recursive: true });

const cases = [
  { id: "f1-risk-referrers", bom: "source/valid-perspective-referrers-2.0.json", applicationIndex: 0 },
  { id: "f1-dataset-refs", bom: "fixtures/f1-dataset-refs.json", applicationIndex: 0 },
  { id: "f2-subject-coverage", bom: "fixtures/f2-subject-coverage.json", applicationIndex: 0 },
  { id: "f5-empty-values", bom: "fixtures/f5-empty-values.json", applicationIndex: 0 },
  { id: "f4-one-hop-closure", bom: "fixtures/f4-one-hop-closure.json", applicationIndex: 0, inline: true },
  { id: "f6-external-bom-link", bom: "fixtures/f6-external-bom-link.json", applicationIndex: 0, inline: true },
  { id: "f7-ibm-hf-formulation-expression-scope", bom: "fixtures/f7-ibm-hf-formulation-expression-scope.json", applicationIndex: 0, inline: true },
  { id: "f8-ibm-hf-formulation-target-scope", bom: "fixtures/f8-ibm-hf-formulation-target-scope.json", applicationIndex: 0, inline: true },
  { id: "f9-ibm-hf-formulation-one-hop-chain", bom: "fixtures/f9-ibm-hf-formulation-one-hop-chain.json", applicationIndex: 0, inline: true },
  { id: "f10-ibm-hf-duplicate-reference", bom: "fixtures/f10-ibm-hf-duplicate-reference.json", applicationIndex: 0, inline: true },
  { id: "f11-ibm-hf-external-bom-link", bom: "fixtures/f11-ibm-hf-external-bom-link.json", applicationIndex: 0, inline: true }
];

const summary = [];
for (const fixture of cases) {
  const bomPath = path.join(root, fixture.bom);
  const report = await evaluatePerspective({
    bomPath,
    perspectivePath: fixture.inline ? null : catalog,
    applicationIndex: fixture.applicationIndex
  });
  const output = path.join(resultsDir, `${fixture.id}.result.json`);
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  summary.push({
    id: fixture.id,
    result: path.relative(root, output).replaceAll("\\", "/"),
    scope_count: report.evaluations.length,
    mapping_counts: report.evaluations.map((evaluation) =>
      evaluation.mappings.map((mapping) => ({ native_name: mapping.native_name, count: mapping.match_count })))
  });
}
await writeFile(path.join(resultsDir, "fixture-summary.json"), `${JSON.stringify({
  record_type: "independent.cyclonedx.pr1067.fixture-summary.v3",
  cases: summary
}, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
