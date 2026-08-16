import { addDays, formatIsoDate, parseIsoDate } from "../common/dates";
import {
  Dependency,
  DependencyType,
  GanttDocument,
  Group,
  Milestone,
  Task,
  UnresolvableScheduleError,
} from "../common/models";
import {
  EditableEntityKind,
  EditableEntityMap,
  EditableEntityRef,
} from "../common/protocol";
import { hydrateDocument } from "./ganttModelService";

/** Optional behavior flags for save actions initiated by the webview. */
export interface SaveEntityOptions {
  keepEditorOpen?: boolean;
}

/** A typed entity update routed through the shared edit workflow. */
export type EditableEntityUpdate = {
  [K in EditableEntityKind]: {
    kind: K;
    entity: EditableEntityMap[K];
    options?: SaveEntityOptions;
  };
}[EditableEntityKind];

/** Partial schedule patch emitted by direct chart interactions. */
export interface EntityDatePatch {
  start?: string;
  end?: string;
  date?: string;
}

/**
 * Returns whether the provided entity draft is valid for saving.
 *
 * This enforces the same core edit guards regardless of whether the mutation
 * originates from the form or from direct chart manipulation.
 */
export function canSaveEntity(
  kind: EditableEntityKind,
  entity: EditableEntityMap[EditableEntityKind],
): boolean {
  switch (kind) {
    case "task":
      return canSaveTask(entity as Task);
    case "milestone":
      return canSaveMilestone(entity as Milestone);
    case "group":
      return canSaveGroup(entity as Group);
  }
}

/**
 * Returns a save update when the entity draft passes workflow validation.
 *
 * @returns The typed update payload, or `undefined` when the draft is invalid.
 */
export function buildSaveUpdate(
  kind: EditableEntityKind,
  entity: EditableEntityMap[EditableEntityKind],
  options?: SaveEntityOptions,
): EditableEntityUpdate | undefined {
  if (!canSaveEntity(kind, entity)) {
    return undefined;
  }
  switch (kind) {
    case "task":
      return { kind, entity: entity as Task, options };
    case "milestone":
      return { kind, entity: entity as Milestone, options };
    case "group":
      return { kind, entity: entity as Group, options };
  }
}

/**
 * Builds an ungroup update for a task, milestone, or group if the entity exists.
 *
 * @returns The typed update payload with `groupId` cleared, or `undefined` when
 * the entity cannot be found in the document.
 */
export function buildUngroupUpdate(
  document: GanttDocument,
  ref: EditableEntityRef,
  options?: SaveEntityOptions,
): EditableEntityUpdate | undefined {
  if (ref.kind === "task") {
    const task = document.tasks.find((entity) => entity.id === ref.id);
    if (!task) {
      return undefined;
    }
    return {
      kind: "task",
      entity: { ...task, groupId: undefined },
      options,
    };
  }

  if (ref.kind === "group") {
    const group = document.groups.find((entity) => entity.id === ref.id);
    if (!group) {
      return undefined;
    }
    return {
      kind: "group",
      entity: { ...group, groupId: undefined },
      options,
    };
  }

  const milestone = document.milestones.find((entity) => entity.id === ref.id);
  if (!milestone) {
    return undefined;
  }
  return {
    kind: "milestone",
    entity: { ...milestone, groupId: undefined },
    options,
  };
}

/**
 * Builds a dependency payload owned by `ownerId`.
 *
 * @returns A dependency to persist, or `undefined` when required values are missing.
 */
export function buildDependency(
  ownerId: string | undefined,
  targetId: string,
  type: DependencyType,
  createId: () => string,
): Dependency | undefined {
  if (!ownerId || !targetId) {
    return undefined;
  }
  return {
    id: createId(),
    sourceId: ownerId,
    targetId,
    type,
  };
}

/**
 * Builds an entity update from a direct chart date edit.
 *
 * Tasks consume `start`/`end` values; milestones consume `date` (or fall back
 * to `start`/`end` for timeline gestures that supply only one date field).
 */
export function buildDatePatchUpdate(
  document: GanttDocument,
  ref: EditableEntityRef,
  patch: EntityDatePatch,
  options?: SaveEntityOptions,
): EditableEntityUpdate | undefined {
  if (ref.kind === "task") {
    const task = document.tasks.find((entity) => entity.id === ref.id);
    if (!task) {
      return undefined;
    }
    const updatedTask: Task = {
      ...task,
      start: patch.start ?? task.start,
      end: patch.end ?? task.end,
    };
    return buildSaveUpdate("task", updatedTask, options);
  }

  if (ref.kind === "milestone") {
    const milestone = document.milestones.find(
      (entity) => entity.id === ref.id,
    );
    if (!milestone) {
      return undefined;
    }
    const date = patch.date ?? patch.start ?? patch.end;
    if (!date) {
      return undefined;
    }
    const updatedMilestone: Milestone = {
      ...milestone,
      date,
    };
    return buildSaveUpdate("milestone", updatedMilestone, options);
  }

  return undefined;
}

/**
 * Creates a deterministic-looking dependency id for client-side draft creation.
 */
export function createDependencyId(): string {
  return `dep-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Builds a date patch that shifts an entity schedule by calendar days.
 *
 * Tasks shift both defined endpoints; milestones shift their canonical date.
 */
export function buildShiftByDaysPatch(
  document: GanttDocument,
  ref: EditableEntityRef,
  days: number,
): EntityDatePatch | undefined {
  if (ref.kind === "task") {
    const task = document.tasks.find((entity) => entity.id === ref.id);
    if (!task) {
      return undefined;
    }
    const start = task.start
      ? formatIsoDate(addDays(parseIsoDate(task.start), days))
      : undefined;
    const end = task.end
      ? formatIsoDate(addDays(parseIsoDate(task.end), days))
      : undefined;
    if (!start && !end) {
      return undefined;
    }
    return { start, end };
  }

  if (ref.kind === "milestone") {
    const milestone = document.milestones.find(
      (entity) => entity.id === ref.id,
    );
    if (!milestone) {
      return undefined;
    }
    return {
      date: formatIsoDate(addDays(parseIsoDate(milestone.date), days)),
    };
  }

  return undefined;
}

/**
 * Builds the next document after deleting a task or milestone. Every dependency
 * connected to the deleted entity is removed. For an incoming `startWith` or
 * `endWith` dependency, the surviving source task materializes its effective
 * endpoint before its constraint is removed.
 *
 * @param document The current document.
 * @param kind The kind of schedulable entity to delete.
 * @param entityId The id of the task or milestone to delete.
 * @returns The document after deletion, or `undefined` when the entity is absent.
 */
export function buildTaskOrMilestoneDeletionDocument(
  document: GanttDocument,
  kind: "task" | "milestone",
  entityId: string,
): GanttDocument | undefined {
  const entities = kind === "task" ? document.tasks : document.milestones;
  if (!entities.some((entity) => entity.id === entityId)) {
    return undefined;
  }

  const model = hydrateDocument(document);
  const deletedEntity =
    kind === "task"
      ? model.tasks.find((task) => task.id === entityId)
      : model.milestones.find((milestone) => milestone.id === entityId);
  if (!deletedEntity) {
    return undefined;
  }
  const taskUpdates = new Map<string, Partial<Pick<Task, "start" | "end">>>();
  for (const dependency of document.dependencies) {
    if (dependency.targetId !== entityId) {
      continue;
    }
    const sourceTask = model.tasks.find(
      (task) => task.id === dependency.sourceId,
    );
    if (!sourceTask) {
      continue;
    }
    const update = taskUpdates.get(sourceTask.id) ?? {};
    if (dependency.type === "startWith") {
      const start = resolveEffectiveStart(deletedEntity);
      if (start !== undefined) {
        update.start = start;
      }
    }
    if (dependency.type === "endWith") {
      const end = resolveEffectiveEnd(deletedEntity);
      if (end !== undefined) {
        update.end = end;
      }
    }
    taskUpdates.set(sourceTask.id, update);
  }

  return {
    ...document,
    tasks: document.tasks
      .filter((task) => kind !== "task" || task.id !== entityId)
      .map((task) => ({ ...task, ...taskUpdates.get(task.id) })),
    milestones: document.milestones.filter(
      (milestone) => kind !== "milestone" || milestone.id !== entityId,
    ),
    dependencies: document.dependencies.filter(
      (dependency) =>
        dependency.sourceId !== entityId && dependency.targetId !== entityId,
    ),
  };
}

/** Resolves an entity's effective start without propagating under-constraint errors. */
function resolveEffectiveStart(entity: {
  effectiveStart: () => Date;
}): string | undefined {
  try {
    return formatIsoDate(entity.effectiveStart());
  } catch (error) {
    if (error instanceof UnresolvableScheduleError) {
      return undefined;
    }
    throw error;
  }
}

/** Resolves an entity's effective end without propagating under-constraint errors. */
function resolveEffectiveEnd(entity: {
  effectiveEnd: () => Date;
}): string | undefined {
  try {
    return formatIsoDate(entity.effectiveEnd());
  } catch (error) {
    if (error instanceof UnresolvableScheduleError) {
      return undefined;
    }
    throw error;
  }
}

/** Returns whether a task draft passes save guards. */
function canSaveTask(task: Task): boolean {
  if (
    task.start !== undefined &&
    task.end !== undefined &&
    task.start > task.end
  ) {
    return false;
  }
  return true;
}

/** Returns whether a milestone draft passes save guards. */
function canSaveMilestone(milestone: Milestone): boolean {
  return milestone.date.length > 0;
}

/** Returns whether a group draft passes save guards. */
function canSaveGroup(group: Group): boolean {
  return group.groupId !== group.id;
}
