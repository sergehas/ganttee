import "@webview/components/StatusNotice.scss";
import { IconButton } from "@webview/components/IconButton";
import { useTranslate } from "@webview/l10n";
import { useEffect, useState } from "react";

/** Visual severity used by a status notice. */
export type StatusNoticeSeverity = "success" | "info" | "warning" | "error";

/** Codicon glyph used to identify each notice severity. */
const severityIcons: Record<StatusNoticeSeverity, string> = {
  success: "pass",
  info: "info",
  warning: "warning",
  error: "error",
};

/** Props for a reusable status notice. */
export interface StatusNoticeProps {
  /** Determines the VS Code severity treatment. */
  readonly severity: StatusNoticeSeverity;
  /** Text that describes the current status. */
  readonly children: string;
  /** Optional time in milliseconds before the notice is dismissed. */
  readonly timeout?: number;
}

/** Renders a themed status notice with optional timed dismissal. */
export function StatusNotice(props: StatusNoticeProps): React.JSX.Element {
  const translate = useTranslate();
  const [visible, setVisible] = useState(true);
  const role = props.severity === "error" ? "alert" : "status";
  const icon = severityIcons[props.severity];

  /** Hides the current notice when its close action or timeout is triggered. */
  function dismiss(): void {
    setVisible(false);
  }

  useEffect(
    /** Restores changed notices and schedules their optional dismissal. */
    function scheduleDismissal(): (() => void) | undefined {
      setVisible(true);
      if (props.timeout === undefined) {
        return undefined;
      }

      const timeoutId = window.setTimeout(dismiss, props.timeout);
      return function clearDismissalTimeout(): void {
        window.clearTimeout(timeoutId);
      };
    },
    [props.children, props.severity, props.timeout],
  );

  if (!visible) {
    return <></>;
  }

  return (
    <div className={`ganttee-status-notice ganttee-status-notice--${props.severity}`} role={role}>
      <div className="ganttee-status-notice__content">
        <span
          className={`codicon codicon-${icon} ganttee-status-notice__icon`}
          aria-hidden="true"
        />
        <p className="ganttee-status-notice__text">{props.children}</p>
      </div>
      <IconButton
        icon="close"
        label={translate("Close")}
        className="ganttee-status-notice__close"
        onClick={dismiss}
      />
    </div>
  );
}
