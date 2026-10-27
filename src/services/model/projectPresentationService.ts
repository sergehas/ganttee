import { formatIsoTimestamp } from "@common/dates";
import { ProjectSnapshot } from "@common/models";
import { EffectiveSchedulePresentation, ProjectPresentation } from "@common/presentation/project";
import { projectCriticalPath } from "@services/dependency-graph/criticalPathService";
import { toDocument } from "@services/model/projectModelService";

/** Builds the versionless UI transport projection for one project snapshot. */
export function toProjectPresentation(snapshot: ProjectSnapshot): ProjectPresentation {
  const document = toDocument(snapshot.model);
  const taskSchedules = new Map(snapshot.tasks.map((task) => [task.item.id, task.effective]));
  const milestoneSchedules = new Map(
    snapshot.milestones.map((milestone) => [milestone.item.id, milestone.effective]),
  );
  const groupSchedules = new Map(snapshot.groups.map((group) => [group.item.id, group.effective]));
  const criticalPath =
    snapshot.schedule === undefined
      ? { nodeIds: [], dependencyIds: [] }
      : projectCriticalPath(snapshot.model.graph, snapshot.schedule);

  return {
    tasks: document.tasks.map((task) => ({
      ...task,
      ...presentEffectiveSchedule(taskSchedules.get(task.id)),
    })),
    milestones: document.milestones.map((milestone) => ({
      ...milestone,
      ...presentEffectiveSchedule(milestoneSchedules.get(milestone.id)),
    })),
    groups: document.groups.map((group) => ({
      ...group,
      ...presentEffectiveSchedule(groupSchedules.get(group.id)),
    })),
    dependencies: document.dependencies,
    sequence: document.sequence,
    settings: document.settings,
    view: document.view,
    criticalPath,
  };
}

/** Converts effective dates to JSON-compatible transport fields. */
function presentEffectiveSchedule(
  effective: { start: Date; end: Date; duration: number } | undefined,
): EffectiveSchedulePresentation {
  if (effective === undefined) {
    return {};
  }
  return {
    effectiveStart: formatIsoTimestamp(effective.start),
    effectiveEnd: formatIsoTimestamp(effective.end),
    effectiveDuration: effective.duration,
  };
}
