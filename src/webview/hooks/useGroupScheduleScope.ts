import { useMemo } from "react";
import { GanttDocument } from "../../common/models";
import { selectGroupScheduleScope } from "../../services/groupHierarchyService";
import {
  deriveGroupSchedule,
  GroupSchedule,
} from "../../services/groupScheduleProjectionService";
import {
  buildDirectGroupMemberRows,
  DirectGroupMemberRow,
} from "../utils/taskForm/groupMemberRows";

/** Derived group schedule and member rows for group-edit UI rendering. */
export interface GroupScheduleScopeView {
  /** Effective schedule derived from the group contents. */
  schedule: GroupSchedule;
  /** Rows for entities directly contained by the group. */
  directMemberRows: DirectGroupMemberRow[];
}

/** Computes memoized schedule and direct member rows for a group edit form. */
export function useGroupScheduleScope(
  document: GanttDocument,
  groupId: string,
): GroupScheduleScopeView {
  const schedule = useMemo(
    () => deriveGroupSchedule(selectGroupScheduleScope(document, groupId)),
    [document, groupId],
  );
  const directMemberRows = useMemo(
    () => buildDirectGroupMemberRows(document, groupId),
    [document, groupId],
  );

  return { schedule, directMemberRows };
}
