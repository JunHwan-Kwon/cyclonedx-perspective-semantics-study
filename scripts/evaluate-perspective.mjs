import { exec as execJsonPath, paths as jsonPaths, query } from "jsonpath-rfc9535";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { fileIdentity, isEmptyValue, isExternalBomLink, readJson, sha256Json, stableUnique } from "./lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const INTERPRETATION_PROFILE = Object.freeze({
  id: "independent.cyclonedx.pr1067.candidate-interpretation.v2",
  normative_status: "non-normative semantic probe",
  scope_expression_root: "document root",
  target_resolution: "local bom-ref; external BOM-Link recorded but not followed",
  scope_reference_entries: "objects with an own string-valued ref property",
  scope_reference_closure: "one hop from expression/target seeds; newly resolved nodes are not scanned",
  containment: "RFC 9535 normalized-path equality or descendant-token boundary",
  refs_restriction: "reference-value path must be inside the current node-set subtrees",
  referrers_holder: "object owning the property, or object owning one containing array; nested arrays are outside this bounded profile",
  scoped_referrers: "replace the current set with matching referring objects; do not retain input nodes, per #1067 head 7a7d2dd prose",
  whole_document_referrers: "identity whenever the current node set contains the document root, including omitted scopes, an explicit $ scope, and a preceding identity step",
  duplicate_bom_ref: "diagnostic; ambiguous reference is not resolved",
  dependencies: "unsupported in the bounded P0 probe and rejected fail-closed",
  required_completeness: "not decided by this evaluator"
});

function parseNormalizedPath(pathValue) {
  if (pathValue === "$") return ["$"];
  if (!pathValue.startsWith("$")) throw new Error(`Not a normalized JSONPath: ${pathValue}`);
  const prefixes = ["$"];
  let index = 1;
  while (index < pathValue.length) {
    if (pathValue[index] !== "[") throw new Error(`Unexpected normalized-path token at ${index}: ${pathValue}`);
    let cursor = index + 1;
    if (pathValue[cursor] === "'") {
      cursor += 1;
      let escaped = false;
      for (; cursor < pathValue.length; cursor += 1) {
        const char = pathValue[cursor];
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === "'") {
          cursor += 1;
          break;
        }
      }
    } else {
      while (cursor < pathValue.length && /[0-9]/.test(pathValue[cursor])) cursor += 1;
    }
    if (pathValue[cursor] !== "]") throw new Error(`Unterminated normalized-path token: ${pathValue}`);
    index = cursor + 1;
    prefixes.push(pathValue.slice(0, index));
  }
  return prefixes;
}

export function parentNormalizedPath(pathValue) {
  const prefixes = parseNormalizedPath(pathValue);
  return prefixes.length > 1 ? prefixes[prefixes.length - 2] : null;
}

export function isWithinPrefix(candidate, prefix) {
  return candidate === prefix || candidate.startsWith(prefix === "$" ? "$[" : `${prefix}[`);
}

export function isWholeDocumentSet(prefixes) {
  return prefixes.includes("$");
}

function pathValue(document, normalizedPath) {
  if (normalizedPath === "$") return document;
  const values = query(document, normalizedPath);
  if (values.length !== 1) throw new Error(`Normalized path did not identify exactly one node: ${normalizedPath}`);
  return values[0];
}

function buildNodeIndex(document) {
  const allPaths = stableUnique(["$", ...jsonPaths(document, "$..*")]);
  const nodes = new Map();
  for (const nodePath of allPaths) {
    const value = pathValue(document, nodePath);
    const parentPath = parentNormalizedPath(nodePath);
    nodes.set(nodePath, { path: nodePath, parent_path: parentPath, value });
  }
  return nodes;
}

function buildBomRefIndex(nodes) {
  const candidates = new Map();
  for (const node of nodes.values()) {
    if (!node.value || typeof node.value !== "object" || Array.isArray(node.value)) continue;
    if (typeof node.value["bom-ref"] !== "string") continue;
    const ref = node.value["bom-ref"];
    if (!candidates.has(ref)) candidates.set(ref, []);
    candidates.get(ref).push(node.path);
  }
  const unique = new Map();
  const duplicates = [];
  for (const [ref, nodePaths] of [...candidates.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const sorted = stableUnique(nodePaths);
    if (sorted.length === 1) unique.set(ref, sorted[0]);
    else duplicates.push({ ref, paths: sorted });
  }
  return { unique, duplicates };
}

function referenceValue(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && !Array.isArray(value) && typeof value.ref === "string") return value.ref;
  return null;
}

function resolveReference(ref, bomRefIndex, diagnostics, context) {
  if (isExternalBomLink(ref)) {
    diagnostics.external_bom_links.push({ ...context, ref, action: "recorded_not_followed" });
    return null;
  }
  const resolved = bomRefIndex.unique.get(ref);
  if (!resolved) {
    const duplicate = bomRefIndex.duplicates.find((entry) => entry.ref === ref);
    diagnostics.unresolved_refs.push({
      ...context,
      ref,
      reason: duplicate ? "duplicate_bom_ref" : "missing_local_target",
      candidates: duplicate?.paths || []
    });
    return null;
  }
  return resolved;
}

function pathsWithin(paths, prefixes) {
  return paths.filter((candidate) => prefixes.some((prefix) => isWithinPrefix(candidate, prefix)));
}

function holderForReferencePath(referencePath, nodes) {
  const parentPath = parentNormalizedPath(referencePath);
  if (!parentPath) return null;
  const parent = nodes.get(parentPath)?.value;
  if (Array.isArray(parent)) return parentNormalizedPath(parentPath);
  return parentPath;
}

function scanOneHopRefObjects(seedPrefixes, nodes, bomRefIndex, diagnostics) {
  const closure = [];
  const scannedObjects = new Set();
  for (const node of nodes.values()) {
    if (!seedPrefixes.some((prefix) => isWithinPrefix(node.path, prefix))) continue;
    if (!node.value || typeof node.value !== "object" || Array.isArray(node.value)) continue;
    if (!Object.hasOwn(node.value, "ref") || typeof node.value.ref !== "string") continue;
    if (scannedObjects.has(node.path)) continue;
    scannedObjects.add(node.path);
    const resolvedPath = resolveReference(node.value.ref, bomRefIndex, diagnostics, {
      phase: "scope.step3",
      from_path: node.path
    });
    closure.push({
      from_path: node.path,
      ref_value: node.value.ref,
      to_path: resolvedPath,
      resolution: resolvedPath ? "local" : isExternalBomLink(node.value.ref) ? "external_not_followed" : "unresolved"
    });
  }
  return closure.sort((a, b) => `${a.from_path}\0${a.ref_value}`.localeCompare(`${b.from_path}\0${b.ref_value}`));
}

function evaluateScope(scope, document, nodes, bomRefIndex, diagnostics) {
  const expressionResults = [];
  const expressionPaths = [];
  for (const expression of scope.expressions || []) {
    const matched = stableUnique(jsonPaths(document, expression));
    expressionResults.push({ expression, normalized_paths: matched });
    expressionPaths.push(...matched);
  }

  const targetResults = [];
  const targetPaths = [];
  for (const target of scope.targets || []) {
    const ref = referenceValue(target);
    if (!ref) {
      targetResults.push({ target, resolved_path: null, resolution: "invalid_target_shape" });
      diagnostics.unresolved_refs.push({ phase: "scope.step2", ref: null, reason: "invalid_target_shape", target });
      continue;
    }
    const resolvedPath = resolveReference(ref, bomRefIndex, diagnostics, { phase: "scope.step2", from_path: null });
    targetResults.push({
      target: ref,
      resolved_path: resolvedPath,
      resolution: resolvedPath ? "local" : isExternalBomLink(ref) ? "external_not_followed" : "unresolved"
    });
    if (resolvedPath) targetPaths.push(resolvedPath);
  }

  const seedPaths = stableUnique([...expressionPaths, ...targetPaths]);
  const closure = scanOneHopRefObjects(seedPaths, nodes, bomRefIndex, diagnostics);
  const closurePaths = closure.flatMap((entry) => entry.to_path ? [entry.to_path] : []);
  return {
    bom_ref: scope["bom-ref"] || null,
    name: scope.name || null,
    step1_expression_nodes: expressionResults,
    step2_target_nodes: targetResults,
    step3_closure_nodes: closure,
    seed_paths: seedPaths,
    scope_prefixes: stableUnique([...seedPaths, ...closurePaths])
  };
}

function applyRefsStep(expression, currentPrefixes, document, nodes, bomRefIndex, diagnostics, stepIndex) {
  const candidatePaths = stableUnique(jsonPaths(document, expression));
  const restricted = pathsWithin(candidatePaths, currentPrefixes);
  const outputs = [];
  const edges = [];
  for (const referencePath of restricted) {
    const value = nodes.get(referencePath)?.value;
    const ref = referenceValue(value);
    if (!ref) {
      diagnostics.unresolved_refs.push({ phase: `mapping.via[${stepIndex}].refs`, from_path: referencePath, ref: null, reason: "not_a_reference_value" });
      continue;
    }
    const resolvedPath = resolveReference(ref, bomRefIndex, diagnostics, {
      phase: `mapping.via[${stepIndex}].refs`,
      from_path: referencePath
    });
    edges.push({ from_path: referencePath, ref_value: ref, to_path: resolvedPath });
    if (resolvedPath) outputs.push(resolvedPath);
  }
  return { candidate_paths: candidatePaths, restricted_paths: restricted, output_paths: stableUnique(outputs), edges };
}

function applyReferrersStep(expression, currentPrefixes, wholeDocument, document, nodes, bomRefIndex, diagnostics, stepIndex) {
  if (wholeDocument) {
    return { candidate_paths: [], restricted_paths: [], output_paths: ["$"], edges: [], whole_document_identity: true };
  }
  const candidatePaths = stableUnique(jsonPaths(document, expression));
  const outputs = [];
  const edges = [];
  for (const referencePath of candidatePaths) {
    const value = nodes.get(referencePath)?.value;
    const ref = referenceValue(value);
    if (!ref) continue;
    const resolvedPath = resolveReference(ref, bomRefIndex, diagnostics, {
      phase: `mapping.via[${stepIndex}].referrers`,
      from_path: referencePath
    });
    if (!resolvedPath || !currentPrefixes.some((prefix) => isWithinPrefix(resolvedPath, prefix))) continue;
    const holderPath = holderForReferencePath(referencePath, nodes);
    edges.push({ from_path: holderPath, reference_path: referencePath, ref_value: ref, to_path: resolvedPath });
    if (holderPath) outputs.push(holderPath);
  }
  return { candidate_paths: candidatePaths, restricted_paths: candidatePaths, output_paths: stableUnique(outputs), edges, whole_document_identity: false };
}

function summarizeNode(pathValue, nodes) {
  const value = nodes.get(pathValue)?.value;
  return {
    path: pathValue,
    value_type: value === null ? "null" : Array.isArray(value) ? "array" : typeof value,
    empty: isEmptyValue(value),
    value
  };
}

function evaluateMapping(mapping, mappingIndex, scopePrefixes, unscoped, document, nodes, bomRefIndex, diagnostics) {
  let currentPrefixes = unscoped ? ["$"] : [...scopePrefixes];
  const viaSteps = [];
  for (const [stepIndex, step] of (mapping.via || []).entries()) {
    const inputPaths = [...currentPrefixes];
    let result;
    let kind;
    let expression = null;
    if (typeof step.refs === "string") {
      kind = "refs";
      expression = step.refs;
      result = applyRefsStep(expression, currentPrefixes, document, nodes, bomRefIndex, diagnostics, stepIndex);
    } else if (typeof step.referrers === "string") {
      kind = "referrers";
      expression = step.referrers;
      result = applyReferrersStep(expression, currentPrefixes, isWholeDocumentSet(currentPrefixes), document, nodes, bomRefIndex, diagnostics, stepIndex);
    } else if (step.dependencies) {
      throw new Error(`Unsupported dependencies traversal at mapping ${mappingIndex}, via step ${stepIndex}`);
    } else {
      throw new Error(`Unknown traversal shape at mapping ${mappingIndex}, via step ${stepIndex}`);
    }
    currentPrefixes = result.output_paths;
    viaSteps.push({
      index: stepIndex,
      kind,
      expression,
      input_count: inputPaths.length,
      input_paths: inputPaths,
      candidate_paths: result.candidate_paths,
      restricted_paths: result.restricted_paths,
      output_paths: result.output_paths,
      edges: result.edges,
      whole_document_identity: result.whole_document_identity || false
    });
  }
  const expressionPaths = stableUnique(jsonPaths(document, mapping.expression));
  const matchedPaths = pathsWithin(expressionPaths, currentPrefixes);
  return {
    index: mappingIndex,
    native_name: mapping.nativeName || null,
    expression: mapping.expression,
    relevance: mapping.relevance || null,
    via_steps: viaSteps,
    evaluation_prefixes: currentPrefixes,
    expression_paths: expressionPaths,
    matched_paths: matchedPaths,
    matched_nodes: matchedPaths.map((pathValue) => summarizeNode(pathValue, nodes)),
    match_count: matchedPaths.length
  };
}

export async function evaluatePerspective({ bomPath, perspectivePath, applicationIndex = 0 }) {
  const document = await readJson(bomPath);
  const perspectiveDocument = perspectivePath ? await readJson(perspectivePath) : document;
  const application = document.perspectives?.[applicationIndex];
  if (!application) throw new Error(`No perspective application at index ${applicationIndex}`);
  const definition = perspectivePath ? perspectiveDocument.perspectives?.[0] : application;
  if (!definition?.mappings) throw new Error("Perspective definition has no mappings");

  const nodes = buildNodeIndex(document);
  const bomRefIndex = buildBomRefIndex(nodes);
  const diagnostics = {
    duplicate_bom_refs: bomRefIndex.duplicates,
    unresolved_refs: [],
    external_bom_links: []
  };
  const declaredScopes = application.scopes || [];
  const scopeInputs = declaredScopes.length ? declaredScopes : [{ name: "Whole document" }];
  const scopes = scopeInputs.map((scope) => evaluateScope(scope, document, nodes, bomRefIndex, diagnostics));
  const unscoped = declaredScopes.length === 0;
  const evaluations = scopes.map((scope, scopeIndex) => ({
    scope_index: scopeIndex,
    scope,
    mappings: definition.mappings.map((mapping, mappingIndex) =>
      evaluateMapping(mapping, mappingIndex, scope.scope_prefixes, unscoped, document, nodes, bomRefIndex, diagnostics))
  }));

  return {
    record_type: "independent.cyclonedx.pr1067.perspective-evaluation.v2",
    normative_status: "non-normative observational evidence",
    inputs: {
      bom: await fileIdentity(bomPath, path.relative(root, bomPath)),
      perspective: perspectivePath ? await fileIdentity(perspectivePath, path.relative(root, perspectivePath)) : null,
      application_index: applicationIndex,
      application_sha256: sha256Json(application),
      definition_sha256: sha256Json(definition)
    },
    engine: {
      name: "jsonpath-rfc9535",
      version: "1.3.0",
      operations: ["paths", "query"]
    },
    interpretation_profile: INTERPRETATION_PROFILE,
    decision_points: [
      "The prose defines one completeness evaluation per scope but not the required/recommended pass/fail aggregation rule within that scope.",
      "The scope prose names object entries with a ref property; raw string references are traversed only when a mapping via expression selects them.",
      "A scope containing several seed subjects does not define whether completeness is collective or per subject.",
      "Empty selected values have a path match but no defined completeness meaning."
    ],
    document_index: {
      node_count: nodes.size,
      unique_bom_ref_count: bomRefIndex.unique.size,
      duplicate_bom_refs: bomRefIndex.duplicates
    },
    evaluations,
    diagnostics: {
      duplicate_bom_refs: diagnostics.duplicate_bom_refs,
      unresolved_refs: diagnostics.unresolved_refs.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      external_bom_links: diagnostics.external_bom_links.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    }
  };
}

async function cli() {
  const args = process.argv.slice(2);
  const option = (name, fallback = null) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : fallback;
  };
  const bomPath = option("--bom");
  const perspectivePath = option("--perspective");
  const applicationIndex = Number(option("--application-index", "0"));
  if (!bomPath) throw new Error("Usage: evaluate-perspective.mjs --bom <file> [--perspective <catalog>] [--application-index <n>]");
  const report = await evaluatePerspective({ bomPath, perspectivePath, applicationIndex });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
