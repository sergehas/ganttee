/**
 * Creates a field updater for an entity draft.
 *
 * The updater creates a shallow copy of the entity with one field replaced and
 * passes the copy to the change callback without mutating the original entity.
 *
 * @typeParam T - The type of the entity being updated.
 * @param entity - The current entity draft to copy.
 * @param onChange - Callback invoked with the updated entity draft.
 * @returns A function that accepts a field key and its new value.
 */
export function makeUpdater<T extends object>(entity: T, onChange: (updated: T) => void) {
  return <K extends keyof T>(key: K, value: T[K]) => onChange({ ...entity, [key]: value });
}

/**
 * Creates a field updater for replacing multiple fields at once.
 *
 * @typeParam T - The type of the entity being updated.
 * @param entity - The current entity draft to copy.
 * @param onChange - Callback invoked with the updated entity draft.
 * @returns A function that accepts the fields and values to replace.
 */
export function makeMultiUpdater<T extends object>(entity: T, onChange: (updated: T) => void) {
  return (updates: Partial<T>) => onChange({ ...entity, ...updates });
}
