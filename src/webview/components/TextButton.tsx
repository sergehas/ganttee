import "@webview/components/TextButton.scss";

/** Visual treatment supported by a text button. */
export type TextButtonVariant = "primary" | "secondary" | "danger";

/** Props for a keyboard-accessible anchor styled as a text button. */
export interface TextButtonProps {
  /** Button label. */
  readonly children: React.ReactNode;
  /** Visual treatment for the action. */
  readonly variant?: TextButtonVariant;
  /** Whether the action is unavailable. */
  readonly disabled?: boolean;
  /** Accessible name when it should differ from the visible label. */
  readonly ariaLabel?: string;
  /** Runs when the action is activated. */
  readonly onClick: () => void;
}

/** Renders an anchor with button semantics and keyboard activation. */
export function TextButton({
  children,
  variant,
  disabled = false,
  ariaLabel,
  onClick,
}: TextButtonProps): React.JSX.Element {
  const className = `ganttee-text-button ganttee-text-button--${variant}`;

  /** Prevents navigation and ignores activation while disabled. */
  function handleClick(event: React.MouseEvent<HTMLAnchorElement>): void {
    event.preventDefault();
    if (!disabled) {
      onClick();
    }
  }

  /** Activates on Enter and prevents Space from scrolling the page. */
  function handleKeyDown(event: React.KeyboardEvent<HTMLAnchorElement>): void {
    if (disabled) {
      return;
    }
    if (event.key === "Enter" && !event.repeat) {
      event.preventDefault();
      onClick();
    } else if (event.key === " ") {
      event.preventDefault();
    }
  }

  /** Activates on Space to match native button keyboard behavior. */
  function handleKeyUp(event: React.KeyboardEvent<HTMLAnchorElement>): void {
    if (!disabled && event.key === " ") {
      event.preventDefault();
      onClick();
    }
  }

  return (
    <a
      className={className}
      role="button"
      aria-label={ariaLabel}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      {children}
    </a>
  );
}
