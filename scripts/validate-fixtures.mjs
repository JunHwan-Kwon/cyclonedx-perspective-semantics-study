import Ajv2020 from "ajv/dist/2020.js";
import draft7MetaSchema from "ajv/dist/refs/json-schema-draft-07.json" with { type: "json" };
import addFormats from "ajv-formats";
import addFormats2019 from "ajv-formats-draft2019";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fileIdentity } from "./lib.mjs";
import { PR1067_HEAD, UPSTREAM_SOURCE_ROOT } from "./upstream.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = process.env.CDX_PR1067_SOURCE
  ? path.resolve(process.env.CDX_PR1067_SOURCE)
  : UPSTREAM_SOURCE_ROOT;
const schemaRoot = path.join(sourceRoot, "schema");
const schemaDir = path.join(schemaRoot, "2.0");
const modelDir = path.join(schemaDir, "model");

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const modelFiles = (await readdir(modelDir))
  .filter((name) => name.endsWith(".schema.json"))
  .sort()
  .map((name) => path.join(modelDir, name));

const ajv = new Ajv2020({
  verbose: true,
  addUsedSchema: false,
  keywords: ["meta:enum"],
  strict: true,
  strictSchema: true,
  strictNumbers: true,
  strictTypes: true,
  strictTuples: true,
  strictRequired: true,
  validateFormats: true,
  allowMatchingProperties: true,
  allowUnionTypes: true
});
ajv.addMetaSchema(draft7MetaSchema);
for (const registry of ["spdx.schema.json", "cryptography-defs.schema.json", "behavior-taxonomy.schema.json", "perspectives-defs.schema.json"]) {
  const schema = await readJson(path.join(schemaRoot, registry));
  ajv.addSchema(schema);
  for (const alias of [`https://cyclonedx.org/schema/${registry}`, `http://cyclonedx.org/schema/${registry}`]) {
    if (alias !== schema.$id) ajv.addSchema({ ...schema, $id: alias });
  }
}
for (const file of modelFiles) ajv.addSchema(await readJson(file));
addFormats(ajv);
addFormats2019(ajv, { formats: ["idn-email"] });
ajv.addFormat("iri-reference", true);

const rootSchemaPath = path.join(schemaDir, "cyclonedx-2.0.schema.json");
const validate = ajv.compile(await readJson(rootSchemaPath));
const cases = [
  { id: "f1-risk-referrers", file: "source/valid-perspective-referrers-2.0.json", expected: "valid" },
  { id: "f1-dataset-refs", file: "fixtures/f1-dataset-refs.json", expected: "cross_pr_not_valid_against_1067_alone" },
  { id: "f2-subject-coverage", file: "fixtures/f2-subject-coverage.json", expected: "valid" },
  { id: "f5-empty-values", file: "fixtures/f5-empty-values.json", expected: "valid" },
  { id: "f4-one-hop-closure", file: "fixtures/f4-one-hop-closure.json", expected: "semantic_only" },
  { id: "f6-external-bom-link", file: "fixtures/f6-external-bom-link.json", expected: "semantic_only" }
];

const results = [];
for (const item of cases) {
  const file = path.join(root, item.file);
  const document = await readJson(file);
  const valid = Boolean(validate(document));
  results.push({
    id: item.id,
    expected_classification: item.expected,
    valid_against_pr1067_modular_schema: valid,
    input: await fileIdentity(file, item.file),
    errors: valid ? [] : structuredClone(validate.errors || [])
  });
}

const report = {
  record_type: "independent.cyclonedx.pr1067.fixture-validation.v1",
  validator: {
    implementation: "Ajv 2020",
    source_snapshot: `.cache/${path.basename(sourceRoot)}`,
    source_head: PR1067_HEAD,
    root_schema: await fileIdentity(rootSchemaPath, "upstream/schema/2.0/cyclonedx-2.0.schema.json"),
    module_count: modelFiles.length
  },
  results
};
await writeFile(path.join(root, "results", "fixture-validation.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(results.map(({ id, expected_classification, valid_against_pr1067_modular_schema }) => ({
  id,
  expected_classification,
  valid_against_pr1067_modular_schema
})), null, 2)}\n`);
