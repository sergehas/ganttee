/**
 * Selection-aware placement for newly created entities.
 *
 * A new task, milestone, or group inherits its owner and sequence position
 * from the sidebar's current selection: it lands immediately before the
 * selected item, in that item's own owner scope (a selected group is a
 * positional reference only, never the new item's parent). With no
 * selection, or a selection that no longer resolves, the new item is
 * appended at the end of the project root.
 */

import { ProjectContent, ProjectDocument } from "@common/documents";
import { EditableEntityKind, EditableEntityMap, EditableEntityRef } from "@common/protocol";
import { entitiesOf, findEntity, upsertEntity } from "@services/document/projectItemService";
import { insertIdsIntoOwnerSequence } from "@services/ordering/sequenceOrderingService";

/** Resolved owner and sequence anchor for a newly created entity. */
export interface CreationPlacement {
  /** Owner the new entity should receive (`undefined` for project root). */
  readonly ownerId: string | undefined;
  /** Id the new entity should be inserted immediately before, or `undefined` to append. */
  readonly beforeId: string | undefined;
}

/**
 * Resolves where a newly created entity should be owned and positioned, from
 * the sidebar's current selection.
 *
 * @param projectDoc The document the entity will be created in.
 * @param selected The currently selected sidebar entity, if any.
 */
export function resolveCreationPlacement(
  projectDoc: ProjectContent,
  selected: EditableEntityRef | undefined,
): CreationPlacement {
  const entity = selected && findEntity(projectDoc, selected.kind, selected.id);
  if (!entity) {
    return { ownerId: undefined, beforeId: undefined };
  }
  return { ownerId: entity.groupId, beforeId: entity.id };
}

/**
 * Adds a new entity to the document, positioning it per the resolved
 * placement instead of a plain append. Editing an existing entity through
 * this function leaves its owner and position untouched.
 *
 * @param projectDoc The document to update.
 * @param kind The entity kind being created.
 * @param entity The new entity.
 * @param placement The resolved owner and sequence anchor.
 */
export function createEntityAtPlacement<K extends EditableEntityKind>(
  projectDoc: ProjectDocument,
  kind: K,
  entity: EditableEntityMap[K],
  placement: CreationPlacement,
): ProjectDocument {
  const alreadyExists = entitiesOf(projectDoc, kind).some(
    (candidate) => candidate.id === entity.id,
  );
  if (alreadyExists) {
    return upsertEntity(projectDoc, kind, entity);
  }
  const owned = { ...entity, groupId: placement.ownerId } as EditableEntityMap[K];
  const withEntity = upsertEntity(projectDoc, kind, owned);
  return insertIdsIntoOwnerSequence(withEntity, placement.ownerId, [entity.id], placement.beforeId);
}
