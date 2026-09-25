/** Allowed lifecycle states for a project item. */
export const PROJECT_ITEM_STATES = ["open", "closed"] as const;

/** Lifecycle state of a project item. */
export type ProjectItemState = (typeof PROJECT_ITEM_STATES)[number];

/** Shared identity and display fields for a persisted project item. */
export interface ProjectItem {
  /** Stable unique identifier. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Optional free-form description. */
  description?: string;
  /** Owning group id, if the item belongs to a group. */
  groupId?: string;
  /** Lifecycle state of the item. */
  state?: ProjectItemState;
  /** Optional status reference for the document status catalog. */
  status?: string;
}
