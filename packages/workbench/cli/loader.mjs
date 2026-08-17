import { register } from 'tsx/esm/api';

// Enable on-the-fly TypeScript loading for the CLI + its workspace TS deps.
register();

export async function run(argv) {
  const mod = await import('./src/cli.ts');
  return mod.run(argv);
}
