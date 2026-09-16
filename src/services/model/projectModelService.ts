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
  Task as TaskDocument,
} from "@common/documents";
import { Group, Milestone, ProjectModel, Task } from "@common/models";
import { assertAcyclicGraph } from "@services/dependency-graph/dependencyGraphService";

/**
 * Converts a validated plain document into a {@link ProjectModel}, parsing each
 * ISO date string into a `Date` and asserting that the dependency set forms a
 * directed acyclic graph.
 *
 * @param document The plain document to hydrate.
 * @returns The hydrated in-memory model.
 * @throws {SelfLoopDependencyError} When a dependency links an entity to itself.
 * @throws {ParallelEdgeDependencyError} When two dependencies share the same
 * source/target pair.
 * @throws {CyclicDependencyError} When the dependencies close a directed cycle.
 */
export function hydrateDocument(document: ProjectDocument): ProjectModel {
  const tasks = document.tasks.map(toTask);
  const milestones = document.milestones.map(toMilestone);
  const groups = document.groups.map(toGroup);
  const dependencies = document.dependencies.map((dependency) => ({
    ...dependency,
  }));
  return new ProjectModel(
    tasks,
    milestones,
    groups,
    dependencies,
    document.version,
    assertAcyclicGraph(document),
    document.settings,
    document.view,
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
  const document: ProjectDocument = {
    version: model.version,
    tasks: model.tasks.map(fromTask),
    groups: model.groups.map(fromGroup),
    milestones: model.milestones.map(fromMilestone),
    dependencies: model.dependencies.map((dependency) => ({ ...dependency })),
    settings: model.settings,
    view: model.view,
  };
  return document;
}

/** Maps a plain task record to a {@link Task}. */
function toTask(task: TaskDocument): Task {
  return new Task({
    id: task.id,
    name: task.name,
    description: task.description,
    groupId: task.groupId,
    start: task.start !== undefined ? parseIsoDate(task.start) : undefined,
    end: task.end !== undefined ? parseIsoDate(task.end) : undefined,
    duration: task.duration,
    progress: task.progress,
    status: task.status,
  });
}

/** Maps a plain milestone record to a {@link Milestone}. */
function toMilestone(milestone: MilestoneDocument): Milestone {
  return new Milestone({
    id: milestone.id,
    name: milestone.name,
    description: milestone.description,
    groupId: milestone.groupId,
    date: milestone.date !== undefined ? parseIsoDate(milestone.date) : undefined,
  });
}

/** Maps a plain group record to a {@link Group}. */
function toGroup(group: GroupDocument): Group {
  return new Group({
    id: group.id,
    name: group.name,
    description: group.description,
    groupId: group.groupId,
    collapsed: group.collapsed,
  });
}

/** Projects a {@link Task} back to a plain task record. */
function fromTask(task: Task): TaskDocument {
  const plain: TaskDocument = { id: task.id, name: task.name };
  if (task.start !== undefined) {
    plain.start = formatIsoDate(task.start);
  }
  if (task.end !== undefined) {
    plain.end = formatIsoDate(task.end);
  }
  if (task.duration !== undefined) {
    plain.duration = task.duration;
  }
  if (task.description !== undefined) {
    plain.description = task.description;
  }
  if (task.progress !== undefined) {
    plain.progress = task.progress;
  }
  if (task.status !== undefined) {
    plain.status = task.status;
  }
  if (task.groupId !== undefined) {
    plain.groupId = task.groupId;
  }
  return plain;
}

/** Projects a {@link Group} back to a plain group record. */
function fromGroup(group: Group): GroupDocument {
  const plain: GroupDocument = { id: group.id, name: group.name };
  if (group.groupId !== undefined) {
    plain.groupId = group.groupId;
  }
  if (group.collapsed !== undefined) {
    plain.collapsed = group.collapsed;
  }
  return plain;
}

/** Projects a {@link Milestone} back to a plain milestone record. */
function fromMilestone(milestone: Milestone): MilestoneDocument {
  const plain: MilestoneDocument = {
    id: milestone.id,
    name: milestone.name,
  };
  if (milestone.date !== undefined) {
    plain.date = formatIsoDate(milestone.date);
  }
  if (milestone.groupId !== undefined) {
    plain.groupId = milestone.groupId;
  }
  return plain;
}
