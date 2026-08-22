/**
 * Roll-up of a group's schedule from the entities it owns.
 *
 * A group has no schedule of its own: it spans its members. This module derives
 * that span as data, so the host, the webview form, and the chart can present it
 * however each needs to.
 */

import { diffIsoDates } from "../common/dates";
import { effectiveEnd, effectiveStart } from "../common/models";
import { GroupScheduleScope } from "./groupHierarchyService";

/** The span a group covers, derived from its members. */
export interface GroupSchedule {
  /** Earliest start across the members, if any member is dated. */
  start?: string;
  /** Latest end across the members, if any member is dated. */
  end?: string;
  /** Calendar days between {@link GroupSchedule.start} and {@link GroupSchedule.end}. */
  durationDays?: number;
}

/**
 * Derives the span a group covers from the entities it owns.
 *
 * @param scope The entities owned by the group hierarchy.
 * @returns The derived span, or an empty schedule when no member is dated.
 */
export function deriveGroupSchedule(scope: GroupScheduleScope): GroupSchedule {
  const starts = [
    ...scope.tasks.map(effectiveStart),
    ...scope.milestones.map((milestone) => milestone.date),
  ].filter((date): date is string => date !== undefined);
  const ends = [
    ...scope.tasks.map(effectiveEnd),
    ...scope.milestones.map((milestone) => milestone.date),
  ].filter((date): date is string => date !== undefined);

  if (starts.length === 0 || ends.length === 0) {
    return {};
  }

  const start = starts.reduce((min, date) => (date < min ? date : min));
  const end = ends.reduce((max, date) => (date > max ? date : max));

  return {
    start,
    end,
    durationDays: Math.max(0, diffIsoDates(start, end)),
  };
}
