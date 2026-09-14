import { ProjectScheduleDocument } from "../project-schedule/projectScheduleDocument";
import { Dependency } from "./dependency";
import { Group } from "./group";
import { Milestone } from "./milestone";
import { ProjectSettings, resolveProjectSettings } from "./projectSettings";
import { ProjectView, resolveProjectView } from "./projectView";
import { Task } from "./task";

/** Current on-disk schema version for `.ganttee` documents. */
export const CURRENT_DOCUMENT_VERSION = 2;

/** The serialized shape of a `.ganttee` project. */
export interface ProjectDocument {
  /** Schema version. */
  version: number;
  /** Authored tasks. */
  tasks: Task[];
  /** Authored groups. */
  groups: Group[];
  /** Authored milestones. */
  milestones: Milestone[];
  /** Authored dependencies. */
  dependencies: Dependency[];
  /** Transient schedule projection used only by host/webview messages. */
  schedule?: ProjectScheduleDocument;
  /** Resolved project-level scheduling settings. */
  settings: ProjectSettings;
  /** Resolved chart view preferences. */
  view: ProjectView;
}

/** Creates an empty project document at the current schema version. */
export function createEmptyDocument(): ProjectDocument {
  return {
    version: CURRENT_DOCUMENT_VERSION,
    tasks: [],
    groups: [],
    milestones: [],
    dependencies: [],
    settings: resolveProjectSettings(),
    view: resolveProjectView(),
  };
}
