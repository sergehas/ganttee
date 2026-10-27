import { Dependency } from "@common/documents/project/dependency";
import { ProjectSettings } from "@common/documents/project/projectSettings";
import { ProjectView } from "@common/documents/project/projectView";
import { ProjectDependencyGraph } from "@common/models/dependency-graph/projectDependencyGraph";
import { Group } from "@common/models/project/group";
import { Milestone } from "@common/models/project/milestone";
import { Task } from "@common/models/project/task";

/** Raised when scheduling cannot produce a complete valid model. */
export class SchedulingError extends Error {}

/** In-memory hydrated representation of a project document. */
export class ProjectModel {
  /**
   * @param tasks Hydrated task models.
   * @param milestones Hydrated milestone models.
   * @param groups Hydrated group models.
   * @param dependencies Authored dependencies.
   * @param version The document schema version.
   * @param graph The normalized structural dependency graph.
   * @param settings Resolved project-level scheduling settings.
   * @param view Resolved chart view preferences.
   * @param sequence Ordered root direct-child ids.
   */
  constructor(
    readonly tasks: readonly Task[],
    readonly milestones: readonly Milestone[],
    readonly groups: readonly Group[],
    readonly dependencies: readonly Dependency[],
    readonly version: number,
    readonly graph: ProjectDependencyGraph,
    readonly settings: ProjectSettings,
    readonly view: ProjectView,
    readonly sequence: readonly string[],
  ) {}
}
