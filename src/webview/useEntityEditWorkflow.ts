import { useCallback, useMemo, useState } from "react";
import { Dependency, DependencyType, GanttDocument } from "../common/models";
import {
  EditableEntityKind,
  EditableEntityMap,
  EditableEntityRef,
} from "../common/protocol";
import {
  buildDependency,
  createDependencyId,
} from "../services/dependencyFactoryService";
import { buildUngroupUpdate } from "../services/entityRemovalService";
import {
  buildSaveUpdate,
  SaveEntityOptions,
} from "../services/entitySaveGuardService";
import {
  buildDatePatchUpdate,
  EntityDatePatch,
} from "../services/entitySchedulePatchService";

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
  /** Saves an entity through the host action boundary. */
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
    document: GanttDocument,
    entity: EditableEntityRef,
    options?: SaveEntityOptions,
  ) => void;
  /** Creates and sends a dependency. */
  addDependency: (
    ownerId: string | undefined,
    targetId: string,
    type: DependencyType,
  ) => void;
  /** Removes a dependency by identifier. */
  removeDependency: (dependencyId: string) => void;
  /** Applies a chart date patch and saves the result. */
  patchEntityDatesFromChart: (
    document: GanttDocument,
    entity: EditableEntityRef,
    patch: EntityDatePatch,
    options?: SaveEntityOptions,
  ) => void;
}

/** Shared dependency-editor state and callbacks for task and milestone forms. */
export interface DependencyEditorProps {
  /** Current parsed Gantt document. */
  document: GanttDocument;
  /** Dependencies involving the current owner. */
  dependencies: Dependency[];
  /** Selected dependency type. */
  dependencyType: DependencyType;
  /** Selected dependency target identifier. */
  dependencyTarget: string;
  /** Entities available as dependency targets. */
  dependencyCandidates: {
    /** Candidate entity identifier. */
    id: string;
    /** Candidate entity display name. */
    name: string;
  }[];
  /** Updates the selected dependency type. */
  onDependencyTypeChange: (value: DependencyType) => void;
  /** Updates the selected dependency target. */
  onDependencyTargetChange: (value: string) => void;
  /** Adds the selected dependency. */
  onAddDependency: () => void;
  /** Removes a dependency by identifier. */
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
