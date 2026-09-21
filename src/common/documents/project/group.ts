import { ProjectItem } from "@common/documents/project/projectItem";
import { Sortable } from "@common/documents/sortable";
import { generateId } from "@common/idFactory";

/** A persisted named collection of project items. */
export interface Group extends ProjectItem, Sortable {
  /** Whether the group is collapsed in the UI. */
  collapsed?: boolean;
}

/** Creates a new group template with the provided name. */
export function createDefaultGroup(name: string): Group {
  return { id: generateId(), name, sequence: [] };
}
