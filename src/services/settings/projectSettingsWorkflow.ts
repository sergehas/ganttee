import { ProjectDocument, ProjectSettings, ProjectStatus } from "@common/documents";

/** Status fields accepted when adding a new project status. */
export type NewProjectStatus = Omit<ProjectStatus, "id">;

/** Intent applied to one weekday's off-day setting. */
type DayOffAction = "add" | "remove";

/** Counts current group, task, and milestone assignments to one status. */
export function countProjectStatusUsage(
  document: Pick<ProjectDocument, "groups" | "tasks" | "milestones">,
  statusId: string,
): number {
  return [...document.groups, ...document.tasks, ...document.milestones].filter(
    (item) => item.status === statusId,
  ).length;
}

/** Returns a document with one ISO weekday added to or removed from days off. */
export function updateProjectDayOff(
  settings: ProjectSettings,
  weekday: number,
  action: DayOffAction,
): ProjectSettings {
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    throw new RangeError("Weekday must be an ISO weekday from 1 to 7.");
  }

  const currentDaysOff = settings.workingCalendar.daysOff;
  const daysOff =
    action === "add"
      ? [...new Set([...currentDaysOff, weekday])].sort((left, right) => left - right)
      : currentDaysOff.filter((day) => day !== weekday);
  if (
    daysOff.length === currentDaysOff.length &&
    daysOff.every((day, index) => day === currentDaysOff[index])
  ) {
    return settings;
  }

  return {
    ...settings,
    workingCalendar: { ...settings.workingCalendar, daysOff },
  };
}

/** Adds a status using an injected ID source and returns the updated document. */
export function addProjectStatus(
  document: ProjectDocument,
  status: NewProjectStatus,
  createId: () => string,
): ProjectDocument {
  const id = createUniqueStatusId(document.settings.statuses, createId);
  return {
    ...document,
    settings: {
      ...document.settings,
      statuses: [...document.settings.statuses, { ...status, id }],
    },
  };
}

/** Replaces one status definition without changing its identifier or item assignments. */
export function updateProjectStatus(
  document: ProjectDocument,
  status: ProjectStatus,
): ProjectDocument | undefined {
  if (!document.settings.statuses.some((candidate) => candidate.id === status.id)) {
    return undefined;
  }

  return {
    ...document,
    settings: {
      ...document.settings,
      statuses: document.settings.statuses.map((candidate) =>
        candidate.id === status.id ? { ...status } : candidate,
      ),
    },
  };
}

/** Removes a status and clears its references from every project item kind. */
export function deleteProjectStatus(
  document: ProjectDocument,
  statusId: string,
): ProjectDocument | undefined {
  if (!document.settings.statuses.some((status) => status.id === statusId)) {
    return undefined;
  }

  return {
    ...document,
    settings: {
      ...document.settings,
      statuses: document.settings.statuses.filter((status) => status.id !== statusId),
    },
    tasks: document.tasks.map((task) => clearStatusReference(task, statusId)),
    groups: document.groups.map((group) => clearStatusReference(group, statusId)),
    milestones: document.milestones.map((milestone) => clearStatusReference(milestone, statusId)),
  };
}

/** Generates a status id that does not collide with an existing status id. */
function createUniqueStatusId(statuses: readonly ProjectStatus[], createId: () => string): string {
  let id = createId();
  while (statuses.some((status) => status.id === id)) {
    id = createId();
  }
  return id;
}

/** Clears one matching status reference while preserving the rest of the item. */
function clearStatusReference<T extends { status?: string }>(item: T, statusId: string): T {
  return item.status === statusId ? { ...item, status: undefined } : item;
}
