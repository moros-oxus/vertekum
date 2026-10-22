---
"@vertekum/core": minor
---

Token verbs address a token in a set: `token add --set` only refuses a path the target set already holds, so a brand override of a shared path can be added; `token set` and `token remove` take `--set`, and `token move` takes `--from`; a path held by several sets without the flag is refused, naming them (it used to act on the first match). `token set --set` on a set that lacks the path creates the override there. Saves write only the files that changed, each in its own source key order, so a padded `"050"` no longer moves after `"100"`.
