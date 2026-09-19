import { EffectiveSchedule } from "@common/models/project-snapshot/effectiveSchedule";
import { Task } from "@common/models/project/task";

/** A task and its optional effective schedule. */
export interface ProjectTaskSnapshot {
  /** Entity discriminator. */
  readonly kind: "task";
  /** Hydrated authored task. */
  readonly item: Task;
  /** Effective values when scheduling succeeded. */
  readonly effective?: EffectiveSchedule;
}
