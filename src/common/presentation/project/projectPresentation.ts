import { Dependency, ProjectContent, ProjectSettings, ProjectView } from "@common/documents";
import { CriticalPathPresentation } from "@common/presentation/project/criticalPathPresentation";
import {
  GroupPresentation,
  MilestonePresentation,
  TaskPresentation,
} from "@common/presentation/project/projectItemPresentation";

/** Versionless, UI-ready projection sent across the webview boundary. */
export interface ProjectPresentation extends ProjectContent {
  /** Presented tasks. */
  tasks: TaskPresentation[];
  /** Presented milestones. */
  milestones: MilestonePresentation[];
  /** Presented groups. */
  groups: GroupPresentation[];
  /** Authored dependencies. */
  dependencies: Dependency[];
  /** Resolved scheduling settings. */
  readonly settings: ProjectSettings;
  /** Persisted chart preferences. */
  readonly view: ProjectView;
  /** Host-computed critical path. */
  readonly criticalPath: CriticalPathPresentation;
}
