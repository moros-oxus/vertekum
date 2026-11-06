---
"@vertekum/core": patch
"@vertekum/cli": patch
---

Tokens can be retired with DTCG `$deprecated` (on a token or a group, inherited, `false` opts out): `check` warns `token/deprecated-reference` on every live use, `build --json` lists deprecated tokens, and the release diff reports a newly deprecated token as its own `deprecated` change (patch) with a Deprecated section in the changelog.
