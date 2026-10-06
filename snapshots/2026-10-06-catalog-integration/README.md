# Four model-card catalog mappings: bounded integration proposal

This snapshot tests one concrete proposal against specification PR #1067 at
`565b1d130b30d6f4d0be45b9090781e8958de804` and PR #990 at
`f3d852197b1e13860dd6dea9d1c22b6c56c286ef`. It is independent review evidence,
not an accepted CycloneDX interpretation or a reference implementation.

The requested decision is limited to three applicable line suggestions covering
four catalog mappings:

1. Select performance records from `measurements[?(@.type)]`.
2. Select Intended Use references only from `useCaseAssertions` with
   `assertionType == 'implements'`, and resolve the same references for
   Use Case Definitions.
3. Select energy records from `measurements[?(@.activity)]`.

The measurement predicates follow the current #990 inline examples. The
**implements-only choice is a proposed catalog policy**, not something already
settled by those examples or implied by schema validation. Its basis is the
schema description of `implements`: the component provides the use case's
primary capability. Relationships such as `supports`, `extends`, `participates-in`,
`validates`, `inhibits`, and `not-applicable` retain their meaning in the BOM;
this narrow mapping does not infer that they declare intended use. Maintainers
can accept or decline this exact choice without reopening scope semantics.

## Observed results and proposed results

Both unmodified official #990 fixtures pass its full modular JSON Schema.
Both the original and proposed catalogs pass the full #1067 modular schema.

| Fixture and mapping | Current catalog | Proposed catalog |
|---|---:|---:|
| Model fixture: Quantitative Analysis | 0 | 3 |
| Model fixture: Intended Use | 0 | 0 |
| Model fixture: Use Case Definitions | 0 | 0 |
| Model fixture: Environmental Considerations | 0 | 2 |
| Risk-integration fixture: Quantitative Analysis | 0 | 3 |
| Risk-integration fixture: Intended Use | 0 | 1 reference collection |
| Risk-integration fixture: Use Case Definitions | 0 | 1 definition |
| Risk-integration fixture: Environmental Considerations | 0 | 2 |

The plain model fixture declares no use-case assertion; the proposal does not
invent one. The risk-integration fixture declares one `implements` relationship
and its target definition. Its existing inline Intended Use mapping selects
`$.definitions.useCases` directly; this proposal instead preserves the reusable
catalog's relationship from each model to its referenced definitions.

Fourteen additional checks cover all ten current assertion types, two individual
model source subtrees and the document root, and an empty reference collection.
An unrelated definition is never selected. The empty collection remains a
selected node for Intended Use and resolves no definition: this proposal does
not add a new non-empty completeness rule.

## Reproduce

From the repository root, using Node.js 22 or newer:

```bash
npm ci --ignore-scripts
npm run check:catalog
```

The runner fetches immutable source files listed in [sources.json](sources.json),
verifies their byte lengths and SHA-256 digests, and stores them in the ignored
`.cache/catalog-integration-2026-10-06/` directory. No credentials are required.
An existing cached file with the wrong digest is rejected. The two schemas are
loaded into separate validators, so their shared schema IDs cannot overwrite
one another.

The outputs are [results.json](results.json),
[line-suggestions.json](line-suggestions.json), and the explicit
[two-model fixture](two-model-fixture.json).
[changes.json](changes.json) defines the proposed replacements.
`catalog.patch` is the exact upstream patch corresponding to the suggestions.

The implementation uses RFC 9535 JSONPath. Its bounded local-reference check
restricts source values to the selected source subtree, resolves unique local
`bom-ref` targets, and restricts the final expression to those targets. This is
not a full perspective processor: scope expansion, dependency traversal,
referrers, external-document retrieval, and general completeness policies are
outside this snapshot. An exact selected reference array is distinguished from
its individual reference strings and from resolved definition objects.

## Completion boundary

The reproduction and proposal are complete. Upstream acceptance is pending.
After posting the three suggestions in one review, this investigation is
reported and awaiting the maintainer's decision. A change to these four mappings
requires only a bounded recheck of this snapshot. A documented rejection or
deferral closes the proposal as not adopted; it does not turn the original
selection mismatch into a fixed issue. No further findings are added to this
review, and previously closed Required/Fairness/GGUF discussions remain closed.

The prior `d3fca0c` study and evidence tags remain intact. No product exporter or
CycloneDX schema is changed by publishing this study snapshot.

## Sources

- [PR #1067 catalog](https://github.com/relizaio/cyclonedx-specification/blob/565b1d130b30d6f4d0be45b9090781e8958de804/perspectives/model-card-perspective.json)
- [PR #990 model fixture](https://github.com/CycloneDX/specification/blob/f3d852197b1e13860dd6dea9d1c22b6c56c286ef/tools/src/test/resources/2.0/valid-ai-ml-model-2.0.json)
- [PR #990 risk-integration fixture](https://github.com/CycloneDX/specification/blob/f3d852197b1e13860dd6dea9d1c22b6c56c286ef/tools/src/test/resources/2.0/valid-ai-ml-risk-integration-2.0.json)
- [PR #990 use-case relationship definitions](https://github.com/CycloneDX/specification/blob/f3d852197b1e13860dd6dea9d1c22b6c56c286ef/schema/2.0/model/cyclonedx-usecase-2.0.schema.json)

Upstream catalog excerpts in the patch and suggestions are attributed to the
CycloneDX specification project and retain their upstream licensing terms.
