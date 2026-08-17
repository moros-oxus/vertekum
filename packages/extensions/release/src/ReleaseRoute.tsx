import { useCallback, useEffect, useState } from 'react';
import {
  type Baseline,
  buildReleaseNotes,
  diffTokens,
  type ExtensionContext,
  nextVersion,
  type ReleaseProvider,
  suggestBump,
  type TokenChange,
  useTokens,
} from 'vertekum';
import { INITIAL_VERSION, RELEASE_PROVIDER_SERVICE } from './release-service';

/**
 * Release route: diffs the working document against the last released baseline (from the
 * ReleaseProvider service), shows the suggested semver bump + next version + a grouped changelog
 * preview, and cuts a release. Manual + confirm; git commit/tag stays the user's (ADR-0018).
 */
export function ReleaseRoute({ context }: { context: ExtensionContext }) {
  const tokens = useTokens(context.document);
  const provider = context.services.get<ReleaseProvider>(
    RELEASE_PROVIDER_SERVICE,
  );
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    provider?.readBaseline().then(setBaseline);
  }, [provider]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const prevTokens = baseline?.tokens ?? [];
  const prevVersion = baseline?.version ?? INITIAL_VERSION;
  const changes = diffTokens(prevTokens, tokens);
  const bump = suggestBump(changes);
  // First release keeps the initial version; otherwise bump the previous one.
  const version =
    baseline === null
      ? INITIAL_VERSION
      : bump
        ? nextVersion(prevVersion, bump)
        : prevVersion;
  const notes = buildReleaseNotes(changes, version, bump);

  const cut = async () => {
    if (!provider) return;
    setBusy(true);
    try {
      await provider.writeRelease({ version, tokens, notes });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!provider) {
    return (
      <div className="vtk-release">
        <p className="vtk-empty">Release provider unavailable.</p>
      </div>
    );
  }

  const canRelease = baseline === null || bump !== null;

  return (
    <div className="vtk-release">
      <header>
        <h1>Release</h1>
        <p>
          Current: <strong>{baseline?.version ?? '(none)'}</strong> → next:{' '}
          <strong>{version}</strong> {bump ? `(${bump})` : ''}
        </p>
      </header>
      {canRelease ? (
        <>
          <ChangeList title="Removed (breaking)" items={notes.groups.removed} />
          <ChangeList title="Renamed (breaking)" items={notes.groups.renamed} />
          <ChangeList title="Retyped (breaking)" items={notes.groups.retyped} />
          <ChangeList title="Added" items={notes.groups.added} />
          <ChangeList title="Changed" items={notes.groups.changed} />
          <button type="button" disabled={busy} onClick={cut}>
            {baseline === null ? 'Cut initial release' : 'Cut release'}
          </button>
        </>
      ) : (
        <p className="vtk-empty">No changes since {baseline?.version}.</p>
      )}
    </div>
  );
}

function ChangeList({ title, items }: { title: string; items: TokenChange[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2>{title}</h2>
      <ul>
        {items.map((c) => (
          <li key={c.id}>{c.path.join('.')}</li>
        ))}
      </ul>
    </section>
  );
}
