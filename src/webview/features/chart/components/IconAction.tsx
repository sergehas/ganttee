import { useState } from "react";

/** A leaf action or nested action group shown by an icon control. */
export interface IconActionItem {
  /** Stable action identifier. */
  readonly id: string;
  /** Codicon name without the `codicon-` prefix. */
  readonly icon: string;
  /** Accessible and tooltip label. */
  readonly label: string;
  /** Runs when the leaf action is selected. */
  readonly onSelect?: () => void;
  /** Nested actions shown in a small menu. */
  readonly children?: readonly IconActionItem[];
}

interface IconActionProps {
  /** Action definition to render. */
  readonly action: IconActionItem;
  /** Whether the leaf action represents an active layer. */
  readonly pressed?: boolean;
}

/** Renders a localized icon-only action or a nested icon-action group. */
export function IconAction({
  action,
  pressed = false,
}: IconActionProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const hasChildren = Boolean(action.children?.length);

  if (hasChildren) {
    return (
      <div className="ganttee-icon-action-group">
        <button
          type="button"
          className="ganttee-icon-button"
          aria-label={action.label}
          aria-expanded={open}
          title={action.label}
          onClick={() => setOpen((current) => !current)}
        >
          <span
            className={`codicon codicon-${action.icon}`}
            aria-hidden="true"
          />
        </button>
        {open && (
          <div className="ganttee-icon-action-menu" role="menu">
            {action.children?.map((child) => (
              <button
                type="button"
                role="menuitem"
                className="ganttee-icon-action-menu__item"
                key={child.id}
                onClick={() => {
                  child.onSelect?.();
                  setOpen(false);
                }}
              >
                <span
                  className={`codicon codicon-${child.icon}`}
                  aria-hidden="true"
                />
                <span>{child.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="ganttee-icon-button"
      aria-label={action.label}
      aria-pressed={pressed}
      title={action.label}
      onClick={action.onSelect}
    >
      <span className={`codicon codicon-${action.icon}`} aria-hidden="true" />
    </button>
  );
}
