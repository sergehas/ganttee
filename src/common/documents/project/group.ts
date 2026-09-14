import { ProjectItem } from "./projectItem";

/** A persisted named collection of project items. */
export interface Group extends ProjectItem {
  /** Whether the group is collapsed in the UI. */
  collapsed?: boolean;
}
