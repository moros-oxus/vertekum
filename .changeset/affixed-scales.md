---
"@vertekum/core": patch
"@vertekum/schema-builder": patch
---

Affixed scales: a parenthesized formula may carry word fragments on either or both ends — `(2-4)xs` → `2xs 3xs 4xs`, `xs(2-4)`, `x(2-8/2)s` — with the full formula grammar (geometric ratios, quantization, zero-pad) available inside the parentheses. `evaluateScale` gains optional `prefix`/`suffix`; affixes wrap the names while values stay numeric. The additive step is now optional: `2-4` means `2-4/1`.
