/**
 * Connected-component anchoring rules.
 *
 * A schedule is only resolvable if every connected group of dependent entities
 * can be traced back to at least one absolute date. This module states that rule
 * once, over the plain document shape.
 */

import { GanttDocument } from "../common/models";

/**
 * Returns the ids of entities that carry an absolute date of their own.
 *
 * @param document The document to inspect.
 * @returns Ids of tasks with a static start or end, and milestones with a date.
 */
export function anchoredEntityIds(
  document: GanttDocument,
): ReadonlySet<string> {
  return new Set([
    ...document.tasks
      .filter((task) => task.start !== undefined || task.end !== undefined)
      .map((task) => task.id),
    ...document.milestones
      .filter((milestone) => milestone.date !== undefined)
      .map((milestone) => milestone.id),
  ]);
}

/**
 * Returns the ids of entities that occupy time and therefore need an anchor.
 * Groups are excluded: they derive their span from their members.
 *
 * @param document The document to inspect.
 * @returns Ids of every task and milestone.
 */
export function schedulableEntityIds(
  document: GanttDocument,
): ReadonlySet<string> {
  return new Set([
    ...document.tasks.map((task) => task.id),
    ...document.milestones.map((milestone) => milestone.id),
  ]);
}

/**
 * Selects the components that contain something to schedule but no absolute
 * date to schedule it against. Components made only of groups are exempt.
 *
 * @param components The weakly-connected components of the dependency graph.
 * @param anchored Ids of entities carrying an absolute date.
 * @param schedulable Ids of entities that need an anchor.
 * @returns The components that cannot be resolved to a date.
 */
export function unanchoredComponents(
  components: readonly (readonly string[])[],
  anchored: ReadonlySet<string>,
  schedulable: ReadonlySet<string>,
): readonly (readonly string[])[] {
  return components.filter(
    (component) =>
      component.some((id) => schedulable.has(id)) &&
      !component.some((id) => anchored.has(id)),
  );
}
