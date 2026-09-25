/**
 * Hydration and serialization between the plain, ISO-string document shape and
 * the `Date`-typed, object-oriented {@link ProjectModel}.
 *
 * The plain {@link ProjectDocument} remains the persisted/wire representation; the
 * hydrated model is a host-in-memory computed view. This service is
 * framework-agnostic and must not import from "vscode".
 */

import { formatIsoDate, parseIsoDate } from "@common/dates";
import {
  Group as GroupDocument,
  Milestone as MilestoneDocument,
  ProjectDocument,
  ProjectItem as ProjectItemDocument,
  Task as TaskDocument,
} from "@common/documents";
import { Group, Milestone, ProjectItem, ProjectModel, Task } from "@common/models";
import { assertAcyclicGraph } from "@services/dependency-graph/dependencyGraphService";

/**
 * Converts a validated plain document into a {@link ProjectModel}, parsing each
 * ISO date string into a `Date` and asserting that the dependency set forms a
 * directed acyclic graph.
 *
 * @param projectDoc The plain document to hydrate.
 * @returns The hydrated in-memory model.
 * @throws {SelfLoopDependencyError} When a dependency links an entity to itself.
 * @throws {ParallelEdgeDependencyError} When two dependencies share the same
 * source/target pair.
 * @throws {CyclicDependencyError} When the dependencies close a directed cycle.
 */
export function hydrateDocument(projectDoc: ProjectDocument): ProjectModel {
  const tasks = projectDoc.tasks.map(toTask);
  const milestones = projectDoc.milestones.map(toMilestone);
  const groups = projectDoc.groups.map(toGroup);
  const dependencies = projectDoc.dependencies.map((dependency) => ({
    ...dependency,
  }));
  return new ProjectModel(
    tasks,
    milestones,
    groups,
    dependencies,
    projectDoc.version,
    assertAcyclicGraph(projectDoc),
    projectDoc.settings,
    projectDoc.view,
    projectDoc.sequence ?? [],
  );
}

/**
 * Converts a {@link ProjectModel} back into a plain document, formatting each
 * `Date` as a date-only ISO string. Field order mirrors the parser so a
 * parse → hydrate → serialize round-trip is byte-stable.
 *
 * @param model The in-memory model to project.
 * @returns The plain, serializable document.
 */
export function toDocument(model: ProjectModel): ProjectDocument {
  const projectDoc: ProjectDocument = {
    version: model.version,
    tasks: model.tasks.map(fromTask),
    groups: model.groups.map(fromGroup),
    milestones: model.milestones.map(fromMilestone),
    dependencies: model.dependencies.map((dependency) => ({ ...dependency })),
    sequence: [...model.sequence],
    settings: model.settings,
    view: model.view,
  };
  return projectDoc;
}

/** Maps a plain task record to a {@link Task}. */
function toTask(task: TaskDocument): Task {
  return new Task({
    ...toProjectItem(task),
    start: task.start !== undefined ? parseIsoDate(task.start) : undefined,
    end: task.end !== undefined ? parseIsoDate(task.end) : undefined,
    duration: task.duration,
    progress: task.progress,
  });
}

/** Maps a plain milestone record to a {@link Milestone}. */
function toMilestone(milestone: MilestoneDocument): Milestone {
  return new Milestone({
    ...toProjectItem(milestone),
    date: milestone.date !== undefined ? parseIsoDate(milestone.date) : undefined,
  });
}

/** Maps a plain group record to a {@link Group}. */
function toGroup(group: GroupDocument): Group {
  return new Group({
    ...toProjectItem(group),
    collapsed: group.collapsed,
    sequence: group.sequence ?? [],
  });
}

/** Maps shared document fields to the in-memory project item constructor shape. */
function toProjectItem(projectItem: ProjectItemDocument): ProjectItemDocument {
  return {
    id: projectItem.id,
    name: projectItem.name,
    description: projectItem.description,
    groupId: projectItem.groupId,
    state: projectItem.state,
    status: projectItem.status,
  };
}

/** Projects a {@link Task} back to a plain task record. */
function fromTask(task: Task): TaskDocument {
  const plain: TaskDocument = { ...fromProjectItem(task) };
  if (task.start !== undefined) {
    plain.start = formatIsoDate(task.start);
  }
  if (task.end !== undefined) {
    plain.end = formatIsoDate(task.end);
  }
  if (task.duration !== undefined) {
    plain.duration = task.duration;
  }
  if (task.progress !== undefined) {
    plain.progress = task.progress;
  }
  return plain;
}

/** Projects a {@link Group} back to a plain group record. */
function fromGroup(group: Group): GroupDocument {
  const plain: GroupDocument = { ...fromProjectItem(group), sequence: [...group.sequence] };
  if (group.collapsed !== undefined) {
    plain.collapsed = group.collapsed;
  }
  return plain;
}

/** Projects a {@link Milestone} back to a plain milestone record. */
function fromMilestone(milestone: Milestone): MilestoneDocument {
  const plain: MilestoneDocument = {
    ...fromProjectItem(milestone),
  };
  if (milestone.date !== undefined) {
    plain.date = formatIsoDate(milestone.date);
  }
  return plain;
}

/** Maps shared in-memory fields to their persisted project item representation. */
function fromProjectItem(projectItem: ProjectItem): ProjectItemDocument {
  const document: ProjectItemDocument = { id: projectItem.id, name: projectItem.name };
  if (projectItem.description !== undefined) {
    document.description = projectItem.description;
  }
  if (projectItem.groupId !== undefined) {
    document.groupId = projectItem.groupId;
  }
  if (projectItem.state !== undefined) {
    document.state = projectItem.state;
  }
  if (projectItem.status !== undefined) {
    document.status = projectItem.status;
  }
  return document;
}
