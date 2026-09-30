import { IconButton } from "@webview/components/IconButton";
import { TextButton } from "@webview/components/TextButton";
import "@webview/features/entity-editor/components/EntityEditor.scss";
import { GroupFields } from "@webview/features/entity-editor/components/GroupFields";
import { MilestoneFields } from "@webview/features/entity-editor/components/MilestoneFields";
import { TaskFields } from "@webview/features/entity-editor/components/TaskFields";
import { EntityEditorProps } from "@webview/features/entity-editor/entityEditor.types";
import { titleOf } from "@webview/features/entity-editor/entityEditorPresentation";
import { createEntityEditorSubmit } from "@webview/features/entity-editor/entityEditorSubmit";
import { useDependencyEditorState } from "@webview/features/entity-editor/hooks/useDependencyEditorState";
import { useEntityEditorDraft } from "@webview/features/entity-editor/hooks/useEntityEditorDraft";
import { useTranslate } from "@webview/l10n";
import { useRef } from "react";

/**
 * Entity-aware edit form for tasks, milestones, and groups.
 */
export function EntityEditor(props: EntityEditorProps): React.JSX.Element {
  const { editingEntity, document } = props;
  const t = useTranslate();
  const formRef = useRef<HTMLFormElement>(null);
  const { taskDraft, milestoneDraft, groupDraft, setTaskDraft, setMilestoneDraft, setGroupDraft } =
    useEntityEditorDraft(editingEntity);

  const dependencyOwnerId = taskDraft?.id ?? milestoneDraft?.id;
  const depEditor = useDependencyEditorState(
    dependencyOwnerId,
    document,
    {
      addDependency: props.onAddDependency,
      removeDependency: props.onRemoveDependency,
    },
    props.onRequestEditEntity,
  );

  const submit = createEntityEditorSubmit({
    document,
    taskDraft,
    milestoneDraft,
    groupDraft,
    onSave: props.onSave,
  });

  /** Requests native form submission so validation and the submit workflow still run. */
  function requestSubmit(): void {
    formRef.current?.requestSubmit();
  }

  /** Deletes the currently edited entity. */
  function deleteEntity(): void {
    props.onDelete({
      kind: editingEntity.kind,
      id: editingEntity.entity.id,
    });
  }

  return (
    <form ref={formRef} className="ganttee-entity-editor" onSubmit={submit}>
      <div className="ganttee-entity-editor__header">
        <h2>{titleOf(editingEntity.kind, t)}</h2>
        <IconButton icon="close" label={t("Close")} onClick={props.onClose} />
      </div>

      {taskDraft && (
        <TaskFields
          task={taskDraft}
          scheduledTask={document.tasks.find((task) => task.id === taskDraft.id)}
          onChange={setTaskDraft}
          {...depEditor}
        />
      )}

      {milestoneDraft && (
        <MilestoneFields
          milestone={milestoneDraft}
          scheduledMilestone={document.milestones.find(
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
        <button type="submit" hidden />
        <TextButton variant="primary" onClick={requestSubmit}>
          {t("Save")}
        </TextButton>
        <TextButton onClick={deleteEntity}>{t("Delete")}</TextButton>
      </div>
    </form>
  );
}
