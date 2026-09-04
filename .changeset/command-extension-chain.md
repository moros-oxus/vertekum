---
"@vertekum/core": patch
"@vertekum/cli": patch
---

The command extension chain: `ctx.commands.extend(name, link)` joins the chain of an existing command. Links on `token add`/`token set` prepare values before the built-in transforms — parse a custom type's short form, infer a type from the tree and the value's shape, or refuse with the accepted forms — with an explicit `--type` always beating a proposal. Links on `build` present tokens at interchange, so a custom type reaches every exporter in a form the downstream tool renders. Links propose and never write; order follows the config's `extensions` array; options a link declares join the command's flag set.
