import { ProjectItemState, ProjectStatus } from "@common/documents";
import { ConfirmationDialog } from "@webview/components/ConfirmationDialog";
import { FormField } from "@webview/components/FormField";
import { IconButton } from "@webview/components/IconButton";
import { Select } from "@webview/components/Select";
import {
  statusColorInputValue,
  updateStatusDraft,
} from "@webview/features/settings/settingsEditorPresentation";
import { useTranslate } from "@webview/l10n";
import { ChangeEvent, useEffect, useState } from "react";
import "./StatusRow.scss";

/** Props for one editable project-status row. */
interface StatusRowProps {
  /** Current authoritative status definition. */
  readonly status: ProjectStatus;
  /** Number of assigned groups, tasks, and milestones. */
  readonly usageCount: number;
  /** Whether another settings proposal is being processed. */
  readonly busy: boolean;
  /** Proposes the edited status definition. */
  readonly onSave: (status: ProjectStatus) => void;
  /** Requests deletion of this status. */
  readonly onDelete: (statusId: string) => void;
}

/** Renders an editable status row with its usage count and delete confirmation. */
export function StatusRow({
  status,
  usageCount,
  busy,
  onSave,
  onDelete,
}: StatusRowProps): React.JSX.Element {
  const translate = useTranslate();
  const [name, setName] = useState(status.name);
  const [color, setColor] = useState(statusColorInputValue(status.color));
  const [state, setState] = useState<ProjectItemState | "">(status.state ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(
    /** Refreshes the editable draft when the authoritative status changes. */
    function synchronizeStatusDraft(): void {
      setName(status.name);
      setColor(statusColorInputValue(status.color));
      setState(status.state ?? "");
      setConfirmingDelete(false);
    },
    [status],
  );

  /** Stores the edited status name. */
  function updateName(event: ChangeEvent<HTMLInputElement>): void {
    setName(event.currentTarget.value);
  }

  /** Stores the edited status color. */
  function updateColor(event: ChangeEvent<HTMLInputElement>): void {
    setColor(event.currentTarget.value);
  }

  /** Stores the edited enforced lifecycle state. */
  function updateState(event: ChangeEvent<HTMLSelectElement>): void {
    setState(event.currentTarget.value as ProjectItemState | "");
  }

  /** Proposes edited metadata while preserving the identifier and color alpha. */
  function saveStatus(): void {
    onSave(updateStatusDraft(status, name, color, state));
  }

  /** Deletes unused statuses immediately and confirms deletion for assigned statuses. */
  function requestDelete(): void {
    if (usageCount === 0) {
      onDelete(status.id);
      return;
    }
    setConfirmingDelete(true);
  }

  /** Confirms removal of this status and its assignments. */
  function confirmDelete(): void {
    onDelete(status.id);
  }

  /** Closes the delete confirmation without changing the status. */
  function cancelDelete(): void {
    setConfirmingDelete(false);
  }

  return (
    <li className="ganttee-settings__status-row">
      <div className="ganttee-settings__status-fields">
        <FormField>
          <input type="text" required value={name} disabled={busy} onChange={updateName} />
        </FormField>
        <FormField>
          <input type="color" value={color} disabled={busy} onChange={updateColor} />
        </FormField>
        <FormField>
          <Select value={state} disabled={busy} onChange={updateState}>
            <option value="">{translate("No enforced state")}</option>
            <option value="open">{translate("Open")}</option>
            <option value="closed">{translate("Closed")}</option>
          </Select>
        </FormField>
        <div className="ganttee-settings__status-actions">
          <IconButton icon="save" label={translate("Save")} disabled={busy} onClick={saveStatus} />
          <IconButton
            icon="trash"
            label={translate("Delete")}
            disabled={busy}
            onClick={requestDelete}
          />
        </div>
        <span>{translate("Used by {0} items", usageCount)}</span>
      </div>
      {confirmingDelete && (
        <ConfirmationDialog
          title={translate("Delete status")}
          message={translate(
            "This status is used by {0} items. Delete and unassign it?",
            usageCount,
          )}
          confirmLabel={translate("Delete")}
          cancelLabel={translate("Cancel")}
          disabled={busy}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </li>
  );
}
