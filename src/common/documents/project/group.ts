import { ProjectItem } from "@common/documents/project/projectItem";
import { Sortable } from "@common/documents/sortable";
import { generateId } from "@common/idFactory";

/** A persisted named collection of project items. */
export type Group = ProjectItem & Sortable;

/** Creates a new group template with the provided name. */
export function createDefaultGroup(name: string): Group {
  return { id: generateId(), name, sequence: [] };
}
