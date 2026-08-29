/**
 * Removal of a single entity from its group or from the document.
 *
 * Deleting a schedulable entity also deletes the constraints that referenced
 * it. Where a surviving task was aligned to the deleted entity, that alignment
 * is materialized as a static date before the constraint disappears, so the
 * survivor keeps the schedule the user could see.
 */

import { formatIsoDate } from "../common/dates";
import {
  GanttDocument,
  Task,
  UnresolvableScheduleError,
} from "../common/models";
import { EditableEntityRef } from "../common/protocol";
import { findEntity } from "./documentEntityService";
import {
  EditableEntityUpdate,
  SaveEntityOptions,
} from "./entitySaveGuardService";
import { hydrateDocument } from "./ganttModelService";

/**
 * Detaches an entity from its group.
 *
 * @param document The document holding the entity.
 * @param ref The entity to detach.
 * @param options Behavior flags for the save.
 * @returns The update payload, or `undefined` when the entity is absent.
 */
export function buildUngroupUpdate(
  document: GanttDocument,
  ref: EditableEntityRef,
  options?: SaveEntityOptions,
): EditableEntityUpdate | undefined {
  const entity = findEntity(document, ref.kind, ref.id);
  if (!entity) {
    return undefined;
  }
  return {
    kind: ref.kind,
    entity: { ...entity, groupId: undefined },
    options,
  } as EditableEntityUpdate;
}

/**
 * Removes a task or milestone along with every dependency that touched it.
 *
 * @param document The current document.
 * @param kind The kind of schedulable entity to delete.
 * @param entityId The id of the task or milestone to delete.
 * @returns The document after deletion, or `undefined` when the entity is
 * absent or a survivor's schedule cannot be resolved.
 */
export function buildTaskOrMilestoneDeletionDocument(
  document: GanttDocument,
  kind: "task" | "milestone",
  entityId: string,
): GanttDocument | undefined {
  if (!findEntity(document, kind, entityId)) {
    return undefined;
  }

  const model = hydrateDocument(document);
  const deleted =
    kind === "task"
      ? model.tasks.find((task) => task.id === entityId)
      : model.milestones.find((milestone) => milestone.id === entityId);
  if (!deleted) {
    return undefined;
  }

  const survivorDates = materializeSurvivorDates(
    document,
    model,
    deleted,
    entityId,
  );
  if (!survivorDates) {
    return undefined;
  }

  return {
    ...document,
    tasks: document.tasks
      .filter((task) => kind !== "task" || task.id !== entityId)
      .map((task) => ({ ...task, ...survivorDates.get(task.id) })),
    milestones: document.milestones.filter(
      (milestone) => kind !== "milestone" || milestone.id !== entityId,
    ),
    dependencies: document.dependencies.filter(
      (dependency) =>
        dependency.sourceId !== entityId && dependency.targetId !== entityId,
    ),
  };
}

/** Endpoints a survivor must keep once its alignment constraint is removed. */
type SurvivorDates = ReadonlyMap<string, Partial<Pick<Task, "start" | "end">>>;

/**
 * Freezes the endpoints that surviving tasks inherited from the deleted entity.
 * Returns `undefined` when the deleted entity's own schedule is unresolvable.
 */
function materializeSurvivorDates(
  document: GanttDocument,
  model: ReturnType<typeof hydrateDocument>,
  deleted: { effectiveStart: () => Date; effectiveEnd: () => Date },
  entityId: string,
): SurvivorDates | undefined {
  const dates = new Map<string, Partial<Pick<Task, "start" | "end">>>();

  for (const dependency of document.dependencies) {
    if (
      dependency.targetId !== entityId ||
      !model.tasks.some((task) => task.id === dependency.sourceId)
    ) {
      continue;
    }
    const update = dates.get(dependency.sourceId) ?? {};
    if (dependency.type === "startWith") {
      const start = resolveIsoDate(() => deleted.effectiveStart());
      if (start === undefined) {
        return undefined;
      }
      update.start = start;
    }
    if (dependency.type === "endWith") {
      const end = resolveIsoDate(() => deleted.effectiveEnd());
      if (end === undefined) {
        return undefined;
      }
      update.end = end;
    }
    dates.set(dependency.sourceId, update);
  }

  return dates;
}

/** Resolves an effective date, reporting an under-constrained schedule as absent. */
function resolveIsoDate(resolve: () => Date): string | undefined {
  try {
    return formatIsoDate(resolve());
  } catch (error) {
    if (error instanceof UnresolvableScheduleError) {
      return undefined;
    }
    throw error;
  }
}
