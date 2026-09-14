# PR #1067 review evidence

## Status at capture

At the latest capture, PR #1067 was open and non-draft at
`d3fca0c0c4750008e2bc250b47f5692caa416d73`. GitHub reported `MERGEABLE` and
`UNSTABLE`; DCO required action, GitGuardian passed, and no approving review was
recorded. `MERGEABLE` is treated only as absence of a detected merge conflict,
not as approval or imminent merge readiness. Mutable status is retained under
`source/upstream-state/` and is not treated as a forecast.

The captured DCO result identifies five commits, including `d3fca0c`, with
author/sign-off mismatches. It does not identify commit `7a7d2dd` or its
`Co-authored-by` trailer as a cause.

## What the pinned probe establishes

- The perspective schema and model-card catalog changed bytes from `fdc2bd6`
  to `d3fca0c`; the referrers fixture did not.
- F1's exact scope, candidate, restricted, output, edge, and evaluation node
  sets are unchanged for both risk mappings.
- Ethical Considerations retains its matched node. Fairness Assessments changes
  from one matched risk to zero because the catalog now selects the `fairness`
  risk domain while the unchanged fixture declares only `ethical` domains.
- The pinned #1067 risk schema does not contain `fairness` in its predefined
  risk-domain enum; the separately pinned #990 risk schema does.
- The F1 traversal trace conforms to the prose: scoped `referrers` replace the
  input set and do not retain the already-selected model.
- F1, F2, and F5 validate against the modular schema at the pinned head.
- F2 and F5 distinguish path existence, per-subject presence, and non-empty
  value policies. The pinned prose uses any-match per scope, directs consumers
  to declare one scope per subject for a per-subject verdict, and leaves empty
  collection sufficiency to consumer policy.
- Boundary-safe path containment distinguishes `$.a` from `$.ab` and `[1]`
  from `[10]`.
- Whole-document `referrers` identity is covered for omitted scopes, an
  explicit `$` scope, and successive identity steps.
- Holder resolution covers one containing array; nested array holders are
  outside the bounded interpretation profile.
- `dependencies` is unsupported in this bounded probe and is rejected
  fail-closed.
- In the IBM/HF-derived formulation case, an expression scope and a target
  scope produce the same exact node set: the formulation plus three directly
  referenced objects; an unrelated component is excluded.
- Separate IBM/HF-derived cases preserve the one-hop boundary, diagnose a
  duplicate local identifier without resolving it, and record an external
  BOM-Link without fetching it.

## Boundaries not resolved by the measurements

1. Whether and how objects reached through `via` inherit a per-object
   completeness obligation.
2. Whether raw string bom-refs outside `{ref}` objects participate in scope
   closure.
3. How duplicate local identifiers affect evaluation.
4. Whether a consumer treats a selected empty array, empty string, or null-like
   value as sufficient, subject to the active schema accepting that value.
5. The `fairness` risk-domain mapping cannot be exercised by a schema-valid
   fixture on the pinned #1067 branch until the corresponding #990 risk-domain
   change is integrated.

## Sources

- [CycloneDX PR #1067](https://github.com/CycloneDX/specification/pull/1067)
- [Commit d3fca0c](https://github.com/CycloneDX/specification/commit/d3fca0c0c4750008e2bc250b47f5692caa416d73)
- Pinned source and mutable status captures under `source/`
