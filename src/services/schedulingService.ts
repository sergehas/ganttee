import {
  addWorkingDays,
  diffInWorkingDays,
  normalizeToWorkingTime,
  subtractWorkingDays,
  WorkingTimeSettings,
} from "../common/dates";
import {
  Dependency,
  DependencyGraph,
  GanttModel,
  GroupEntity,
  MilestoneEntity,
  Schedulable,
  ScheduledGroupEntity,
  ScheduledMilestoneEntity,
  ScheduledModel,
  ScheduledTaskEntity,
  SchedulingError,
  TaskEntity,
} from "../common/models";

/** Default number of working hours in one duration day. */
const DEFAULT_WORKING_DAY_HOURS = 8;

/** Default UTC decimal hour at which work begins. */
const DEFAULT_WORKING_DAY_START = 9;

/** Effective endpoint candidates collected from dependencies. */
interface EndpointCandidates {
  /** Candidate effective starts. */
  readonly starts: readonly Date[];
  /** Candidate effective ends. */
  readonly ends: readonly Date[];
}

/** Fully resolved task values before projection into a domain entity. */
interface ResolvedTaskSchedule {
  /** Effective UTC start. */
  readonly start: Date;
  /** Effective UTC end. */
  readonly end: Date;
  /** Effective duration in working days. */
  readonly duration: number;
}

/** Mutable date span used while rolling up a group hierarchy. */
interface DateSpan {
  /** Earliest effective descendant start. */
  start: number;
  /** Latest effective descendant end. */
  end: number;
}

/**
 * Computes every task and milestone in one topological graph pass.
 *
 * @param model The hydrated authoring model.
 * @param graph The normalized Graphology dependency graph from the model.
 * @returns A complete immutable schedule.
 * @throws {SchedulingError} When any entity or calendar setting is invalid.
 */
export function schedule(
  model: GanttModel,
  graph: DependencyGraph,
): ScheduledModel {
  const settings = workingTimeSettings(model);
  const entities = new Map<string, TaskEntity | MilestoneEntity>([
    ...model.tasks.map((task) => [task.id, task] as const),
    ...model.milestones.map((milestone) => [milestone.id, milestone] as const),
  ]);
  const scheduled = new Map<string, Schedulable>();
  const tasks: ScheduledTaskEntity[] = [];
  const milestones: ScheduledMilestoneEntity[] = [];

  for (const entityId of graph.topologicalSort()) {
    const entity = entities.get(entityId);
    if (entity === undefined) {
      throw new SchedulingError(`Unknown schedulable entity "${entityId}".`);
    }
    const candidates = dependencyCandidates(
      graph.dependenciesOf(entityId),
      scheduled,
      settings,
    );
    if (entity instanceof TaskEntity) {
      const values = resolveTask(entity, candidates, settings);
      const result = new ScheduledTaskEntity(
        entity,
        values.start,
        values.end,
        values.duration,
      );
      tasks.push(result);
      scheduled.set(entityId, result);
    } else {
      const date = resolveMilestone(entity, candidates, settings);
      const result = new ScheduledMilestoneEntity(entity, date);
      milestones.push(result);
      scheduled.set(entityId, result);
    }
  }

  if (scheduled.size !== entities.size) {
    throw new SchedulingError(
      "The dependency graph omitted a schedulable entity.",
    );
  }
  return new ScheduledModel(
    tasks,
    milestones,
    rollupGroupSchedules(model.groups, tasks, milestones, settings),
  );
}

/**
 * Rolls group dates up from direct entities and nested groups in post-order.
 * Groups without any scheduled descendants are omitted.
 *
 * @param groups The authoring group hierarchy.
 * @param scheduledModel The completed task and milestone schedule.
 */
export function rollupGroupSchedules(
  groups: readonly GroupEntity[],
  tasks: readonly ScheduledTaskEntity[],
  milestones: readonly ScheduledMilestoneEntity[],
  settings: WorkingTimeSettings = defaultWorkingTimeSettings(),
): readonly ScheduledGroupEntity[] {
  const spans = new Map<string, DateSpan>();
  for (const entity of [...tasks, ...milestones]) {
    if (entity.groupId !== undefined) {
      mergeSpan(spans, entity.groupId, {
        start: entity.effectiveStart().getTime(),
        end: entity.effectiveEnd().getTime(),
      });
    }
  }

  const groupsByParent = groupChildren(groups);
  const result: ScheduledGroupEntity[] = [];
  const visited = new Set<string>();
  const visit = (group: GroupEntity): DateSpan | undefined => {
    if (visited.has(group.id)) {
      return spans.get(group.id);
    }
    visited.add(group.id);
    for (const child of groupsByParent.get(group.id) ?? []) {
      const childSpan = visit(child);
      if (childSpan !== undefined) {
        mergeSpan(spans, group.id, childSpan);
      }
    }
    const span = spans.get(group.id);
    if (span !== undefined) {
      result.push({
        id: group.id,
        name: group.name,
        groupId: group.groupId,
        effectiveStart: new Date(span.start),
        effectiveEnd: new Date(span.end),
        effectiveDuration: diffInWorkingDays(
          new Date(span.start),
          new Date(span.end),
          settings,
        ),
      });
    }
    return span;
  };

  for (const group of groups) {
    visit(group);
  }
  return result;
}

/** Returns the default working-time settings used by standalone rollup calls. */
function defaultWorkingTimeSettings(): WorkingTimeSettings {
  return {
    daysOff: new Set<number>(),
    workingDayHours: DEFAULT_WORKING_DAY_HOURS,
    workingDayStart: DEFAULT_WORKING_DAY_START,
  };
}

/** Resolves and validates project working-time settings. */
function workingTimeSettings(model: GanttModel): WorkingTimeSettings {
  const workingDayHours =
    model.settings?.workingDayHours ?? DEFAULT_WORKING_DAY_HOURS;
  const workingDayStart =
    model.settings?.workingDayStart ?? DEFAULT_WORKING_DAY_START;
  const daysOff = new Set(model.settings?.workingCalendar?.daysOff ?? []);
  if (
    !Number.isFinite(workingDayHours) ||
    workingDayHours <= 0 ||
    workingDayHours > 24 ||
    !Number.isFinite(workingDayStart) ||
    workingDayStart < 0 ||
    workingDayStart >= 24 ||
    [...daysOff].some((day) => !Number.isInteger(day) || day < 1 || day > 7) ||
    daysOff.size === 7
  ) {
    throw new SchedulingError("Invalid working-time settings.");
  }
  return { daysOff, workingDayHours, workingDayStart };
}

/** Collects effective endpoint candidates from dependencies owned by a source. */
function dependencyCandidates(
  dependencies: readonly Dependency[],
  scheduled: ReadonlyMap<string, Schedulable>,
  settings: WorkingTimeSettings,
): EndpointCandidates {
  const starts: Date[] = [];
  const ends: Date[] = [];
  for (const dependency of dependencies) {
    const target = scheduled.get(dependency.targetId);
    if (target === undefined) {
      throw new SchedulingError(
        `Dependency "${dependency.id}" target is not scheduled.`,
      );
    }
    if (dependency.type === "startAfter") {
      starts.push(normalizeToWorkingTime(target.effectiveEnd(), settings));
    } else if (dependency.type === "startWith") {
      starts.push(target.effectiveStart());
    } else {
      ends.push(target.effectiveEnd());
    }
  }
  return { starts, ends };
}

/** Resolves one task from static values and dependency candidates. */
function resolveTask(
  task: TaskEntity,
  candidates: EndpointCandidates,
  settings: WorkingTimeSettings,
): ResolvedTaskSchedule {
  const dependencyStart = maximumDate(candidates.starts);
  const dependencyEnd = maximumDate(candidates.ends);
  const staticStart =
    task.start === undefined
      ? undefined
      : normalizeToWorkingTime(task.start, settings);
  const staticEnd = task.end;
  const start = dependencyStart ?? staticStart;
  const end = dependencyEnd ?? staticEnd;
  const duration = task.duration;

  validateDuration(task.id, duration);
  if (start !== undefined && end !== undefined) {
    if (start.getTime() > end.getTime()) {
      throw new SchedulingError(`Task "${task.id}" starts after it ends.`);
    }
    return {
      start,
      end,
      duration: duration ?? diffInWorkingDays(start, end, settings),
    };
  }
  if (start !== undefined) {
    const effectiveDuration = duration ?? 1;
    return {
      start,
      end: addWorkingDays(start, effectiveDuration, settings),
      duration: effectiveDuration,
    };
  }
  if (end !== undefined) {
    const effectiveDuration = duration ?? 1;
    return {
      start: subtractWorkingDays(end, effectiveDuration, settings),
      end,
      duration: effectiveDuration,
    };
  }
  throw new SchedulingError(`Task "${task.id}" is under-constrained.`);
}

/** Resolves one milestone date from dependency and static candidates. */
function resolveMilestone(
  milestone: MilestoneEntity,
  candidates: EndpointCandidates,
  settings: WorkingTimeSettings,
): Date {
  const dependencyDate = maximumDate([
    ...candidates.starts,
    ...candidates.ends,
  ]);
  if (dependencyDate !== undefined) {
    return dependencyDate;
  }
  if (milestone.date !== undefined) {
    return normalizeToWorkingTime(milestone.date, settings);
  }
  throw new SchedulingError(
    `Milestone "${milestone.id}" is under-constrained.`,
  );
}

/** Rejects invalid static task durations. */
function validateDuration(taskId: string, duration: number | undefined): void {
  if (duration !== undefined && (!Number.isFinite(duration) || duration <= 0)) {
    throw new SchedulingError(`Task "${taskId}" has an invalid duration.`);
  }
}

/** Returns a copy of the greatest timestamp, or undefined for no candidates. */
function maximumDate(dates: readonly Date[]): Date | undefined {
  if (dates.length === 0) {
    return undefined;
  }
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

/** Indexes direct child groups by parent id. */
function groupChildren(
  groups: readonly GroupEntity[],
): ReadonlyMap<string, readonly GroupEntity[]> {
  const children = new Map<string, GroupEntity[]>();
  for (const group of groups) {
    if (group.groupId !== undefined) {
      const siblings = children.get(group.groupId) ?? [];
      siblings.push(group);
      children.set(group.groupId, siblings);
    }
  }
  return children;
}

/** Merges a date span into the span stored for a group id. */
function mergeSpan(
  spans: Map<string, DateSpan>,
  groupId: string,
  candidate: DateSpan,
): void {
  const current = spans.get(groupId);
  if (current === undefined) {
    spans.set(groupId, { ...candidate });
    return;
  }
  current.start = Math.min(current.start, candidate.start);
  current.end = Math.max(current.end, candidate.end);
}
