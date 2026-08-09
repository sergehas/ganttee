import { useMemo } from "react";
import { GanttDocument } from "../../common/models";
import {
  buildDirectGroupMemberRows,
  collectGroupScope,
  computeGroupEffectiveSchedule,
  DirectGroupMemberRow,
} from "../utils/taskForm/groupDerivations";

/** Derived group schedule and member rows for group-edit UI rendering. */
export interface GroupScheduleScope {
  schedule: { start?: string; end?: string; duration?: string };
  directMemberRows: DirectGroupMemberRow[];
}

/** Computes memoized schedule and direct member rows for a group edit form. */
export function useGroupScheduleScope(
  document: GanttDocument,
  groupId: string,
): GroupScheduleScope {
  const scope = useMemo(
    () => collectGroupScope(document, groupId),
    [document, groupId],
  );
  const schedule = useMemo(
    () => computeGroupEffectiveSchedule(scope.tasks, scope.milestones),
    [scope.tasks, scope.milestones],
  );
  const directMemberRows = useMemo(
    () => buildDirectGroupMemberRows(document, groupId),
    [document, groupId],
  );

  return { schedule, directMemberRows };
}
