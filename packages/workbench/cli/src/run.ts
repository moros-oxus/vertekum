import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { resolveVertekumConfig } from '@vertekum/core';
import type { Plugin } from 'vite';
import { findConfig } from './findConfig';
import { findRepoRoot } from './findRepoRoot';
import { getFreePort } from './getFreePort';
import { openBrowser } from './openBrowser';
import { resolveCollectionDir } from './resolveCollectionDir';

const require = createRequire(import.meta.url);

/**
 * Loading the consumer config in Node pulls vertekum's extension graph (configs spread
 * `defaultConfig`), and those component modules import their own CSS. CSS is meaningless in Node
 * and the SSR module runner can't evaluate it. Redirect `.css` imports to an empty virtual module
 * for SSR only — resolving to a non-`.css` id so Vite's CSS plugins skip it. The browser (client)
 * build keeps its real styles (no `ssr` flag there).
 */
const SSR_CSS_STUB = '\0vtk-ssr-css-stub';
const ssrCssStub: Plugin = {
  name: 'vtk:ssr-css-stub',
  enforce: 'pre',
  resolveId(id, _importer, options) {
    if (options?.ssr && /\.css(\?.*)?$/.test(id)) return SSR_CSS_STUB;
  },
  load(id) {
    if (id === SSR_CSS_STUB) return '';
  },
};

/**
 * `vertekum dev`: bridge at the collection dir + Vite over vertekum with the consumer config. The
 * only long-running command, and the only one that loads Vite — imported here rather than at module
 * scope so `build`/`check`/`describe` never pull it in (ADR-0030).
 */
export async function runDev(): Promise<void> {
  // The dev trio — the app, the bridge, and Vite — are optional peers: a headless install
  // has every other verb without them. Missing here means "not installed", not a bug.
  let createBridgeServer: typeof import('@vertekum/server').createBridgeServer;
  let createViteServer: typeof import('vite').createServer;
  let searchForWorkspaceRoot: typeof import('vite').searchForWorkspaceRoot;
  try {
    ({ createBridgeServer } = await import('@vertekum/server'));
    ({ createServer: createViteServer, searchForWorkspaceRoot } = await import(
      'vite'
    ));
    require.resolve('vertekum/package.json');
  } catch {
    process.stderr.write(
      'vertekum dev needs the Vertekum app — install the `vertekum` package to use it\n',
    );
    process.exitCode = 2;
    return;
  }
  const cwd = process.cwd();
  const configPath = findConfig(cwd);

  // Reserve ports + expose them (and the config path) to the app's vite.config via env.
  const bridgePort = await getFreePort();
  const appPort = await getFreePort();
  process.env.VTK_BRIDGE_PORT = String(bridgePort);
  process.env.VTK_APP_PORT = String(appPort);
  if (configPath) process.env.VERTEKUM_CONFIG = configPath;

  // Create the Vite server over vertekum (not yet listening) so we can evaluate the
  // consumer config through Vite's robust SSR loader — the same pipeline that loads it
  // for the browser — instead of a Node-side loader that chokes on vertekum's TS graph.
  const appRoot = dirname(require.resolve('vertekum/package.json'));
  const server = await createViteServer({
    root: appRoot,
    configFile: join(appRoot, 'vite.config.ts'),
    plugins: [ssrCssStub],
    server: { fs: { allow: [searchForWorkspaceRoot(cwd), appRoot] } },
  });

  let userConfig: { collection?: string } | undefined;
  if (configPath) {
    const mod = await server.ssrLoadModule(configPath);
    userConfig = resolveVertekumConfig(mod.default, {
      command: 'serve',
      mode: server.config.mode,
    });
  }
  // Metadata + generated artifacts (.vertekum/, CHANGELOG, outputs) live at the working dir: the
  // config's dir when found, else the inferred repo root (system runs with defaultConfig alone).
  const projectDir = configPath ? dirname(configPath) : findRepoRoot(cwd);
  const collectionDir = resolveCollectionDir(
    userConfig,
    configPath,
    projectDir,
  );

  // Bridge first (so it is serving before the app loads), then the app.
  createBridgeServer(collectionDir, projectDir).listen(bridgePort, () => {
    console.log(
      `vertekum: bridge → http://localhost:${bridgePort}  project: ${projectDir}  collection: ${collectionDir}`,
    );
  });

  await server.listen();
  const url = `http://localhost:${appPort}/`;
  console.log(`vertekum: app → ${url}`);
  openBrowser(url);
}
