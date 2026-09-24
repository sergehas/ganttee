import { isIconName } from "@common/icons";
import { Icon } from "@webview/components/Icon";
import "@webview/components/IconButton.scss";

/** Props for a compact icon-only action button. */
interface IconButtonProps {
  /** Codicon name without the `codicon-` prefix. */
  readonly icon: string;
  /** Accessible and tooltip label. */
  readonly label: string;
  /** Whether the action represents an active state. */
  readonly pressed?: boolean;
  /** Runs when the button is selected. */
  readonly onClick?: () => void;
  /** Indicates that the button controls a popup menu. */
  readonly hasPopup?: boolean;
  /** Indicates whether the controlled popup menu is open. */
  readonly expanded?: boolean;
  /** HTML button behavior. */
  readonly type?: "button" | "submit";
  /** Additional class name appended to the button for layout/style variants. */
  readonly className?: string;
}

/**
 * Renders a shared compact icon-only button.
 * @param props Button icon, label, state, and event properties.
 * @returns Rendered button markup.
 */
export function IconButton({
  icon,
  label,
  pressed,
  onClick,
  hasPopup = false,
  expanded,
  type = "button",
  className,
}: IconButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      className={className ? `ganttee-icon-button ${className}` : "ganttee-icon-button"}
      aria-label={label}
      aria-pressed={pressed}
      aria-haspopup={hasPopup ? "menu" : undefined}
      aria-expanded={hasPopup ? expanded : undefined}
      title={label}
      onClick={onClick}
    >
      {isIconName(icon) ? (
        <Icon name={icon} />
      ) : (
        <span className={`codicon codicon-${icon}`} aria-hidden="true" />
      )}
    </button>
  );
}
