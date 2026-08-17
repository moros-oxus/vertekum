import { type KeyboardEvent, type ReactNode, useId } from 'react';
import './Tabs.css';

export interface TabDef {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Presentational tabs: `role="tablist"`/`tab`/`tabpanel` with arrow-key roving focus (WAI-ARIA
 * tabs pattern). Document-ignorant — a candidate for `@vertekum-ui/react`.
 */
export function Tabs({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: TabDef[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const base = useId();
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const onKeyDown = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active?.id);
    if (i < 0) return;
    const next =
      e.key === 'ArrowRight'
        ? tabs[(i + 1) % tabs.length]
        : e.key === 'ArrowLeft'
          ? tabs[(i - 1 + tabs.length) % tabs.length]
          : undefined;
    if (next) onSelect(next.id);
  };

  return (
    <div data-vtk-tabs="">
      <div role="tablist" data-vtk-tablist="" onKeyDown={onKeyDown}>
        {tabs.map((t) => {
          const selected = t.id === active?.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              data-vtk-tab=""
              data-vtk-active={selected ? '' : undefined}
              onClick={() => onSelect(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {active ? (
        <div
          role="tabpanel"
          id={`${base}-panel-${active.id}`}
          aria-labelledby={`${base}-tab-${active.id}`}
          data-vtk-tabpanel=""
        >
          {active.content}
        </div>
      ) : null}
    </div>
  );
}
