# PR #1067 review evidence

## Status at capture

At the latest capture, PR #1067 was open and non-draft at
`7a7d2dd599968e528349ca3cf262120da2831ca8`. GitHub reported `MERGEABLE` and
`UNSTABLE`; DCO required action, GitGuardian passed, and no approving review was
recorded. `MERGEABLE` is treated only as absence of a detected merge conflict,
not as approval or imminent merge readiness. Mutable status is retained under
`source/upstream-state/` and is not treated as a forecast.

The DCO result identifies four earlier commits and does not identify commit
`7a7d2dd` or its `Co-authored-by` trailer as the cause.

## What the pinned probe establishes

- The perspective schema changed bytes from `fdc2bd6` to `7a7d2dd`; the
  model-card catalog and referrers fixture did not.
- F1's exact scope, candidate, restricted, output, edge, evaluation, and matched
  node sets are unchanged.
- The F1 trace conforms to the new prose: scoped `referrers` replace the input
  set and do not retain the already-selected model.
- F1, F2, and F5 validate against the modular schema at the pinned head.
- F2 and F5 distinguish path existence, per-subject presence, and non-empty
  value policies without selecting one as normative.
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

## Questions not resolved by the measurements

1. How one completeness evaluation aggregates multiple initial subjects in a
   single scope.
2. Whether a selected empty array, empty string, or null-like value counts as
   present, subject to the active schema accepting that value.
3. Whether and how objects reached through `via` inherit a per-object
   completeness obligation.
4. Whether raw string bom-refs outside `{ref}` objects participate in scope
   closure.
5. How duplicate local identifiers affect evaluation.

## Sources

- [CycloneDX PR #1067](https://github.com/CycloneDX/specification/pull/1067)
- [Commit 7a7d2dd](https://github.com/CycloneDX/specification/commit/7a7d2dd599968e528349ca3cf262120da2831ca8)
- Pinned source and mutable status captures under `source/`
