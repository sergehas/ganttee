import { ProjectItem as ProjectItemDocument } from "@common/documents/project/projectItem";
import { ProjectItem } from "@common/models/project/projectItem";

/** Construction fields for an in-memory group. */
export interface GroupProps extends ProjectItemDocument {
  /** Whether the group is collapsed in the UI. */
  collapsed?: boolean;
  /** Ordered direct-child ids owned by this group. */
  sequence: readonly string[];
}

/** A hydrated named collection of project items. */
export class Group extends ProjectItem {
  /** Whether the group is collapsed in the UI. */
  readonly collapsed?: boolean;
  /** Ordered direct-child ids owned by this group. */
  readonly sequence: readonly string[];

  /**
   * @param props The group fields.
   */
  constructor(props: GroupProps) {
    super(props);
    this.collapsed = props.collapsed;
    this.sequence = props.sequence;
  }
}

/** A group paired with effective dates rolled up from scheduled descendants. */
export interface ScheduledGroup {
  /** Stable group identifier. */
  readonly id: string;
  /** Human-readable group name. */
  readonly name: string;
  /** Parent group identifier, when nested. */
  readonly groupId?: string;
  /** Earliest effective descendant start. */
  readonly effectiveStart: Date;
  /** Latest effective descendant end. */
  readonly effectiveEnd: Date;
  /** Effective duration in working days. */
  readonly effectiveDuration: number;
}
