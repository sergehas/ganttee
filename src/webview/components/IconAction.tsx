import "@webview/components/IconAction.scss";
import { IconButton } from "@webview/components/IconButton";
import { useRef, useState } from "react";

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

/**
 * Renders a localized icon-only action or a nested icon-action group.
 * @param action Action definition to render.
 * @param pressed Whether a leaf action is active.
 * @returns Rendered action markup.
 */
export function IconAction({ action, pressed = false }: IconActionProps): React.JSX.Element {
  return <ActionMenu action={action} pressed={pressed} />;
}

/**
 * Renders a leaf action or a recursively nested action menu.
 * @param action Action definition to render.
 * @param pressed Whether a leaf action is active.
 * @returns Rendered action markup.
 */
function ActionMenu({ action, pressed = false }: IconActionProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasChildren = Boolean(action.children?.length);

  if (!hasChildren) {
    return (
      <IconButton
        icon={action.icon}
        label={action.label}
        pressed={pressed}
        onClick={action.onSelect}
      />
    );
  }

  return (
    <div
      className="ganttee-icon-action"
      ref={containerRef}
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <IconButton
        icon={action.icon}
        label={action.label}
        hasPopup
        expanded={open}
        onClick={() => setOpen((current) => !current)}
      />
      {open && (
        <div className="ganttee-icon-action__menu" role="menu">
          {action.children?.map((child) => (
            <ActionMenuItem action={child} closeMenu={() => setOpen(false)} key={child.id} />
          ))}
        </div>
      )}
    </div>
  );
}

interface ActionMenuItemProps {
  /** Action rendered by the menu item. */
  readonly action: IconActionItem;
  /** Closes the owning menu after a leaf action is selected. */
  readonly closeMenu: () => void;
}

/**
 * Renders one menu item; nested children open on hover via CSS.
 * @param action Action definition for this menu item.
 * @param closeMenu Callback that closes the owning menu.
 * @returns Rendered menu item markup.
 */
function ActionMenuItem({ action, closeMenu }: ActionMenuItemProps): React.JSX.Element {
  const hasChildren = Boolean(action.children?.length);

  if (!hasChildren) {
    return (
      <button
        type="button"
        role="menuitem"
        className="ganttee-icon-action__menu-item"
        onClick={() => {
          action.onSelect?.();
          closeMenu();
        }}
      >
        <span className={`codicon codicon-${action.icon}`} aria-hidden="true" />
        <span>{action.label}</span>
        <span
          className="ganttee-icon-action__submenu-indicator codicon codicon-blank"
          aria-hidden="true"
        />
      </button>
    );
  }

  return (
    <div className="ganttee-icon-action__submenu">
      <button
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        className="ganttee-icon-action__menu-item"
      >
        <span className={`codicon codicon-${action.icon}`} aria-hidden="true" />
        <span>{action.label}</span>
        <span
          className="ganttee-icon-action__submenu-indicator codicon codicon-chevron-right"
          aria-hidden="true"
        />
      </button>
      <div className="ganttee-icon-action__menu ganttee-icon-action__menu--nested" role="menu">
        {action.children?.map((child) => (
          <ActionMenuItem action={child} closeMenu={closeMenu} key={child.id} />
        ))}
      </div>
    </div>
  );
}
