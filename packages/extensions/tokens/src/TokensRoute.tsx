import {
  VALUE_EDITOR_SERVICE,
  type ValueEditorService,
} from '@vertekum/ext-value-editors';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  addSet,
  addToken,
  DEFAULT_SET,
  dtcg,
  type ExtensionContext,
  removeSet,
  removeToken,
  replaceToken,
  type ScopedConfig,
  type Token,
  useConfig,
  useSets,
  useTokens,
} from 'vertekum';
import type { z } from 'zod';
import type { TokensSettings } from './index';
import { SetNav } from './SetNav';
import { TokenEditorPanel } from './TokenEditorPanel';
import { TokenTable } from './TokenTable';
import './TokensRoute.css';

/** A blank token for the create flow: a fresh unique id (stored as its ident) in the active set. */
function newToken(set: string): Token {
  return {
    id: `vtk-${crypto.randomUUID()}`,
    path: [''],
    type: 'color',
    value: '',
    set,
  };
}

/**
 * The Tokens route — the main HostExtension. Owns its own two-pane layout: a set nav and a
 * table for the selected set. A theme select-menu (soft-read from the Themes service, ADR-0022)
 * chooses which theme's values the table shows and edits; the selection persists in the URL
 * (?theme=…) via the location service. Without Themes it degrades to the default theme only.
 */
export function TokensRoute({
  context,
  config,
}: {
  context: ExtensionContext;
  config: ScopedConfig<z.infer<typeof TokensSettings>>;
}) {
  const tokens = useTokens(context.document);
  const { density, showIds } = useConfig(config);
  const sets = useSets(context.document);
  const [selectedSet, setSelectedSet] = useState<string | null>(null);
  const activeSet =
    selectedSet && sets.includes(selectedSet) ? selectedSet : (sets[0] ?? null);
  const setTokens = tokens.filter((t) => (t.set ?? DEFAULT_SET) === activeSet);

  // Path index for reference resolution — built from ALL tokens, since refs cross groups.
  const byPath = useMemo(() => dtcg.tokens.indexByPath(tokens), [tokens]);

  // The token open in the editor panel (null = closed); `mode` routes Save to add-or-replace.
  const [editing, setEditing] = useState<{
    token: Token;
    mode: 'edit' | 'create';
  } | null>(null);

  // The value-editor registry (soft dependency): resolve per-$type editors and re-render when
  // the user changes their preferred editor (getSnapshot returns a new ref on change).
  const valueEditors =
    context.services.get<ValueEditorService>(VALUE_EDITOR_SERVICE);
  useSyncExternalStore(
    useCallback(
      (cb: () => void) => valueEditors?.subscribe(cb) ?? (() => {}),
      [valueEditors],
    ),
    () => valueEditors?.getSnapshot(),
  );

  // Undo/redo keyboard shortcuts, riding the command log (ADR-0012).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) context.document.redo();
      else context.document.undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [context.document]);

  return (
    <div data-vtk-tokens="">
      <SetNav
        sets={sets}
        activeSet={activeSet}
        onSelect={setSelectedSet}
        onAdd={(name) => {
          context.document.apply(addSet(name));
          setSelectedSet(name);
        }}
        onDelete={(name) => context.document.apply(removeSet(name))}
      />
      <section>
        <header className="vtk-tokens-toolbar">
          <span className="vtk-toolbar-spacer" />
          <button type="button" onClick={() => context.document.undo()}>
            Undo
          </button>
          <button type="button" onClick={() => context.document.redo()}>
            Redo
          </button>
          <button
            type="button"
            disabled={!activeSet}
            onClick={() =>
              activeSet &&
              setEditing({ token: newToken(activeSet), mode: 'create' })
            }
          >
            ＋ Add token
          </button>
        </header>
        {activeSet ? (
          <TokenTable
            tokens={setTokens}
            density={density}
            showIds={showIds}
            byPath={byPath}
            onEdit={(token) => setEditing({ token, mode: 'edit' })}
            onDelete={(id) => context.document.apply(removeToken(id))}
          />
        ) : (
          <p className="vtk-empty">No sets.</p>
        )}
      </section>
      {editing ? (
        <TokenEditorPanel
          token={editing.token}
          mode={editing.mode}
          valueEditors={valueEditors}
          byPath={byPath}
          onSave={(next) => {
            context.document.apply(
              editing.mode === 'create'
                ? addToken(next)
                : replaceToken(next.id, next),
            );
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
