import { EffectiveSchedule } from "@common/models/project-snapshot/effectiveSchedule";
import { Group } from "@common/models/project/group";

/** A group and its optional rolled-up schedule. */
export interface ProjectGroupSnapshot {
  /** Entity discriminator. */
  readonly kind: "group";
  /** Hydrated authored group. */
  readonly item: Group;
  /** Effective values when scheduled descendants exist. */
  readonly effective?: EffectiveSchedule;
}
