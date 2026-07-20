import { Dependency } from "./dependency";
import { Group, Milestone, Task } from "./task";

/** Current on-disk schema version for `.ganttee` documents. */
export const CURRENT_DOCUMENT_VERSION = 2;

/** The serialized shape of a `.ganttee` file. */
export interface GanttDocument {
  version: number;
  tasks: Task[];
  groups: Group[];
  milestones: Milestone[];
  dependencies: Dependency[];
}

/** Creates an empty document at the current schema version. */
export function createEmptyDocument(): GanttDocument {
  return {
    version: CURRENT_DOCUMENT_VERSION,
    tasks: [],
    groups: [],
    milestones: [],
    dependencies: [],
  };
}
