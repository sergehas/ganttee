import { Group, Milestone, Task } from "@common/documents";
import { useEffect, useState } from "react";
import { TaskFormEditingEntity } from "../entityEditor.types";

/** Editable drafts for the entity currently displayed by the editor. */
export interface EntityEditorDraft {
  /** Task draft when a task is being edited. */
  readonly taskDraft: Task | null;
  /** Milestone draft when a milestone is being edited. */
  readonly milestoneDraft: Milestone | null;
  /** Group draft when a group is being edited. */
  readonly groupDraft: Group | null;
  /** Replaces the active task draft. */
  readonly setTaskDraft: (task: Task | null) => void;
  /** Replaces the active milestone draft. */
  readonly setMilestoneDraft: (milestone: Milestone | null) => void;
  /** Replaces the active group draft. */
  readonly setGroupDraft: (group: Group | null) => void;
}

/** Synchronizes entity-specific draft state with the active editing target. */
export function useEntityEditorDraft(
  editingEntity: TaskFormEditingEntity,
): EntityEditorDraft {
  const [taskDraft, setTaskDraft] = useState<Task | null>(null);
  const [milestoneDraft, setMilestoneDraft] = useState<Milestone | null>(null);
  const [groupDraft, setGroupDraft] = useState<Group | null>(null);

  useEffect(() => {
    if (editingEntity.kind === "task") {
      setTaskDraft(editingEntity.entity as Task);
      setMilestoneDraft(null);
      setGroupDraft(null);
      return;
    }
    if (editingEntity.kind === "milestone") {
      setMilestoneDraft(editingEntity.entity as Milestone);
      setTaskDraft(null);
      setGroupDraft(null);
      return;
    }
    setGroupDraft(editingEntity.entity as Group);
    setTaskDraft(null);
    setMilestoneDraft(null);
  }, [editingEntity]);

  return {
    taskDraft,
    milestoneDraft,
    groupDraft,
    setTaskDraft,
    setMilestoneDraft,
    setGroupDraft,
  };
}
