/** The type of constraint a dependency imposes. */
export const DEPENDENCY_TYPES = ["startAfter", "startWith", "endWith"] as const;

/** The type of constraint a dependency imposes. */
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

/** A persisted directed constraint between project items. */
export interface Dependency {
  /** Stable unique identifier. */
  id: string;
  /** Source project item id. */
  sourceId: string;
  /** Target project item id. */
  targetId: string;
  /** Constraint type. */
  type: DependencyType;
}
