import { useEffect, useState } from "react";
import { Group, Milestone, Task } from "../common/models";
import { GroupFields } from "./components/taskForm/GroupFields";
import { MilestoneFields } from "./components/taskForm/MilestoneFields";
import { TaskFields } from "./components/taskForm/TaskFields";
import { TaskFormProps } from "./types/taskForm";
import { useDependencyEditorState } from "./useEntityEditWorkflow";
import { titleOf } from "./utils/taskForm/entityPresentation";

/**
 * Entity-aware edit form for tasks, milestones, and groups.
 */
export function TaskForm(props: TaskFormProps): JSX.Element {
  const { editingEntity, document } = props;
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

  const dependencyOwnerId = taskDraft?.id ?? milestoneDraft?.id;
  const depEditor = useDependencyEditorState(dependencyOwnerId, document, {
    addDependency: props.onAddDependency,
    removeDependency: props.onRemoveDependency,
  });

  /** Saves the active draft through the shared edit workflow. */
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (taskDraft) {
      props.onSave("task", taskDraft, undefined, document.dependencies);
      return;
    }
    if (milestoneDraft) {
      props.onSave(
        "milestone",
        milestoneDraft,
        undefined,
        document.dependencies,
      );
      return;
    }
    if (!groupDraft) {
      return;
    }
    props.onSave("group", groupDraft, undefined, document.dependencies);
  };

  return (
    <form className="ganttee-form" onSubmit={submit}>
      <div className="ganttee-form__header">
        <h2>{titleOf(editingEntity.kind)}</h2>
        <button
          type="button"
          className="ganttee-icon-button"
          onClick={props.onClose}
        >
          Close
        </button>
      </div>

      {taskDraft && (
        <TaskFields task={taskDraft} onChange={setTaskDraft} {...depEditor} />
      )}

      {milestoneDraft && (
        <MilestoneFields
          milestone={milestoneDraft}
          onChange={setMilestoneDraft}
          {...depEditor}
        />
      )}

      {groupDraft && (
        <GroupFields
          group={groupDraft}
          document={document}
          onChange={setGroupDraft}
          onRequestEditEntity={props.onRequestEditEntity}
          onUngroupEntity={(ref) => {
            props.onUngroupEntity(ref, {
              keepEditorOpen: true,
            });
          }}
        />
      )}

      <div className="ganttee-form__actions">
        <button type="submit" className="ganttee-primary">
          Save
        </button>
        <button
          type="button"
          className="ganttee-danger"
          onClick={() =>
            props.onDelete({
              kind: editingEntity.kind,
              id: editingEntity.entity.id,
            })
          }
        >
          Delete
        </button>
      </div>
    </form>
  );
}
