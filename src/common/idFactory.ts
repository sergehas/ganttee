/** Generates a UUID for a persisted project item or dependency. */
export function generateId(): string {
  return globalThis.crypto.randomUUID();
}
