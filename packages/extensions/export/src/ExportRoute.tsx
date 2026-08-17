import { useEffect, useState } from 'react';
import {
  EXPORTER_SERVICE,
  type ExporterInput,
  type ExporterService,
  type ExtensionContext,
  emptyResolver,
  type OutputFile,
  resolveExporterInput,
  runTargets,
  type ScopedConfig,
  type Target,
  targetId,
  useConfig,
  useResolvers,
  useTokens,
} from 'vertekum';
import { writeOutputFile } from './write-output';
import './ExportRoute.css';

const NONE = '';

/**
 * Export route — a thin client over the headless exporter seam: pick a format (registry) + a composition,
 * build the input via `resolveExporterInput`, run the (async) `transform`, preview the emitted files, and
 * write them under the output dir via the bridge (ADR-0018). Formats are contributed by extensions.
 */
export function ExportRoute({
  context,
  config,
}: {
  context: ExtensionContext;
  config: ScopedConfig<{ targets: Target[] }>;
}) {
  const tokens = useTokens(context.document);
  const resolvers = useResolvers(context.document);
  const registry = context.services.get<ExporterService>(EXPORTER_SERVICE);
  const exporters = registry?.list() ?? [];
  const compositions = [...resolvers.keys()];

  const [exporterId, setExporterId] = useState(exporters[0]?.id ?? '');
  const [composition, setComposition] = useState(compositions[0] ?? NONE);
  const [dir, setDir] = useState('build');
  const { targets } = useConfig(config);
  const [files, setFiles] = useState<OutputFile[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const exporter = registry?.get(exporterId);
    if (!exporter) {
      setFiles([]);
      return;
    }
    const resolver = composition ? resolvers.get(composition) : undefined;
    const input: ExporterInput = resolver
      ? resolveExporterInput(resolver, tokens)
      : { base: tokens, variants: [], resolver: emptyResolver(), tokens };
    let cancelled = false;
    Promise.resolve(exporter.transform(input))
      .then((f) => {
        if (!cancelled) {
          setFiles(f);
          setStatus(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setFiles([]);
          setStatus(`Failed: ${String(e)}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [exporterId, composition, tokens, resolvers, registry]);

  /**
   * Run one configured target through the SAME `runTargets` the CLI calls, so "Run web" here and
   * `vertekum build --target web` are one code path rather than two implementations (ADR-0018).
   */
  const runTarget = async (target: Target) => {
    if (!registry) return;
    try {
      const results = await runTargets([target], {
        registry,
        tokens,
        resolvers,
        only: [targetId(target)],
      });
      let count = 0;
      for (const result of results) {
        for (const file of result.files) {
          await writeOutputFile(
            `${result.target.out}/${file.path}`,
            file.content,
          );
          count++;
        }
      }
      setStatus(`Ran ${targetId(target)} — wrote ${count} file(s)`);
    } catch (error) {
      setStatus(`Failed: ${String(error)}`);
    }
  };

  const write = async () => {
    try {
      for (const file of files) {
        await writeOutputFile(`${dir}/${file.path}`, file.content);
      }
      setStatus(`Wrote ${files.length} file(s) to ${dir}/`);
    } catch (error) {
      setStatus(`Failed: ${String(error)}`);
    }
  };

  return (
    <div className="vtk-export">
      <h1>Export</h1>

      {targets.length > 0 && (
        <section className="vtk-export-targets">
          <h2>Configured targets</h2>
          <ul>
            {targets.map((target) => (
              <li key={targetId(target)}>
                <code>
                  {targetId(target)} → {target.out}/ ({target.exporter}
                  {target.composition ? `, ${target.composition}` : ''})
                </code>
                <button type="button" onClick={() => void runTarget(target)}>
                  Run {targetId(target)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <label htmlFor="vtk-export-format">Format</label>
      <select
        id="vtk-export-format"
        value={exporterId}
        onChange={(e) => setExporterId(e.target.value)}
      >
        {exporters.map((ex) => (
          <option key={ex.id} value={ex.id}>
            {ex.name}
          </option>
        ))}
      </select>

      <label htmlFor="vtk-export-composition">Composition</label>
      <select
        id="vtk-export-composition"
        value={composition}
        onChange={(e) => setComposition(e.target.value)}
      >
        <option value={NONE}>— none (flat) —</option>
        {compositions.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>

      <form
        className="vtk-export-target"
        onSubmit={(e) => {
          e.preventDefault();
          void write();
        }}
      >
        <label htmlFor="vtk-export-dir">Output dir</label>
        <input
          id="vtk-export-dir"
          name="dir"
          value={dir}
          onChange={(e) => setDir(e.target.value)}
          spellCheck={false}
        />
        <button type="submit">Write</button>
        {status && <span className="vtk-export-status">{status}</span>}
      </form>

      {files.map((f) => (
        <div key={f.path} className="vtk-export-file">
          <div className="vtk-export-file-path">
            {dir}/{f.path}
          </div>
          <pre className="vtk-export-preview">
            <code>{f.content}</code>
          </pre>
        </div>
      ))}
    </div>
  );
}
