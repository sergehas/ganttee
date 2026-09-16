import { IconButton } from "@webview/components/IconButton";
import "@webview/features/chart/components/IconAction.scss";
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
export function IconAction({ action, pressed = false }: IconActionProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const hasChildren = Boolean(action.children?.length);

  if (hasChildren) {
    return (
      <div className="ganttee-icon-action">
        <IconButton
          icon={action.icon}
          label={action.label}
          onClick={() => setOpen((current) => !current)}
        />
        {open && (
          <div className="ganttee-icon-action__menu" role="menu">
            {action.children?.map((child) => (
              <button
                type="button"
                role="menuitem"
                className="ganttee-icon-action__menu-item"
                key={child.id}
                onClick={() => {
                  child.onSelect?.();
                  setOpen(false);
                }}
              >
                <span className={`codicon codicon-${child.icon}`} aria-hidden="true" />
                <span>{child.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <IconButton
      icon={action.icon}
      label={action.label}
      pressed={pressed}
      onClick={action.onSelect}
    />
  );
}
