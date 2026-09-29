---
"@vertekum/cli": patch
---

The system default config is now resolved before it is merged under a project's config, so a default written in the function form (`defineConfig((env) => ({ … }))`) applies instead of being merged as a function.
