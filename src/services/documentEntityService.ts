/**
 * Keyed access to the entity collections of a document.
 *
 * Tasks, milestones, and groups live in three separate arrays, so every caller
 * that works with an {@link EditableEntityKind} would otherwise need its own
 * three-way branch. This module provides that branch once, without casts.
 */

import { GanttDocument } from "../common/models";
import { EditableEntityKind, EditableEntityMap } from "../common/protocol";

/**
 * Returns the entities of one kind.
 *
 * @param document The document to read from.
 * @param kind The entity kind to select.
 */
export function entitiesOf<K extends EditableEntityKind>(
  document: GanttDocument,
  kind: K,
): readonly EditableEntityMap[K][] {
  switch (kind) {
    case "task":
      return document.tasks as readonly EditableEntityMap[K][];
    case "milestone":
      return document.milestones as readonly EditableEntityMap[K][];
    default:
      return document.groups as readonly EditableEntityMap[K][];
  }
}

/**
 * Finds one entity by kind and id.
 *
 * @param document The document to read from.
 * @param kind The entity kind to search.
 * @param entityId The id to look for.
 * @returns The entity, or `undefined` when no entity has that id.
 */
export function findEntity<K extends EditableEntityKind>(
  document: GanttDocument,
  kind: K,
  entityId: string,
): EditableEntityMap[K] | undefined {
  return entitiesOf(document, kind).find((entity) => entity.id === entityId);
}

/**
 * Replaces an existing entity, keeping its position in the collection.
 *
 * @param document The document to update.
 * @param kind The entity kind to replace within.
 * @param entity The replacement, matched by id.
 * @returns The updated document, or `undefined` when no entity has that id.
 */
export function replaceEntity<K extends EditableEntityKind>(
  document: GanttDocument,
  kind: K,
  entity: EditableEntityMap[K],
): GanttDocument | undefined {
  const entities = entitiesOf(document, kind);
  if (!entities.some((candidate) => candidate.id === entity.id)) {
    return undefined;
  }
  return withEntities(
    document,
    kind,
    entities.map((candidate) =>
      candidate.id === entity.id ? entity : candidate,
    ),
  );
}

/**
 * Replaces an existing entity or appends it when its id is new.
 *
 * @param document The document to update.
 * @param kind The entity kind to write to.
 * @param entity The entity to store.
 * @returns The updated document.
 */
export function upsertEntity<K extends EditableEntityKind>(
  document: GanttDocument,
  kind: K,
  entity: EditableEntityMap[K],
): GanttDocument {
  return replaceEntity(document, kind, entity) ?? appendEntity(document, kind, entity);
}

/** Returns a document with one kind's collection replaced wholesale. */
function withEntities<K extends EditableEntityKind>(
  document: GanttDocument,
  kind: K,
  entities: readonly EditableEntityMap[K][],
): GanttDocument {
  switch (kind) {
    case "task":
      return { ...document, tasks: entities as GanttDocument["tasks"] };
    case "milestone":
      return {
        ...document,
        milestones: entities as GanttDocument["milestones"],
      };
    default:
      return { ...document, groups: entities as GanttDocument["groups"] };
  }
}

/** Returns a document with one entity added to the end of its collection. */
function appendEntity<K extends EditableEntityKind>(
  document: GanttDocument,
  kind: K,
  entity: EditableEntityMap[K],
): GanttDocument {
  return withEntities(document, kind, [...entitiesOf(document, kind), entity]);
}
