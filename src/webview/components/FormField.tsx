import "@webview/components/FormField.scss";

/** Props for a labeled form field wrapper. */
interface FormFieldProps {
  /** Visible field label. */
  readonly label: string;
  /** Form control and optional derived value. */
  readonly children: React.ReactNode;
  /** Whether field uses horizontal checkbox layout. */
  readonly checkbox?: boolean;
}

/** Renders consistent label and control layout for editor fields. */
export function FormField({
  label,
  children,
  checkbox = false,
}: FormFieldProps): React.JSX.Element {
  return (
    <label className={`ganttee-form-field${checkbox ? " ganttee-form-field--checkbox" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
