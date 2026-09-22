import { EffectiveSchedule } from "@common/models/project-snapshot/effectiveSchedule";
import { Milestone } from "@common/models/project/milestone";

/** A milestone and its optional effective schedule. */
export interface ProjectMilestoneSnapshot {
  /** Entity discriminator. */
  readonly kind: "milestone";
  /** Hydrated authored milestone. */
  readonly item: Milestone;
  /** Effective values when scheduling succeeded. */
  readonly effective?: EffectiveSchedule;
}
