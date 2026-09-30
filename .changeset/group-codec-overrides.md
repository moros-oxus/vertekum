---
"@vertekum/core": minor
---

A group codec's stops now generate beside authored children: a real child of the carrier group overrides the generated token it names instead of switching the whole group off, and `token set` on a generated token writes that override (`token remove` on it brings the generated token back).
