import { ProjectGroupSnapshot } from "@common/models/project-snapshot/projectGroupSnapshot";
import { ProjectMilestoneSnapshot } from "@common/models/project-snapshot/projectMilestoneSnapshot";
import { ProjectTaskSnapshot } from "@common/models/project-snapshot/projectTaskSnapshot";

/** A project item paired with its current computed schedule. */
export type ProjectItemSnapshot =
  ProjectTaskSnapshot | ProjectMilestoneSnapshot | ProjectGroupSnapshot;
