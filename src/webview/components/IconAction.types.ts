/** UI-ready data for a leaf action or nested action group shown by an icon control. */
export interface IconActionPresentation {
  /** Stable action identifier. */
  readonly id: string;
  /** Codicon name without the `codicon-` prefix. */
  readonly icon: string;
  /** Accessible and tooltip label. */
  readonly label: string;
  /** Whether the action represents an active state. */
  readonly pressed?: boolean;
  /** Runs when the leaf action is selected. */
  readonly onSelect?: () => void;
  /** Nested actions shown in a small menu. */
  readonly children?: readonly IconActionPresentation[];
}
