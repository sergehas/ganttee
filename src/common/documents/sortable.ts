/** Contract for an owner scope that persists one direct-child order. */
export interface Sortable {
  /**
   * Ordered direct-child ids owned by this scope, each id appearing exactly
   * once. Always present after load-time repair; optional here so
   * hand-built fixtures and pre-repair documents remain valid.
   */
  sequence?: string[];
}
