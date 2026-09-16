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
  /** HTML button behavior. */
  readonly type?: "button" | "submit";
}

/** Renders a shared compact icon-only button. */
export function IconButton({
  icon,
  label,
  pressed,
  onClick,
  type = "button",
}: IconButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      className="ganttee-icon-button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
    >
      <span className={`codicon codicon-${icon}`} aria-hidden="true" />
    </button>
  );
}
