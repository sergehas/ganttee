import { useEffect, useState } from "react";
import { Dependency, GanttDocument } from "../common/models";
import {
  EditableEntityKind,
  EditableEntityMap,
  EditableEntityRef,
} from "../common/protocol";
import { buildShiftByDaysPatch } from "../services/entitySchedulePatchService";
import { GanttChart } from "./GanttChart";
import { TaskForm } from "./TaskForm";
import { useEntityEditWorkflow } from "./useEntityEditWorkflow";
import { onHostMessage, postToHost } from "./vscodeApi";

interface SaveEntityOptions {
  /** Keeps the edit panel open after the host update. */
  keepEditorOpen?: boolean;
}

/** Root editor UI: the ECharts timeline and the entity edit panel. */
export function App(): JSX.Element {
  const [document, setDocument] = useState<GanttDocument | null>(null);
  const [selectedEntity, setSelectedEntity] =
    useState<EditableEntityRef | null>(null);
  const [editingEntity, setEditingEntity] = useState<EditableEntityRef | null>(
    null,
  );

  useEffect(() => {
    const unsubscribe = onHostMessage((message) => {
      switch (message.type) {
        case "init":
        case "documentChanged":
          setDocument(message.document);
          break;
        case "selectEntity":
          setSelectedEntity(message.entity);
          break;
        case "editEntity":
          setSelectedEntity(message.entity);
          setEditingEntity(message.entity);
          break;
      }
    });
    postToHost({ type: "ready" });
    return unsubscribe;
  }, []);

  /** Sends an entity update to the extension host. */
  const saveEntityToHost = (
    kind: EditableEntityKind,
    entity: EditableEntityMap[EditableEntityKind],
    options?: SaveEntityOptions,
  ) => {
    switch (kind) {
      case "task":
        postToHost({
          type: "updateEntity",
          kind,
          entity: entity as EditableEntityMap["task"],
        });
        break;
      case "milestone":
        postToHost({
          type: "updateEntity",
          kind,
          entity: entity as EditableEntityMap["milestone"],
        });
        break;
      case "group":
        postToHost({
          type: "updateEntity",
          kind,
          entity: entity as EditableEntityMap["group"],
        });
        break;
    }
    if (!options?.keepEditorOpen) {
      setEditingEntity(null);
    }
  };

  /** Sends an entity deletion to the extension host and closes the editor. */
  const deleteEntityToHost = (entity: EditableEntityRef) => {
    postToHost({ type: "deleteEntity", entity });
    setEditingEntity(null);
  };

  /** Selects an entity and asks the host to open it for editing. */
  const requestEditEntity = (entity: EditableEntityRef) => {
    setSelectedEntity(entity);
    setEditingEntity(entity);
    postToHost({ type: "requestEditEntity", entity });
  };

  /** Sends a new dependency to the extension host. */
  const addDependency = (dependency: Dependency) =>
    postToHost({ type: "addDependency", dependency });

  /** Sends a dependency deletion to the extension host. */
  const removeDependency = (dependencyId: string) =>
    postToHost({ type: "removeDependency", dependencyId });

  const workflow = useEntityEditWorkflow({
    onSave: saveEntityToHost,
    onDelete: deleteEntityToHost,
    onAddDependency: addDependency,
    onRemoveDependency: removeDependency,
  });

  if (!document) {
    return <div className="ganttee-empty">Loading Gantt chart…</div>;
  }

  const editingTarget = resolveEntity(document, editingEntity);

  /** Applies a chart date shift to an entity through the shared workflow. */
  const nudgeEntityByDays = (entity: EditableEntityRef, days: number) => {
    const patch = buildShiftByDaysPatch(document, entity, days);
    if (!patch) {
      return;
    }
    workflow.patchEntityDatesFromChart(document, entity, patch);
  };

  return (
    <div className="ganttee-layout">
      <div className="ganttee-timeline">
        {document.tasks.length === 0 && document.milestones.length === 0 ? (
          <div className="ganttee-empty">
            No tasks yet. Use the Ganttee sidebar to add one.
          </div>
        ) : (
          <GanttChart
            document={document}
            selectedEntity={selectedEntity}
            onSelectEntity={setSelectedEntity}
            onEditEntity={setEditingEntity}
            onNudgeEntityByDays={nudgeEntityByDays}
          />
        )}
      </div>
      {editingTarget && (
        <aside className="ganttee-panel">
          <TaskForm
            editingEntity={editingTarget}
            document={document}
            onSave={workflow.saveEntity}
            onDelete={workflow.deleteEntity}
            onClose={() => setEditingEntity(null)}
            onAddDependency={workflow.addDependency}
            onRemoveDependency={workflow.removeDependency}
            onUngroupEntity={(entity, options) =>
              workflow.ungroupEntity(document, entity, options)
            }
            onRequestEditEntity={requestEditEntity}
          />
        </aside>
      )}
    </div>
  );
}

interface ResolvedEditingEntity {
  /** Entity kind used to select the form section. */
  kind: EditableEntityKind;
  /** Current entity data resolved from the document. */
  entity: EditableEntityMap[EditableEntityKind];
}

/** Resolves an editable entity reference against the current document. */
function resolveEntity(
  document: GanttDocument,
  ref: EditableEntityRef | null,
): ResolvedEditingEntity | null {
  if (!ref) {
    return null;
  }
  switch (ref.kind) {
    case "task": {
      const entity = document.tasks.find((task) => task.id === ref.id);
      return entity ? { kind: "task", entity } : null;
    }
    case "milestone": {
      const entity = document.milestones.find(
        (milestone) => milestone.id === ref.id,
      );
      return entity ? { kind: "milestone", entity } : null;
    }
    case "group": {
      const entity = document.groups.find((group) => group.id === ref.id);
      return entity ? { kind: "group", entity } : null;
    }
  }
}
