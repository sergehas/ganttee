/**
 * Dependency relationships between tasks.
 */

/**
 * The type of constraint a dependency imposes.
 * - `startAfter`: target starts after the source finishes (finish-to-start).
 * - `startWith`: target starts when the source starts (start-to-start).
 * - `finishAfter`: target finishes after the source finishes (finish-to-finish).
 * - `finishWith`: target finishes when the source finishes.
 */
export type DependencyType =
  | "startAfter"
  | "startWith"
  | "finishAfter"
  | "finishWith";

/** A directed constraint from a source task to a target task. */
export interface Dependency {
  id: string;
  /** Source task id (the predecessor). */
  sourceId: string;
  /** Target task id (the successor). */
  targetId: string;
  type: DependencyType;
}
