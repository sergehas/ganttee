import { useCallback, useMemo, useState } from "react";
import { Dependency, DependencyType, GanttDocument } from "../common/models";
import {
  EditableEntityKind,
  EditableEntityMap,
  EditableEntityRef,
} from "../common/protocol";
import {
  EntityDatePatch,
  SaveEntityOptions,
  buildDatePatchUpdate,
  buildDependency,
  buildSaveUpdate,
  buildUngroupUpdate,
  createDependencyId,
} from "../services/entityEditWorkflowService";

/** Host actions consumed by the shared webview edit workflow. */
interface HostEditActions {
  onSave: (
    kind: EditableEntityKind,
    entity: EditableEntityMap[EditableEntityKind],
    options?: SaveEntityOptions,
  ) => void;
  onDelete: (entity: EditableEntityRef) => void;
  onAddDependency: (dependency: Dependency) => void;
  onRemoveDependency: (dependencyId: string) => void;
}

/** Public operations exposed by the shared webview edit workflow. */
export interface EntityEditWorkflow {
  saveEntity: (
    kind: EditableEntityKind,
    entity: EditableEntityMap[EditableEntityKind],
    options?: SaveEntityOptions,
  ) => void;
  deleteEntity: (entity: EditableEntityRef) => void;
  ungroupEntity: (
    document: GanttDocument,
    entity: EditableEntityRef,
    options?: SaveEntityOptions,
  ) => void;
  addDependency: (
    ownerId: string | undefined,
    targetId: string,
    type: DependencyType,
  ) => void;
  removeDependency: (dependencyId: string) => void;
  patchEntityDatesFromChart: (
    document: GanttDocument,
    entity: EditableEntityRef,
    patch: EntityDatePatch,
    options?: SaveEntityOptions,
  ) => void;
}

/** Shared dependency-editor state and callbacks for task and milestone forms. */
export interface DependencyEditorProps {
  document: GanttDocument;
  dependencies: Dependency[];
  dependencyType: DependencyType;
  dependencyTarget: string;
  dependencyCandidates: { id: string; name: string }[];
  onDependencyTypeChange: (value: DependencyType) => void;
  onDependencyTargetChange: (value: string) => void;
  onAddDependency: () => void;
  onRemoveDependency: (dependencyId: string) => void;
}

/**
 * Builds a shared edit-workflow API used by both the form panel and timeline.
 *
 * The workflow centralizes save guards and mutation shaping so multiple UI
 * surfaces apply exactly the same rules.
 */
export function useEntityEditWorkflow(
  actions: HostEditActions,
): EntityEditWorkflow {
  const saveEntity = useCallback(
    (
      kind: EditableEntityKind,
      entity: EditableEntityMap[EditableEntityKind],
      options?: SaveEntityOptions,
    ) => {
      const update = buildSaveUpdate(kind, entity, options);
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
    (
      document: GanttDocument,
      entity: EditableEntityRef,
      options?: SaveEntityOptions,
    ) => {
      const update = buildUngroupUpdate(document, entity, options);
      if (update) {
        actions.onSave(update.kind, update.entity, update.options);
      }
    },
    [actions],
  );

  const addDependency = useCallback(
    (ownerId: string | undefined, targetId: string, type: DependencyType) => {
      const dependency = buildDependency(
        ownerId,
        targetId,
        type,
        createDependencyId,
      );
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
      document: GanttDocument,
      entity: EditableEntityRef,
      patch: EntityDatePatch,
      options?: SaveEntityOptions,
    ) => {
      const update = buildDatePatchUpdate(document, entity, patch, options);
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

/**
 * Manages dependency-editor state for an owner entity using shared workflow operations.
 */
export function useDependencyEditorState(
  ownerId: string | undefined,
  document: GanttDocument,
  workflow: Pick<EntityEditWorkflow, "addDependency" | "removeDependency">,
): DependencyEditorProps {
  const [dependencyTarget, setDependencyTarget] = useState("");
  const [dependencyType, setDependencyType] =
    useState<DependencyType>("startAfter");

  const dependencies = useMemo(
    () =>
      ownerId
        ? document.dependencies.filter(
            (dep) => dep.sourceId === ownerId || dep.targetId === ownerId,
          )
        : [],
    [ownerId, document.dependencies],
  );

  const dependencyCandidates = useMemo(() => {
    if (!ownerId) {
      return [];
    }
    return [
      ...document.tasks.map((task) => ({ id: task.id, name: task.name })),
      ...document.milestones.map((milestone) => ({
        id: milestone.id,
        name: milestone.name,
      })),
    ].filter((entity) => entity.id !== ownerId);
  }, [ownerId, document.tasks, document.milestones]);

  const addDependency = useCallback(() => {
    workflow.addDependency(ownerId, dependencyTarget, dependencyType);
    setDependencyTarget("");
  }, [workflow, ownerId, dependencyTarget, dependencyType]);

  return {
    document,
    dependencies,
    dependencyType,
    dependencyTarget,
    dependencyCandidates,
    onDependencyTypeChange: setDependencyType,
    onDependencyTargetChange: setDependencyTarget,
    onAddDependency: addDependency,
    onRemoveDependency: workflow.removeDependency,
  };
}
