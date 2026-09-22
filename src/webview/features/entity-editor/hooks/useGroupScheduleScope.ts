import { ProjectContent } from "@common/documents";
import {
  buildDirectGroupMemberRows,
  DirectGroupMemberRow,
} from "@webview/features/entity-editor/groupMemberRows";
import { useMemo } from "react";

/** Derived member rows for group-edit UI rendering. */
export interface GroupScheduleScopeView {
  /** Rows for entities directly contained by the group. */
  directMemberRows: DirectGroupMemberRow[];
}

/** Computes memoized schedule and direct member rows for a group edit form. */
export function useGroupScheduleScope(
  projectDoc: ProjectContent,
  groupId: string,
): GroupScheduleScopeView {
  const directMemberRows = useMemo(
    () => buildDirectGroupMemberRows(projectDoc, groupId),
    [projectDoc, groupId],
  );

  return { directMemberRows };
}
