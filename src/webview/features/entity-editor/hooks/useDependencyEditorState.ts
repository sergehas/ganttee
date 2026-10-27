import { DependencyType, ProjectContent } from "@common/documents";
import { EditableEntityRef } from "@common/protocol";
import { DependencyEditorProps } from "@webview/features/entity-editor/entityEditor.types";
import { EntityEditWorkflow } from "@webview/features/entity-editor/hooks/useEntityEditWorkflow";
import { useCallback, useMemo, useState } from "react";

/** Manages dependency-editor state for a task or milestone draft. */
export function useDependencyEditorState(
  ownerId: string | undefined,
  projectDoc: ProjectContent,
  workflow: Pick<EntityEditWorkflow, "addDependency" | "removeDependency">,
  onRequestEditEntity: (entity: EditableEntityRef) => void,
): DependencyEditorProps {
  const [dependencyTarget, setDependencyTarget] = useState("");
  const [dependencyType, setDependencyType] = useState<DependencyType>("startAfter");

  const dependencies = useMemo(
    () =>
      ownerId
        ? projectDoc.dependencies.filter(
            (dependency) => dependency.sourceId === ownerId || dependency.targetId === ownerId,
          )
        : [],
    [ownerId, projectDoc.dependencies],
  );

  const dependencyCandidates = useMemo(() => {
    if (!ownerId) {
      return [];
    }
    return [
      ...projectDoc.tasks.map((task) => ({ id: task.id, name: task.name })),
      ...projectDoc.milestones.map((milestone) => ({
        id: milestone.id,
        name: milestone.name,
      })),
    ].filter((entity) => entity.id !== ownerId);
  }, [ownerId, projectDoc.tasks, projectDoc.milestones]);

  const addDependency = useCallback(() => {
    workflow.addDependency(ownerId, dependencyTarget, dependencyType);
    setDependencyTarget("");
  }, [workflow, ownerId, dependencyTarget, dependencyType]);

  return {
    document: projectDoc,
    ownerId,
    dependencies,
    dependencyType,
    dependencyTarget,
    dependencyCandidates,
    onDependencyTypeChange: setDependencyType,
    onDependencyTargetChange: setDependencyTarget,
    onAddDependency: addDependency,
    onRemoveDependency: workflow.removeDependency,
    onRequestEditEntity,
  };
}
