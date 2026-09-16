import "@webview/components/Select.scss";
import type { SelectHTMLAttributes } from "react";

/** Visual variants supported by the shared select component. */
type SelectVariant = "default" | "compact";

/** Props for the shared themed select control. */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Select sizing variant. */
  readonly variant?: SelectVariant;
}

/** Renders a VS Code-themed select with consistent picker and option styling. */
export function Select({
  variant = "default",
  className,
  ...props
}: SelectProps): React.JSX.Element {
  const classes = ["ganttee-select", `ganttee-select--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return <select className={classes} {...props} />;
}
