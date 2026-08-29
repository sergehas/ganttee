/** Produces a field-updater that applies one changed key-value pair onto an entity draft. */
export function makeUpdater<T extends object>(
  entity: T,
  onChange: (updated: T) => void,
) {
  return <K extends keyof T>(key: K, value: T[K]) =>
    onChange({ ...entity, [key]: value });
}
