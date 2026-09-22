import { Dependency, DependencyType, ProjectContent } from "@common/documents";
import { generateId } from "@common/idFactory";
import { EditableEntityKind, EditableEntityMap, EditableEntityRef } from "@common/protocol";
import { buildDependency } from "@services/editing/dependencyFactoryService";
import { buildUngroupUpdate } from "@services/editing/projectItemRemovalService";
import { buildSaveUpdate, SaveEntityOptions } from "@services/editing/projectItemSaveGuardService";
import {
  buildDatePatchUpdate,
  EntityDatePatch,
} from "@services/editing/projectItemSchedulePatchService";
import { useCallback } from "react";

/** Host actions consumed by the shared webview edit workflow. */
interface HostEditActions {
  /** Sends an entity update to the host. */
  onSave: (
    kind: EditableEntityKind,
    entity: EditableEntityMap[EditableEntityKind],
    options?: SaveEntityOptions,
  ) => void;
  /** Sends an entity deletion to the host. */
  onDelete: (entity: EditableEntityRef) => void;
  /** Sends a new dependency to the host. */
  onAddDependency: (dependency: Dependency) => void;
  /** Sends a dependency deletion to the host. */
  onRemoveDependency: (dependencyId: string) => void;
}

/** Public operations exposed by the shared webview edit workflow. */
export interface EntityEditWorkflow {
  /** Saves an entity through the host boundary while preserving its requested editor behavior. */
  saveEntity: (
    kind: EditableEntityKind,
    entity: EditableEntityMap[EditableEntityKind],
    options?: SaveEntityOptions,
    dependencies?: Dependency[],
  ) => void;
  /** Deletes an entity through the host action boundary. */
  deleteEntity: (entity: EditableEntityRef) => void;
  /** Removes an entity from its group and saves the result. */
  ungroupEntity: (
    projectDoc: ProjectContent,
    entity: EditableEntityRef,
    options?: SaveEntityOptions,
  ) => void;
  /** Creates and sends a dependency. */
  addDependency: (ownerId: string | undefined, targetId: string, type: DependencyType) => void;
  /** Removes a dependency by identifier. */
  removeDependency: (dependencyId: string) => void;
  /** Applies a chart date patch and saves the result. */
  patchEntityDatesFromChart: (
    document: ProjectContent,
    entity: EditableEntityRef,
    patch: EntityDatePatch,
    options?: SaveEntityOptions,
  ) => void;
}

/**
 * Builds a shared edit-workflow API used by both the form panel and timeline.
 *
 * The workflow centralizes save guards and mutation shaping so multiple UI
 * surfaces apply exactly the same rules. It forwards `keepEditorOpen` to App,
 * which retains that UI intent until the host acknowledges the update.
 */
export function useEntityEditWorkflow(actions: HostEditActions): EntityEditWorkflow {
  const saveEntity = useCallback(
    (
      kind: EditableEntityKind,
      entity: EditableEntityMap[EditableEntityKind],
      options?: SaveEntityOptions,
      dependencies: Dependency[] = [],
    ) => {
      const update = buildSaveUpdate(kind, entity, options, dependencies);
      if (update) {
        actions.onSave(update.kind, update.entity, update.options);
      }
    },
    [actions],
  );

  const deleteEntity = useCallback(
    (entity: EditableEntityRef) => {
      actions.onDelete(entity);
    },
    [actions],
  );

  const ungroupEntity = useCallback(
    (projectDoc: ProjectContent, entity: EditableEntityRef, options?: SaveEntityOptions) => {
      const update = buildUngroupUpdate(projectDoc, entity, options);
      if (update) {
        actions.onSave(update.kind, update.entity, update.options);
      }
    },
    [actions],
  );

  const addDependency = useCallback(
    (ownerId: string | undefined, targetId: string, type: DependencyType) => {
      const dependency = buildDependency(ownerId, targetId, type, generateId);
      if (dependency) {
        actions.onAddDependency(dependency);
      }
    },
    [actions],
  );

  const removeDependency = useCallback(
    (dependencyId: string) => {
      actions.onRemoveDependency(dependencyId);
    },
    [actions],
  );

  const patchEntityDatesFromChart = useCallback(
    (
      projectDoc: ProjectContent,
      entity: EditableEntityRef,
      patch: EntityDatePatch,
      options?: SaveEntityOptions,
    ) => {
      const update = buildDatePatchUpdate(projectDoc, entity, patch, options);
      if (update) {
        actions.onSave(update.kind, update.entity, update.options);
      }
    },
    [actions],
  );

  return {
    saveEntity,
    deleteEntity,
    ungroupEntity,
    addDependency,
    removeDependency,
    patchEntityDatesFromChart,
  };
}
