/** Visual severity used by a validation message. */
export type ValidationMessageSeverity = "warning" | "error";

/** Props for a validation message rendered in an entity form. */
export interface ValidationMessageProps {
  /** Determines the VS Code warning or error theme treatment. */
  severity: ValidationMessageSeverity;
  /** Text that describes the current validation state. */
  children: string;
}

/** Renders one warning or blocking-error message for an entity form. */
export function ValidationMessage(props: ValidationMessageProps): JSX.Element {
  const role = props.severity === "error" ? "alert" : "status";
  return (
    <div
      className={`ganttee-validation-message ganttee-validation-message--${props.severity}`}
      role={role}
    >
      <p>{props.children}</p>
    </div>
  );
}
