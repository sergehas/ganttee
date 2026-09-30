import "@webview/components/ConfirmationDialog.scss";
import { TextButton } from "@webview/components/TextButton";
import { useId } from "react";

/** Props for a reusable inline confirmation alert dialog. */
interface ConfirmationDialogProps {
  /** Visible dialog heading and accessible name. */
  readonly title: string;
  /** Explanation of the action being confirmed. */
  readonly message: string;
  /** Localized label for the confirming action. */
  readonly confirmLabel: string;
  /** Localized label for dismissing the confirmation. */
  readonly cancelLabel: string;
  /** Whether either action is unavailable while work is in progress. */
  readonly disabled?: boolean;
  /** Runs when the confirming action is selected. */
  readonly onConfirm: () => void;
  /** Runs when the confirmation is dismissed. */
  readonly onCancel: () => void;
}

/** Renders an inline confirmation alert with a labeled message and actions. */
export function ConfirmationDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  disabled = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps): React.JSX.Element {
  const titleId = useId();
  const messageId = useId();

  return (
    <div
      className="ganttee-confirmation-dialog"
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
    >
      <div className="ganttee-confirmation-dialog__content">
        <h3 id={titleId} className="ganttee-confirmation-dialog__title">
          {title}
        </h3>
        <p id={messageId} className="ganttee-confirmation-dialog__message">
          {message}
        </p>
      </div>
      <div className="ganttee-confirmation-dialog__actions">
        <TextButton variant="primary" disabled={disabled} onClick={onConfirm}>
          {confirmLabel}
        </TextButton>
        <TextButton variant="secondary" disabled={disabled} onClick={onCancel}>
          {cancelLabel}
        </TextButton>
      </div>
    </div>
  );
}
