import { ProjectDocument } from "@common/documents";
import { useMemo } from "react";
import { buildDirectGroupMemberRows, DirectGroupMemberRow } from "../groupMemberRows";

/** Derived member rows for group-edit UI rendering. */
export interface GroupScheduleScopeView {
  /** Rows for entities directly contained by the group. */
  directMemberRows: DirectGroupMemberRow[];
}

/** Computes memoized schedule and direct member rows for a group edit form. */
export function useGroupScheduleScope(
  document: ProjectDocument,
  groupId: string,
): GroupScheduleScopeView {
  const directMemberRows = useMemo(
    () => buildDirectGroupMemberRows(document, groupId),
    [document, groupId],
  );

  return { directMemberRows };
}
