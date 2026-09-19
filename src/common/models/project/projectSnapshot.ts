import { Group, ScheduledGroup } from "@common/models/project/group";
import { Milestone } from "@common/models/project/milestone";
import { ProjectModel } from "@common/models/project/projectModel";
import { ProjectSchedule } from "@common/models/project/projectSchedule";
import { ScheduleDiagnostic } from "@common/models/project/scheduleDiagnostic";
import { Task } from "@common/models/project/task";

/** Effective schedule values attached to one project item. */
export interface EffectiveSchedule {
  /** Computed effective start. */
  readonly start: Date;
  /** Computed effective end. */
  readonly end: Date;
  /** Computed duration in working days. */
  readonly duration: number;
}

/** A task and its optional effective schedule. */
export interface ProjectTaskSnapshot {
  /** Entity discriminator. */
  readonly kind: "task";
  /** Hydrated authored task. */
  readonly item: Task;
  /** Effective values when scheduling succeeded. */
  readonly effective?: EffectiveSchedule;
}

/** A milestone and its optional effective schedule. */
export interface ProjectMilestoneSnapshot {
  /** Entity discriminator. */
  readonly kind: "milestone";
  /** Hydrated authored milestone. */
  readonly item: Milestone;
  /** Effective values when scheduling succeeded. */
  readonly effective?: EffectiveSchedule;
}

/** A group and its optional rolled-up schedule. */
export interface ProjectGroupSnapshot {
  /** Entity discriminator. */
  readonly kind: "group";
  /** Hydrated authored group. */
  readonly item: Group;
  /** Effective values when scheduled descendants exist. */
  readonly effective?: EffectiveSchedule;
}

/** A project item paired with its current computed schedule. */
export type ProjectItemSnapshot =
  ProjectTaskSnapshot | ProjectMilestoneSnapshot | ProjectGroupSnapshot;

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
      effective: effectiveScheduleOf(taskSchedules.get(item.id)),
    }));
    this.milestones = model.milestones.map((item) => ({
      kind: "milestone",
      item,
      effective: effectiveScheduleOf(milestoneSchedules.get(item.id)),
    }));
    this.groups = model.groups.map((item) => ({
      kind: "group",
      item,
      effective: effectiveGroupScheduleOf(groupSchedules.get(item.id)),
    }));
    this.itemsById = new Map(
      [...this.tasks, ...this.milestones, ...this.groups].map((item) => [item.item.id, item]),
    );
  }

  /** Returns one item and its schedule by stable id. */
  item(id: string): ProjectItemSnapshot | undefined {
    return this.itemsById.get(id);
  }
}

/** Copies effective values from a scheduled task or milestone. */
function effectiveScheduleOf(
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
function effectiveGroupScheduleOf(
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
