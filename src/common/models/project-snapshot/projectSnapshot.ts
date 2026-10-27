import { ProjectSchedule } from "@common/models/project-schedule/projectSchedule";
import { EffectiveSchedule } from "@common/models/project-snapshot/effectiveSchedule";
import { ProjectGroupSnapshot } from "@common/models/project-snapshot/projectGroupSnapshot";
import { ProjectItemSnapshot } from "@common/models/project-snapshot/projectItemSnapshot";
import { ProjectMilestoneSnapshot } from "@common/models/project-snapshot/projectMilestoneSnapshot";
import { ProjectTaskSnapshot } from "@common/models/project-snapshot/projectTaskSnapshot";
import { ScheduledGroup } from "@common/models/project/group";
import { ProjectModel } from "@common/models/project/projectModel";
import { ScheduleDiagnostic } from "@common/models/project/scheduleDiagnostic";

/** Immutable facade over hydrated, scheduled, and diagnostic project state. */
export class ProjectSnapshot {
  /** Tasks paired with their effective schedules. */
  readonly tasks: readonly ProjectTaskSnapshot[];
  /** Milestones paired with their effective schedules. */
  readonly milestones: readonly ProjectMilestoneSnapshot[];
  /** Groups paired with their rolled-up schedules. */
  readonly groups: readonly ProjectGroupSnapshot[];
  /** Fast item lookup shared by host consumers. */
  private readonly itemsById: ReadonlyMap<string, ProjectItemSnapshot>;

  /**
   * @param model Hydrated authored project state.
   * @param schedule Computed schedule when scheduling succeeded.
   * @param diagnostics Current semantic diagnostics.
   */
  constructor(
    readonly model: ProjectModel,
    readonly schedule: ProjectSchedule | undefined,
    readonly diagnostics: readonly ScheduleDiagnostic[],
  ) {
    const taskSchedules = new Map(schedule?.tasks.map((task) => [task.id, task]));
    const milestoneSchedules = new Map(
      schedule?.milestones.map((milestone) => [milestone.id, milestone]),
    );
    const groupSchedules = new Map(schedule?.groups.map((group) => [group.id, group]));
    this.tasks = model.tasks.map((item) => ({
      kind: "task",
      item,
      effective: ProjectSnapshot.effectiveScheduleOf(taskSchedules.get(item.id)),
    }));
    this.milestones = model.milestones.map((item) => ({
      kind: "milestone",
      item,
      effective: ProjectSnapshot.effectiveScheduleOf(milestoneSchedules.get(item.id)),
    }));
    this.groups = model.groups.map((item) => ({
      kind: "group",
      item,
      effective: ProjectSnapshot.effectiveGroupScheduleOf(groupSchedules.get(item.id)),
    }));
    this.itemsById = new Map(
      [...this.tasks, ...this.milestones, ...this.groups].map((item) => [item.item.id, item]),
    );
  }

  /** Returns one item and its schedule by stable id. */
  item(id: string): ProjectItemSnapshot | undefined {
    return this.itemsById.get(id);
  }

  /** Copies effective values from a scheduled task or milestone. */
  private static effectiveScheduleOf(
    item: { effectiveStart(): Date; effectiveEnd(): Date; effectiveDuration(): number } | undefined,
  ): EffectiveSchedule | undefined {
    if (item === undefined) {
      return undefined;
    }
    return {
      start: item.effectiveStart(),
      end: item.effectiveEnd(),
      duration: item.effectiveDuration(),
    };
  }

  /** Copies effective values from a scheduled group. */
  private static effectiveGroupScheduleOf(
    group: ScheduledGroup | undefined,
  ): EffectiveSchedule | undefined {
    if (group === undefined) {
      return undefined;
    }
    return {
      start: new Date(group.effectiveStart.getTime()),
      end: new Date(group.effectiveEnd.getTime()),
      duration: group.effectiveDuration,
    };
  }
}
