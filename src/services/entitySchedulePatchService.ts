/**
 * Schedule edits that come from direct chart gestures rather than the form.
 *
 * A gesture yields dates, not a whole entity, so these builders merge the dates
 * into the current entity and route the result through the save guards.
 */

import { addDays, formatIsoDate, parseIsoDate } from "../common/dates";
import { GanttDocument, Milestone, Task } from "../common/models";
import { EditableEntityRef } from "../common/protocol";
import { findEntity } from "./documentEntityService";
import {
  buildSaveUpdate,
  EditableEntityUpdate,
  SaveEntityOptions,
} from "./entitySaveGuardService";

/** Partial schedule patch emitted by direct chart interactions. */
export interface EntityDatePatch {
  start?: string;
  end?: string;
  date?: string;
}

/**
 * Applies a date patch to an entity and validates the result.
 *
 * Tasks consume `start`/`end`; milestones consume `date`, falling back to
 * `start`/`end` for gestures that supply only one of them.
 *
 * @param document The document holding the entity.
 * @param ref The entity being edited.
 * @param patch The dates the gesture produced.
 * @param options Behavior flags for the save.
 * @returns The update payload, or `undefined` when the edit cannot be applied.
 */
export function buildDatePatchUpdate(
  document: GanttDocument,
  ref: EditableEntityRef,
  patch: EntityDatePatch,
  options?: SaveEntityOptions,
): EditableEntityUpdate | undefined {
  if (ref.kind === "task") {
    const task = findEntity(document, "task", ref.id);
    if (!task) {
      return undefined;
    }
    const updated: Task = {
      ...task,
      start: patch.start ?? task.start,
      end: patch.end ?? task.end,
    };
    return buildSaveUpdate("task", updated, options, document.dependencies);
  }

  if (ref.kind === "milestone") {
    const milestone = findEntity(document, "milestone", ref.id);
    const date = patch.date ?? patch.start ?? patch.end;
    if (!milestone || milestone.date === undefined || !date) {
      return undefined;
    }
    const updated: Milestone = { ...milestone, date };
    return buildSaveUpdate(
      "milestone",
      updated,
      options,
      document.dependencies,
    );
  }

  return undefined;
}

/**
 * Shifts an entity's schedule by a number of calendar days.
 *
 * Tasks shift whichever endpoints they define; milestones shift their date.
 *
 * @param document The document holding the entity.
 * @param ref The entity being shifted.
 * @param days The offset in calendar days; may be negative.
 * @returns The resulting dates, or `undefined` when there is nothing to shift.
 */
export function buildShiftByDaysPatch(
  document: GanttDocument,
  ref: EditableEntityRef,
  days: number,
): EntityDatePatch | undefined {
  if (ref.kind === "task") {
    const task = findEntity(document, "task", ref.id);
    if (!task) {
      return undefined;
    }
    const start = shiftIsoDate(task.start, days);
    const end = shiftIsoDate(task.end, days);
    return start || end ? { start, end } : undefined;
  }

  if (ref.kind === "milestone") {
    const milestone = findEntity(document, "milestone", ref.id);
    if (!milestone || milestone.date === undefined) {
      return undefined;
    }
    return { date: shiftIsoDate(milestone.date, days) };
  }

  return undefined;
}

/** Offsets a date-only ISO string, passing `undefined` straight through. */
function shiftIsoDate(
  isoDate: string | undefined,
  days: number,
): string | undefined {
  return isoDate === undefined
    ? undefined
    : formatIsoDate(addDays(parseIsoDate(isoDate), days));
}
