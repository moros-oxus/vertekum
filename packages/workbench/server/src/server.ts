import {
  createServer as createHttpServer,
  type IncomingMessage,
} from 'node:http';
import {
  readCollection,
  readTextFile,
  writeCollection,
  writeTextFile,
} from './collection-fs';
import { collectionAtRef, latestVersionTag, releaseAtHead } from './git';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/**
 * The local bridge server (ADR-0015): a single-user localhost helper. Dual-root — token files live
 * under `collectionDir`; metadata + generated artifacts (`.vertekum/`, CHANGELOG, export outputs)
 * live under `projectDir` (the `vertekum.config` dir). `projectDir` defaults to `collectionDir`.
 */
export function createBridgeServer(
  collectionDir: string,
  projectDir: string = collectionDir,
) {
  return createHttpServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }

    if (req.url === '/api/collection' && req.method === 'GET') {
      const files = await readCollection(collectionDir);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files }));
      return;
    }

    if (req.url === '/api/collection' && req.method === 'PUT') {
      try {
        const { files } = JSON.parse(await readBody(req));
        await writeCollection(collectionDir, files);
        res.writeHead(204).end();
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
      }
      return;
    }

    // Write an export artifact: PUT /api/file?path=build/tokens.css  (text body)
    if (req.url?.startsWith('/api/file') && req.method === 'PUT') {
      try {
        const path = new URL(req.url, 'http://localhost').searchParams.get(
          'path',
        );
        if (!path) throw new Error('missing ?path');
        await writeTextFile(projectDir, path, await readBody(req));
        res.writeHead(204).end();
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
      }
      return;
    }

    // Read a single collection file: GET /api/file?path=.vertekum/release.lock.json
    if (req.url?.startsWith('/api/file') && req.method === 'GET') {
      try {
        const path = new URL(req.url, 'http://localhost').searchParams.get(
          'path',
        );
        if (!path) throw new Error('missing ?path');
        const text = await readTextFile(projectDir, path);
        if (text === undefined) {
          res.writeHead(404).end();
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(text);
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
      }
      return;
    }

    if (req.url === '/api/settings' && req.method === 'GET') {
      const raw = await readTextFile(projectDir, '.vertekum/settings.json');
      let settings = {};
      if (raw) {
        try {
          settings = JSON.parse(raw);
        } catch (error) {
          console.error(
            'Corrupt .vertekum/settings.json, using defaults:',
            error,
          );
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ settings }));
      return;
    }

    if (req.url === '/api/settings' && req.method === 'PUT') {
      try {
        const { settings } = JSON.parse(await readBody(req));
        await writeTextFile(
          projectDir,
          '.vertekum/settings.json',
          `${JSON.stringify(settings, null, 2)}\n`,
        );
        res.writeHead(204).end();
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
      }
      return;
    }

    // The last released state: token files at the highest v* tag (baseline for the git provider).
    if (req.url === '/api/git/latest-release' && req.method === 'GET') {
      try {
        const release = await latestVersionTag(projectDir);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ release }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
      }
      return;
    }

    // The token collection as it was at a ref: GET /api/git/collection?ref=v1.2.0
    if (req.url?.startsWith('/api/git/collection') && req.method === 'GET') {
      try {
        const ref = new URL(req.url, 'http://localhost').searchParams.get(
          'ref',
        );
        if (!ref) throw new Error('missing ?ref');
        const files = await collectionAtRef(projectDir, collectionDir, ref);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ files }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
      }
      return;
    }

    // Opt-in release write: POST /api/git/release {version, commit, tag, bumpPackage, changelogPath}
    if (req.url === '/api/git/release' && req.method === 'POST') {
      try {
        const body = JSON.parse(await readBody(req));
        await releaseAtHead(projectDir, {
          projectDir,
          collectionDir,
          changelogPath: body.changelogPath ?? null,
          version: body.version,
          commit: body.commit ?? false,
          tag: Boolean(body.tag),
          bumpPackage: Boolean(body.bumpPackage),
        });
        res.writeHead(204).end();
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
      }
      return;
    }

    res.writeHead(404).end();
  });
}
