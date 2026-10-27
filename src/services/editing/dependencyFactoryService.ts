/**
 * Creation of dependency records for drafts made in the webview.
 */

import { Dependency, DependencyType } from "@common/documents";

/**
 * Builds a dependency owned by `ownerId`.
 *
 * @param ownerId The entity whose schedule the dependency constrains.
 * @param targetId The entity being referenced.
 * @param type The kind of constraint.
 * @param createId Supplies the new dependency's id.
 * @returns The dependency, or `undefined` when either endpoint is missing.
 */
export function buildDependency(
  ownerId: string | undefined,
  targetId: string,
  type: DependencyType,
  createId: () => string,
): Dependency | undefined {
  if (!ownerId || !targetId) {
    return undefined;
  }
  return { id: createId(), sourceId: ownerId, targetId, type };
}
