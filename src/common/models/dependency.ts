/**
 * Dependency relationships between tasks.
 */

/**
 * The type of constraint a dependency imposes.
 * - `startAfter`: source starts after the target finishes (finish-to-start).
 * - `startWith`: source starts with the target start (start-to-start).
 * - `endWith`: source ends with the target end (finish-to-finish).
 */
export const DEPENDENCY_TYPES = ["startAfter", "startWith", "endWith"] as const;

export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

/** A directed constraint from a source task to a target task. */
export interface Dependency {
  id: string;
  /** Source task id (the owner/dependent entity). */
  sourceId: string;
  /** Target task id (the anchor/reference entity). */
  targetId: string;
  type: DependencyType;
}
