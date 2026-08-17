// Import each module given on argv in a plain Node process. Run via:
//   node --import tsx/esm assert-headless.mjs <abs-module-path>...
// tsx transpiles TypeScript but has no CSS loader, so a module that reaches a `ui` surface fails
// with ERR_UNKNOWN_FILE_EXTENSION. That is the enforcement for the api/ui boundary (ADR-0029):
// vitest runs through Vite, which loads CSS happily, and so would never catch a leak.
for (const path of process.argv.slice(2)) {
  await import(path);
}
console.log(`ok ${process.argv.length - 2}`);
