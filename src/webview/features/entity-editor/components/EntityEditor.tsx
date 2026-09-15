import { IconButton } from "../../../components/IconButton";
import { useTranslate } from "../../../l10n";
import { TaskFormProps } from "../entityEditor.types";
import { titleOf } from "../entityEditorPresentation";
import { createEntityEditorSubmit } from "../entityEditorSubmit";
import { useDependencyEditorState } from "../hooks/useDependencyEditorState";
import { useEntityEditorDraft } from "../hooks/useEntityEditorDraft";
import "./EntityEditor.scss";
import { GroupFields } from "./GroupFields";
import { MilestoneFields } from "./MilestoneFields";
import { TaskFields } from "./TaskFields";

/**
 * Entity-aware edit form for tasks, milestones, and groups.
 */
export function EntityEditor(props: TaskFormProps): React.JSX.Element {
  const { editingEntity, document } = props;
  const t = useTranslate();
  const { taskDraft, milestoneDraft, groupDraft, setTaskDraft, setMilestoneDraft, setGroupDraft } =
    useEntityEditorDraft(editingEntity);

  const dependencyOwnerId = taskDraft?.id ?? milestoneDraft?.id;
  const depEditor = useDependencyEditorState(dependencyOwnerId, document, {
    addDependency: props.onAddDependency,
    removeDependency: props.onRemoveDependency,
  });

  const submit = createEntityEditorSubmit({
    document,
    taskDraft,
    milestoneDraft,
    groupDraft,
    onSave: props.onSave,
  });

  return (
    <form className="ganttee-entity-editor" onSubmit={submit}>
      <div className="ganttee-entity-editor__header">
        <h2>{titleOf(editingEntity.kind, t)}</h2>
        <IconButton icon="close" label={t("Close")} onClick={props.onClose} />
      </div>

      {taskDraft && (
        <TaskFields
          task={taskDraft}
          scheduledTask={props.schedule.tasks.find((task) => task.id === taskDraft.id)}
          onChange={setTaskDraft}
          {...depEditor}
        />
      )}

      {milestoneDraft && (
        <MilestoneFields
          milestone={milestoneDraft}
          scheduledMilestone={props.schedule.milestones.find(
            (milestone) => milestone.id === milestoneDraft.id,
          )}
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

      <div className="ganttee-entity-editor__actions">
        <button type="submit" className="ganttee-primary">
          {t("Save")}
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
          {t("Delete")}
        </button>
      </div>
    </form>
  );
}
