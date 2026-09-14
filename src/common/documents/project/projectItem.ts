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
}
