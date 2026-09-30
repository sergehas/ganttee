import "@webview/components/BooleanToggleField.scss";

/** Label placement for a Boolean switch field. */
type BooleanToggleLabelPosition = "left" | "right";

/** Props for an accessible labeled Boolean switch. */
interface BooleanToggleFieldProps {
  /** Localized visible label and accessible name. */
  readonly label: string;
  /** Current Boolean value. */
  readonly checked: boolean;
  /** Receives the next Boolean value when the switch changes. */
  readonly onChange: (checked: boolean) => void;
  /** Which side of the switch displays the label. */
  readonly labelPosition?: BooleanToggleLabelPosition;
  /** Whether the switch is unavailable for interaction. */
  readonly disabled?: boolean;
}

/** Renders a labeled switch with its label on either side. */
export function BooleanToggleField({
  label,
  checked,
  onChange,
  labelPosition = "left",
  disabled = false,
}: BooleanToggleFieldProps): React.JSX.Element {
  const labelElement = <span>{label}</span>;

  /** Converts the native checkbox event into the component's Boolean contract. */
  function handleChange(event: React.ChangeEvent<HTMLInputElement>): void {
    onChange(event.currentTarget.checked);
  }

  const toggleElement = (
    <input
      type="checkbox"
      role="switch"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={handleChange}
    />
  );

  return (
    <label
      className={`ganttee-boolean-toggle-field ganttee-boolean-toggle-field--label-${labelPosition}`}
    >
      {labelElement}
      {toggleElement}
    </label>
  );
}
