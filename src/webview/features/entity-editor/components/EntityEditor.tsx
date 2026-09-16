import { IconButton } from "@webview/components/IconButton";
import "@webview/features/entity-editor/components/EntityEditor.scss";
import { GroupFields } from "@webview/features/entity-editor/components/GroupFields";
import { MilestoneFields } from "@webview/features/entity-editor/components/MilestoneFields";
import { TaskFields } from "@webview/features/entity-editor/components/TaskFields";
import { TaskFormProps } from "@webview/features/entity-editor/entityEditor.types";
import { titleOf } from "@webview/features/entity-editor/entityEditorPresentation";
import { createEntityEditorSubmit } from "@webview/features/entity-editor/entityEditorSubmit";
import { useDependencyEditorState } from "@webview/features/entity-editor/hooks/useDependencyEditorState";
import { useEntityEditorDraft } from "@webview/features/entity-editor/hooks/useEntityEditorDraft";
import { useTranslate } from "@webview/l10n";

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
          schedule={props.schedule}
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
