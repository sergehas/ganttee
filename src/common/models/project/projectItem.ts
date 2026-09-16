import { ProjectItem as ProjectItemDocument } from "@common/documents/project/projectItem";

/** A project item that can resolve its effective scheduled time span. */
export interface Schedulable {
  /** Returns the resolved start date. */
  effectiveStart(): Date;
  /** Returns the resolved end date. */
  effectiveEnd(): Date;
  /** Returns the resolved duration in decimal days. */
  effectiveDuration(): number;
}

/** Raised when a project item cannot derive an effective schedule. */
export class UnresolvableScheduleError extends Error {}

/** Shared in-memory identity model for tasks, milestones, and groups. */
export abstract class ProjectItem implements ProjectItemDocument {
  /** Stable unique identifier. */
  readonly id: string;
  /** Human-readable display name. */
  readonly name: string;
  /** Optional free-form description. */
  readonly description?: string;
  /** Owning group id, if any. */
  readonly groupId?: string;

  /**
   * @param document The persisted shared item fields to hydrate.
   */
  constructor(document: ProjectItemDocument) {
    this.id = document.id;
    this.name = document.name;
    this.description = document.description;
    this.groupId = document.groupId;
  }
}
