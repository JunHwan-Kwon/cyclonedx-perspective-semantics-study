import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluatePerspective,
  isWholeDocumentSet,
  isWithinPrefix,
  parentNormalizedPath
} from "../scripts/evaluate-perspective.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function mapping(report, name) {
  return report.evaluations[0].mappings.find((entry) => entry.native_name === name);
}

function wholeDocumentFixture({ scopes, viaCount = 1 }) {
  const application = {
    "bom-ref": "perspective-test",
    name: "Whole-document referrers test",
    mappings: [
      {
        nativeName: "Referenceable objects",
        expression: "$..[?(@['bom-ref'])]",
        via: Array.from({ length: viaCount }, () => ({
          referrers: "$.risks.risks[*].affects[*]"
        }))
      }
    ]
  };
  if (scopes) application.scopes = scopes;
  return {
    components: [
      { "bom-ref": "model-a", type: "machine-learning-model", name: "A" },
      { "bom-ref": "model-b", type: "machine-learning-model", name: "B" }
    ],
    risks: {
      risks: [
        { "bom-ref": "risk-a", affects: ["model-a"] },
        { "bom-ref": "risk-b", affects: ["model-b"] }
      ]
    },
    definitions: {
      links: [{ ref: "model-a" }]
    },
    perspectives: [application]
  };
}

async function evaluateTemporary(t, document) {
  const directory = await mkdtemp(path.join(tmpdir(), "pr1067-evaluator-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bomPath = path.join(directory, "fixture.json");
  await writeFile(bomPath, `${JSON.stringify(document, null, 2)}\n`);
  return evaluatePerspective({ bomPath, perspectivePath: null, applicationIndex: 0 });
}

test("normalized-path containment respects token boundaries", () => {
  assert.equal(isWithinPrefix("$['a']", "$['a']"), true);
  assert.equal(isWithinPrefix("$['a']['b']", "$['a']"), true);
  assert.equal(isWithinPrefix("$['ab']", "$['a']"), false);
  assert.equal(isWithinPrefix("$['arr'][10]", "$['arr'][1]"), false);
  assert.equal(isWithinPrefix("$['a]b']['c']", "$['a]b']"), true);
  assert.equal(isWithinPrefix("$['a\\'b']['c']", "$['a\\'b']"), true);
});

test("normalized-path parents preserve quoted property tokens", () => {
  assert.equal(parentNormalizedPath("$['risks']['risks'][0]['affects'][0]"), "$['risks']['risks'][0]['affects']");
  assert.equal(parentNormalizedPath("$['a]b']['c']"), "$['a]b']");
  assert.equal(parentNormalizedPath("$['a\\'b'][0]"), "$['a\\'b']");
  assert.equal(parentNormalizedPath("$"), null);
});

test("whole-document detection accepts root with redundant descendant prefixes", () => {
  assert.equal(isWholeDocumentSet(["$"]), true);
  assert.equal(isWholeDocumentSet(["$", "$['components'][0]"]), true);
  assert.equal(isWholeDocumentSet(["$['components'][0]"]), false);
});

test("scoped referrers replace the model with only its referring risk", async () => {
  const report = await evaluatePerspective({
    bomPath: path.join(root, "source", "valid-perspective-referrers-2.0.json"),
    perspectivePath: path.join(root, "source", "model-card-perspective.json"),
    applicationIndex: 0
  });
  const result = mapping(report, "Ethical Considerations");
  assert.deepEqual(result.via_steps[0].input_paths, ["$['components'][0]"]);
  assert.deepEqual(result.via_steps[0].output_paths, ["$['risks']['risks'][0]"]);
  assert.deepEqual(result.matched_paths, ["$['risks']['risks'][0]"]);
  assert.equal(result.via_steps[0].output_paths.includes("$['components'][0]"), false);
});

test("the first unscoped referrers step is whole-document identity", async (t) => {
  const report = await evaluateTemporary(t, wholeDocumentFixture({}));
  const result = mapping(report, "Referenceable objects");
  assert.equal(result.via_steps[0].whole_document_identity, true);
  assert.deepEqual(result.via_steps[0].output_paths, ["$"]);
  assert.equal(result.match_count, 5);
});

test("an explicit $ scope remains whole-document identity after one-hop closure", async (t) => {
  const report = await evaluateTemporary(t, wholeDocumentFixture({
    scopes: [{ expressions: ["$"] }]
  }));
  assert.deepEqual(report.evaluations[0].scope.scope_prefixes, ["$", "$['components'][0]"]);
  const result = mapping(report, "Referenceable objects");
  assert.equal(result.via_steps[0].whole_document_identity, true);
  assert.deepEqual(result.via_steps[0].output_paths, ["$"]);
  assert.equal(result.match_count, 5);
});

test("successive unscoped referrers steps both remain whole-document identity", async (t) => {
  const report = await evaluateTemporary(t, wholeDocumentFixture({ viaCount: 2 }));
  const result = mapping(report, "Referenceable objects");
  assert.deepEqual(result.via_steps.map((step) => step.whole_document_identity), [true, true]);
  assert.deepEqual(result.via_steps.map((step) => step.output_paths), [["$"], ["$"]]);
  assert.equal(result.match_count, 5);
});
