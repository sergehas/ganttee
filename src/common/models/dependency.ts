/**
 * Dependency relationships between tasks.
 */

/**
 * The type of constraint a dependency imposes.
 * - `startAfter`: source starts after the target finishes (finish-to-start).
 * - `startWith`: source starts with the target start (start-to-start).
 * - `endWith`: source ends with the target end (finish-to-finish).
 * - `endBefore`: source ends before the target starts (finish-to-start).
 */
export type DependencyType =
  | "startAfter"
  | "startWith"
  | "endWith"
  | "endBefore";

/** A directed constraint from a source task to a target task. */
export interface Dependency {
  id: string;
  /** Source task id (the owner/dependent entity). */
  sourceId: string;
  /** Target task id (the anchor/reference entity). */
  targetId: string;
  type: DependencyType;
}
