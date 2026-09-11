# CycloneDX PR #1067 perspective semantics study

This repository contains a bounded, separately developed, non-normative semantic probe for the
scope and traversal prose in CycloneDX specification PR #1067. It is evidence
for review, not a CycloneDX reference implementation or a product exporter.

The current evidence is pinned to commit
`7a7d2dd599968e528349ca3cf262120da2831ca8`.

## Result at the pinned head

The `referrers` description changed between `fdc2bd6` and `7a7d2dd`; the
model-card catalog and the existing two-model/two-risk fixture did not change
bytes. The complete F1 trace also did not change:

```text
scope input       $['components'][0]
referrer outputs  $['risks']['risks'][0]
evaluation set    $['risks']['risks'][0]
matched paths     $['risks']['risks'][0]
retained input    none
```

The before/after input hashes and node sets are recorded in
[`results/f1-head-transition-comparison.json`](results/f1-head-transition-comparison.json).

Five additional semantic-only fixtures use revision- and SHA-256-pinned IBM
and Hugging Face subjects to exercise the formulation-scope case. Expression
and target selection produce the same four-object set: the selected formulation
plus three objects reached through direct `{ref}` entries. An unrelated fourth
component is excluded. Separate fixtures record one-hop-only behavior,
duplicate local identifiers, and an external BOM-Link that is recorded but not
fetched. Subject identities are in
[`source/ibm-hf-scope-subjects.json`](source/ibm-hf-scope-subjects.json).

The probe deliberately does not turn `relevance: "required"` into a pass/fail
decision. Two schema-valid cases demonstrate why a separate completeness rule
is needed:

| case | mapping any-match | per-initial-subject presence | per-initial-subject non-empty |
| --- | ---: | ---: | ---: |
| two models in one scope; only model A has `licenses` | pass | fail | fail |
| one model with `licenses: []` | pass | pass | fail |

These are candidate policy outcomes, not normative answers. See
[`results/required-policy-comparison.json`](results/required-policy-comparison.json).

## Reproduce

Node.js 20 or newer is required.

```bash
npm ci --ignore-scripts
npm run capture
npm run check
npm run integrity
npm run verify:integrity
```

`npm run capture` downloads three immutable source files and a revision-pinned
source snapshot for modular JSON Schema validation. The source snapshot and
package dependencies are stored only in ignored cache directories. A repeated
capture reuses the snapshot only after the three pinned file hashes and the
root schema are verified.

`SOURCE_MANIFEST.json` records source URLs, revisions, byte sizes, SHA-256
digests, and separately labeled mutable PR/check observations. Generated
results use repository-relative paths and do not contain workstation paths.

## Fixture roles

- F1 risk is the existing schema-valid #1067 referrers fixture.
- F2 contains two initial model subjects but a license property on only one.
- F5 contains a selected empty license array.
- F1 dataset is explicitly a #990/#1067 cross-PR semantic case and is not
  claimed to validate against #1067 alone.
- F4 and F6 are semantic-only boundary probes for one-hop closure and external
  BOM-Link handling.
- F7 and F8 apply expression-based and target-based scopes to the same IBM/HF
  formulation example and compare their exact intermediate node sets.
- F9 verifies that references inside a newly reached conversion object do not
  create a second closure hop.
- F10 records duplicate `bom-ref` ambiguity; F11 records an external IBM/HF
  BOM-Link without network retrieval.

## Interpretation and claim boundary

The interpretation profile is embedded in every evaluator result. At
`7a7d2dd`, scoped `referrers` replace the current set with matching referring
objects and do not retain input objects. When the current set contains the
document root, `referrers` is an identity operation, including for an explicit
`$` scope and for successive identity steps. Holder resolution covers one
containing array; nested arrays are outside this bounded profile. `dependencies`
remains unsupported and is rejected explicitly.

The safe claim is that the checked PR/repository path does not contain an
executable semantic conformance test for these operations. This repository does
not claim that no independent implementation exists elsewhere. It also does not
choose a completeness policy.

## Author

Jun-Hwan Kwon, Ph.D.

This research software is not an official CycloneDX implementation.
