# CycloneDX PR #1067 perspective semantics study

This repository contains a bounded, separately developed, non-normative semantic probe for the
scope and traversal prose in CycloneDX specification PR #1067. It is evidence
for review, not a CycloneDX reference implementation or a product exporter.

The current evidence is pinned to commit
`d3fca0c0c4750008e2bc250b47f5692caa416d73`.

## Result at the pinned head

Between `fdc2bd6` and `d3fca0c`, the perspective schema and model-card catalog
changed bytes while the existing two-model/two-risk fixture did not. The
`referrers` traversal and evaluation set remain unchanged:

```text
scope input       $['components'][0]
referrer outputs  $['risks']['risks'][0]
evaluation set    $['risks']['risks'][0]
retained input    none
```

The final expression results differ by mapping. Ethical Considerations still
selects `risk-a`; Fairness Assessments selects no node because its revised
expression requires a `fairness` risk domain while the unchanged fixture
declares only the `ethical` domain. The pinned #1067 risk schema does not yet
admit `fairness` as a predefined risk domain; that value is present at the
pinned #990 head. This is recorded as a cross-PR integration dependency, not
as a defect in the revised expression.

The before/after input hashes and node sets are recorded in
[`results/f1-head-transition-comparison.json`](results/f1-head-transition-comparison.json).
The risk-domain enum comparison, unchanged fixture declarations, traversal
output, and final Fairness selection are recorded together in
[`results/fairness-domain-integration-observation.json`](results/fairness-domain-integration-observation.json).

Five additional semantic-only fixtures use revision- and SHA-256-pinned IBM
and Hugging Face subjects to exercise the formulation-scope case. Expression
and target selection produce the same four-object set: the selected formulation
plus three objects reached through direct `{ref}` entries. An unrelated fourth
component is excluded. Separate fixtures record one-hop-only behavior,
duplicate local identifiers, and an external BOM-Link that is recorded but not
fetched. Subject identities are in
[`source/ibm-hf-scope-subjects.json`](source/ibm-hf-scope-subjects.json).

The probe does not independently define `relevance: "required"`. Two
schema-valid cases retain the previously compared policy outcomes:

| case | mapping any-match | per-initial-subject presence | per-initial-subject non-empty |
| --- | ---: | ---: | ---: |
| two models in one scope; only model A has `licenses` | pass | fail | fail |
| one model with `licenses: []` | pass | pass | fail |

At `d3fca0c`, the source prose resolves these direct-mapping cases as any-match
per scope, with one scope per subject for a per-subject verdict, and leaves the
sufficiency of a selected empty collection to consumer policy. The other
columns remain observational comparisons, not conformance verdicts. See
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
`d3fca0c`, scoped `referrers` replace the current set with matching referring
objects and do not retain input objects. When the current set contains the
document root, `referrers` is an identity operation, including for an explicit
`$` scope and for successive identity steps. Holder resolution covers one
containing array; nested arrays are outside this bounded profile. `dependencies`
remains unsupported and is rejected explicitly.

The safe claim is that the checked PR/repository path does not contain an
executable semantic conformance test for these operations. This repository does
not claim that no independent implementation exists elsewhere. It reports the
completeness interpretation stated by the pinned source without defining an
additional conformance policy.

## Author

Jun-Hwan Kwon, Ph.D.

This research software is not an official CycloneDX implementation.
