import { MILESTONE_DURATION } from "@common/documents/project/milestone";
import { ProjectItem as ProjectItemDocument } from "@common/documents/project/projectItem";
import { ProjectItem, UnresolvableScheduleError } from "@common/models/project/projectItem";

/** Construction fields for an in-memory milestone. */
export interface MilestoneProps extends ProjectItemDocument {
  /** The milestone's canonical date. */
  date?: Date;
}

/** A hydrated zero-duration marker whose start and end alias its date. */
export class Milestone extends ProjectItem {
  /** The milestone's canonical date. */
  readonly date?: Date;

  /**
   * @param props The milestone fields, with the date already parsed to `Date`.
   */
  constructor(props: MilestoneProps) {
    super(props);
    this.date = props.date;
  }

  /** Returns the resolved start date. */
  effectiveStart(): Date {
    if (this.date === undefined) {
      throw new UnresolvableScheduleError(
        `Milestone "${this.id}" is under-constrained: cannot derive a date.`,
      );
    }
    return this.date;
  }

  /** Returns the resolved end date. */
  effectiveEnd(): Date {
    return this.effectiveStart();
  }

  /** Returns the effective duration in working days. */
  effectiveDuration(): number {
    return MILESTONE_DURATION;
  }
}
