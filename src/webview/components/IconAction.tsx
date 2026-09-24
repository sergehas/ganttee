import "@webview/components/IconAction.scss";
import type { IconActionPresentation } from "@webview/components/IconAction.types";
import { IconButton } from "@webview/components/IconButton";
import { useTranslate } from "@webview/l10n";
import { useRef, useState } from "react";

interface IconActionProps {
  /** Action definition to render. */
  readonly action: IconActionPresentation;
}

/**
 * Renders a localized icon-only leaf action.
 * @param action Action definition to render.
 * @returns Rendered action markup.
 */
export function IconAction({ action }: IconActionProps): React.JSX.Element {
  return (
    <IconButton
      icon={action.icon}
      label={action.label}
      pressed={action.pressed}
      onClick={action.onSelect}
    />
  );
}

/**
 * Renders an action menu button: the main icon triggers the default action when one exists,
 * otherwise it opens the menu; a dedicated disclosure control always opens the menu.
 * @param action Action definition to render.
 * @returns Rendered action markup.
 */
export function IconActionMenu({ action }: IconActionProps): React.JSX.Element {
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
        pressed={action.pressed}
        hasPopup={!action.onSelect}
        expanded={action.onSelect ? undefined : open}
        onClick={action.onSelect ?? (() => setOpen((current) => !current))}
      />

      <IconButton
        icon="chevron-down"
        label={t("More Actions")}
        className="ganttee-icon-action__disclosure"
        pressed={open}
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
  readonly action: IconActionPresentation;
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
