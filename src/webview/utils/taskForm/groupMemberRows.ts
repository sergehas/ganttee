import { GanttDocument } from "../../../common/models";
import {
  EditableEntityKind,
  EditableEntityRef,
} from "../../../common/protocol";

/** A direct member row shown in the group-owned-entities list. */
export interface DirectGroupMemberRow {
  /** Stable row id (`kind:id`) for React rendering. */
  id: string;
  /** Display name for the member entity. */
  name: string;
  /** Kind of entity (`task`, `milestone`, or `group`). */
  kind: EditableEntityKind;
  /** Navigable reference to the member entity. */
  entity: EditableEntityRef;
}

/**
 * Builds direct-member rows for entities owned by a group.
 * Includes only entities with `groupId === ownerGroupId` (no transitive descendants).
 */
export function buildDirectGroupMemberRows(
  document: GanttDocument,
  ownerGroupId: string,
): DirectGroupMemberRow[] {
  const groupRows: DirectGroupMemberRow[] = document.groups
    .filter((item) => item.groupId === ownerGroupId)
    .map((item) => ({
      id: `group:${item.id}`,
      name: item.name,
      kind: "group",
      entity: { kind: "group", id: item.id },
    }));

  const taskRows: DirectGroupMemberRow[] = document.tasks
    .filter((item) => item.groupId === ownerGroupId)
    .map((item) => ({
      id: `task:${item.id}`,
      name: item.name,
      kind: "task",
      entity: { kind: "task", id: item.id },
    }));

  const milestoneRows: DirectGroupMemberRow[] = document.milestones
    .filter((item) => item.groupId === ownerGroupId)
    .map((item) => ({
      id: `milestone:${item.id}`,
      name: item.name,
      kind: "milestone",
      entity: { kind: "milestone", id: item.id },
    }));

  return [...groupRows, ...taskRows, ...milestoneRows];
}
