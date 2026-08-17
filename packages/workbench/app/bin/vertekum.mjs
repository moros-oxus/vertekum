#!/usr/bin/env node
import { run } from '@vertekum/cli/loader.mjs';

run(process.argv.slice(2)).catch((error) => {
  console.error(error);
  process.exit(1);
});
