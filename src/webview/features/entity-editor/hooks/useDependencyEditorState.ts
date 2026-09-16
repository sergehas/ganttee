import { DependencyType, ProjectDocument } from "@common/documents";
import { DependencyEditorProps } from "@webview/features/entity-editor/entityEditor.types";
import { EntityEditWorkflow } from "@webview/features/entity-editor/hooks/useEntityEditWorkflow";
import { useCallback, useMemo, useState } from "react";

/** Manages dependency-editor state for a task or milestone draft. */
export function useDependencyEditorState(
  ownerId: string | undefined,
  document: ProjectDocument,
  workflow: Pick<EntityEditWorkflow, "addDependency" | "removeDependency">,
): DependencyEditorProps {
  const [dependencyTarget, setDependencyTarget] = useState("");
  const [dependencyType, setDependencyType] = useState<DependencyType>("startAfter");

  const dependencies = useMemo(
    () =>
      ownerId
        ? document.dependencies.filter(
            (dependency) => dependency.sourceId === ownerId || dependency.targetId === ownerId,
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
