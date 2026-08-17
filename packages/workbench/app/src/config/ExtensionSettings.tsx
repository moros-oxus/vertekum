import type {
  ConfigStore,
  ExtensionManifest,
  ScopedConfig,
} from '@vertekum/core';
import { scopedConfig } from '@vertekum/core';
import { useId, useMemo } from 'react';
import type { ZodObject, ZodRawShape } from 'zod';
import { useConfig } from '../useConfig';
import { controlKind, enumOptions } from './controlKind';

/** One extension's settings, rendered from its Zod object schema. */
export function ExtensionSettings({
  manifest,
  store,
  persist,
}: {
  manifest: ExtensionManifest;
  store: ConfigStore;
  persist: () => void;
}) {
  const scoped = useMemo<ScopedConfig<Record<string, unknown>>>(
    () => scopedConfig(store, manifest.id),
    [store, manifest.id],
  );
  const values = useConfig(scoped);
  const shape = (manifest.settings as ZodObject<ZodRawShape> | undefined)
    ?.shape;
  const groupId = useId();

  if (!shape) return null;

  const set = (key: string, value: unknown) => {
    store.setUserOverrides(manifest.id, {
      ...store.getUserOverrides(manifest.id),
      [key]: value,
    });
    persist();
  };

  return (
    <fieldset className="vtk-settings-group">
      <legend>{manifest.name}</legend>
      {Object.entries(shape).map(([key, field]) => {
        const kind = controlKind(field);
        const fieldId = `${groupId}-${key}`;
        const current = values[key];
        return (
          <div className="vtk-settings-row" key={key}>
            <label htmlFor={fieldId}>{key}</label>
            {kind === 'checkbox' ? (
              <input
                id={fieldId}
                type="checkbox"
                checked={Boolean(current)}
                onChange={(e) => set(key, e.target.checked)}
              />
            ) : kind === 'select' ? (
              <select
                id={fieldId}
                value={String(current)}
                onChange={(e) => set(key, e.target.value)}
              >
                {enumOptions(field).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={fieldId}
                type={kind === 'number' ? 'number' : 'text'}
                value={String(current ?? '')}
                onChange={(e) =>
                  set(
                    key,
                    kind === 'number' ? e.target.valueAsNumber : e.target.value,
                  )
                }
              />
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
