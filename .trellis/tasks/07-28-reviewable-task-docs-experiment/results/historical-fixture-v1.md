# Historical fixture document-profile report

Sample: `historical-doc-profile-fixture-v1`; baseline SHA: `fb6ac58666d8a317be15472403af20130dfff639`; runs: one per variant; model and runner usage: `null` (offline structural backtest).

| Metric | Native | Reviewable | Reviewable minus native |
|---|---:|---:|---:|
| Estimated document tokens | 80 | 134 | 54 |
| Approval-surface estimated tokens | 80 | 57 | -23 |
| Unresolved placeholders | 0 | 0 | 0 |
| Requirement coverage | 1.0 | 1.0 | 0 |
| Critical requirement omissions | 0 | 0 | 0 |

Both fixture documents preserve R1, R2, AC1, and AC2; acceptance guardrails pass. Shadow metadata records both paths while `display_variant` selects native for blind review.

These are deterministic structural estimates from `unicode-v1`, not model billing Tokens and not evidence of user understanding. Actual input/output/cache Token, interaction cost, and human comprehension remain null or unmeasured in this offline backtest.
