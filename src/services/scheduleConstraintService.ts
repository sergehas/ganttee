/**
 * Endpoint-level scheduling constraint rules shared by the extension host and
 * the webview.
 *
 * Every rule in this module is expressed over {@link EndpointConstraints}: a
 * description of which sources constrain a schedulable's start and end. Tasks
 * and milestones share that primitive but not the verdict, because a milestone's
 * start and end are the same instant.
 */

import { Dependency, Milestone, Task } from "../common/models";

/** Where a constraint on a schedulable endpoint comes from. */
export type ConstraintSource = "static" | "dependency";

/** Which sources constrain each endpoint of a schedulable entity. */
export interface EndpointConstraints {
  /** Sources that fix the start endpoint. */
  readonly start: readonly ConstraintSource[];
  /** Sources that fix the end endpoint. */
  readonly end: readonly ConstraintSource[];
  /** Whether the span between the endpoints is known. */
  readonly hasDuration: boolean;
}

/** The determinacy ruling for one schedulable entity. */
export interface ConstraintVerdict {
  /** Number of independent constraints, out of the two that determinacy needs. */
  count: number;
  /** Whether the start is fixed both statically and by a dependency. */
  duplicateStart: boolean;
  /** Whether the end is fixed both statically and by a dependency. */
  duplicateEnd: boolean;
  /** Whether the entity has too few independent constraints to be scheduled. */
  underConstrained: boolean;
  /** Whether the entity carries a redundant or conflicting constraint. */
  overConstrained: boolean;
  /** Whether the entity may not be persisted in this state. */
  blocking: boolean;
}

/**
 * Describes which sources constrain a task's endpoints.
 *
 * @param task The task to inspect.
 * @param dependencies Every dependency in the document.
 * @returns The endpoint constraints for `task`.
 */
export function describeTaskEndpointConstraints(
  task: Task,
  dependencies: readonly Dependency[],
): EndpointConstraints {
  return {
    start: sourcesOf(task.start !== undefined, constrainsStart(task.id, dependencies)),
    end: sourcesOf(task.end !== undefined, constrainsEnd(task.id, dependencies)),
    hasDuration: task.duration !== undefined,
  };
}

/**
 * Describes which sources constrain a milestone's endpoints. A static `date`
 * fixes both endpoints at once, because a milestone has zero duration.
 *
 * @param milestone The milestone to inspect.
 * @param dependencies Every dependency in the document.
 * @returns The endpoint constraints for `milestone`.
 */
export function describeMilestoneEndpointConstraints(
  milestone: Milestone,
  dependencies: readonly Dependency[],
): EndpointConstraints {
  const hasDate = milestone.date !== undefined && milestone.date.length > 0;
  return {
    start: sourcesOf(hasDate, constrainsStart(milestone.id, dependencies)),
    end: sourcesOf(hasDate, constrainsEnd(milestone.id, dependencies)),
    hasDuration: true,
  };
}

/**
 * Rules on a task's determinacy: exactly two of {start, duration, end} must be
 * fixed, and no endpoint may be fixed twice.
 *
 * @param constraints The task's endpoint constraints.
 * @returns The determinacy verdict.
 */
export function judgeTaskConstraints(
  constraints: EndpointConstraints,
): ConstraintVerdict {
  const count =
    Number(constraints.start.length > 0) +
    Number(constraints.hasDuration) +
    Number(constraints.end.length > 0);
  const duplicateStart = constraints.start.length > 1;
  const duplicateEnd = constraints.end.length > 1;
  const duplicateEndpoint = duplicateStart || duplicateEnd;
  const underConstrained = count < 2 && !duplicateEndpoint;
  const tooManyConstraints = count > 2;

  return {
    count,
    duplicateStart,
    duplicateEnd,
    underConstrained,
    overConstrained: tooManyConstraints || duplicateEndpoint,
    blocking: underConstrained || tooManyConstraints,
  };
}

/**
 * Rules on a milestone's determinacy: its single date must be fixed exactly
 * once, either statically or by one class of outgoing dependency.
 *
 * @param constraints The milestone's endpoint constraints.
 * @returns The determinacy verdict.
 */
export function judgeMilestoneConstraints(
  constraints: EndpointConstraints,
): ConstraintVerdict {
  const hasStaticDate = constraints.start.includes("static");
  const startFromDependency = constraints.start.includes("dependency");
  const endFromDependency = constraints.end.includes("dependency");
  const hasDate = hasStaticDate || startFromDependency || endFromDependency;
  const duplicateDate =
    hasStaticDate && (startFromDependency || endFromDependency);
  const contradictoryDependencies =
    !hasStaticDate && startFromDependency && endFromDependency;

  return {
    count: hasDate ? 2 : 0,
    duplicateStart: duplicateDate,
    duplicateEnd: duplicateDate,
    underConstrained: !hasDate,
    overConstrained: duplicateDate || contradictoryDependencies,
    blocking: !hasDate || contradictoryDependencies,
  };
}

/**
 * Rules on a task's determinacy directly from the document shape.
 *
 * @param task The task to evaluate.
 * @param dependencies Every dependency in the document.
 * @returns The determinacy verdict.
 */
export function validateTaskConstraints(
  task: Task,
  dependencies: readonly Dependency[],
): ConstraintVerdict {
  return judgeTaskConstraints(
    describeTaskEndpointConstraints(task, dependencies),
  );
}

/**
 * Rules on a milestone's determinacy directly from the document shape.
 *
 * @param milestone The milestone to evaluate.
 * @param dependencies Every dependency in the document.
 * @returns The determinacy verdict.
 */
export function validateMilestoneConstraints(
  milestone: Milestone,
  dependencies: readonly Dependency[],
): ConstraintVerdict {
  return judgeMilestoneConstraints(
    describeMilestoneEndpointConstraints(milestone, dependencies),
  );
}

/** Lists the sources that apply to a single endpoint, in precedence order. */
function sourcesOf(
  fromStatic: boolean,
  fromDependency: boolean,
): readonly ConstraintSource[] {
  const sources: ConstraintSource[] = [];
  if (fromStatic) {
    sources.push("static");
  }
  if (fromDependency) {
    sources.push("dependency");
  }
  return sources;
}

/** Returns whether an outgoing dependency fixes the entity's start. */
function constrainsStart(
  entityId: string,
  dependencies: readonly Dependency[],
): boolean {
  return dependencies.some(
    (dependency) =>
      dependency.sourceId === entityId &&
      (dependency.type === "startAfter" || dependency.type === "startWith"),
  );
}

/** Returns whether an outgoing dependency fixes the entity's end. */
function constrainsEnd(
  entityId: string,
  dependencies: readonly Dependency[],
): boolean {
  return dependencies.some(
    (dependency) =>
      dependency.sourceId === entityId && dependency.type === "endWith",
  );
}
