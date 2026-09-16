import { ProjectScheduleDocument } from "@common/documents/project-schedule/projectScheduleDocument";
import { Dependency } from "@common/documents/project/dependency";
import { Group } from "@common/documents/project/group";
import { Milestone } from "@common/documents/project/milestone";
import { ProjectSettings, resolveProjectSettings } from "@common/documents/project/projectSettings";
import { ProjectView, resolveProjectView } from "@common/documents/project/projectView";
import { Task } from "@common/documents/project/task";

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
