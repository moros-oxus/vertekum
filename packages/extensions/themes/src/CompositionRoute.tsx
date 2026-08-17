import { useState } from 'react';
import {
  addResolver,
  type Document,
  removeResolver,
  useResolvers,
} from 'vertekum';
import { CompositionEditor } from './CompositionEditor';
import { CompositionNav } from './CompositionNav';
import './CompositionRoute.css';

/**
 * Composition management surface (front-facing "composition"; a composition = a DTCG resolver
 * document). R2 ships the nav (list/create/delete/select); the composition editor (modifiers,
 * contexts→sets, resolutionOrder) is a later pass — the right pane is a placeholder for now.
 */
export function CompositionRoute({ document }: { document: Document }) {
  const resolvers = useResolvers(document);
  const names = [...resolvers.keys()];
  const [selected, setSelected] = useState<string | null>(null);
  const active =
    selected && names.includes(selected) ? selected : (names[0] ?? null);

  return (
    <div data-vtk-composition="">
      <CompositionNav
        names={names}
        active={active}
        onSelect={setSelected}
        onAdd={(name) => {
          document.apply(addResolver(name));
          setSelected(name);
        }}
        onDelete={(name) => document.apply(removeResolver(name))}
      />
      <section>
        {active ? (
          <CompositionEditor document={document} name={active} />
        ) : (
          <p data-vtk-empty="">No compositions.</p>
        )}
      </section>
    </div>
  );
}
