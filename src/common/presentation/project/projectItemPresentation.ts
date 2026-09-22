import { Group, Milestone, Task } from "@common/documents";
import { EffectiveSchedulePresentation } from "@common/presentation/project/effectiveSchedulePresentation";

/** Authored task fields enriched with computed schedule values. */
export interface TaskPresentation extends Task, EffectiveSchedulePresentation {}

/** Authored milestone fields enriched with computed schedule values. */
export interface MilestonePresentation extends Milestone, EffectiveSchedulePresentation {}

/** Authored group fields enriched with computed rollup values. */
export interface GroupPresentation extends Group, EffectiveSchedulePresentation {}
