import { useEffect, useState } from "react";
import { Dependency, GanttDocument } from "../common/models";
import {
    EditableEntityKind,
    EditableEntityMap,
    EditableEntityRef,
} from "../common/protocol";
import { GanttChart } from "./GanttChart";
import { TaskForm } from "./TaskForm";
import { onHostMessage, postToHost } from "./vscodeApi";

/** Root editor UI: the ECharts timeline and the entity edit panel. */
export function App(): JSX.Element {
  const [document, setDocument] = useState<GanttDocument | null>(null);
  const [selectedEntity, setSelectedEntity] =
    useState<EditableEntityRef | null>(null);
  const [editingEntity, setEditingEntity] =
    useState<EditableEntityRef | null>(null);

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

  if (!document) {
    return <div className="ganttee-empty">Loading Gantt chart…</div>;
  }

  const editingTarget = resolveEntity(document, editingEntity);

  const saveEntity = (
    kind: EditableEntityKind,
    entity: EditableEntityMap[EditableEntityKind],
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
    setEditingEntity(null);
  };

  const deleteEntity = (entity: EditableEntityRef) => {
    postToHost({ type: "deleteEntity", entity });
    setEditingEntity(null);
  };

  const addDependency = (dependency: Dependency) =>
    postToHost({ type: "addDependency", dependency });

  const removeDependency = (dependencyId: string) =>
    postToHost({ type: "removeDependency", dependencyId });

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
          />
        )}
      </div>
      {editingTarget && (
        <aside className="ganttee-panel">
          <TaskForm
            editingEntity={editingTarget}
            document={document}
            onSave={saveEntity}
            onDelete={deleteEntity}
            onClose={() => setEditingEntity(null)}
            onAddDependency={addDependency}
            onRemoveDependency={removeDependency}
          />
        </aside>
      )}
    </div>
  );
}

interface ResolvedEditingEntity {
  kind: EditableEntityKind;
  entity: EditableEntityMap[EditableEntityKind];
}

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
