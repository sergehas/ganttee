/**
 * Semantic validation of a schedule graph.
 *
 * Reports what is wrong with a document as data, never as text: severity plus
 * the ids the problem should be reported against. Localized wording is the
 * host's responsibility, which keeps this module usable from the webview.
 */

import { Dependency, ProjectDocument } from "@common/documents";
import {
  ScheduleDiagnostic,
  scheduleDiagnosticEntityIds,
  ScheduleDiagnosticSeverity,
  ScheduleEndpoint,
} from "@common/models";
import {
  anchoredEntityIds,
  schedulableEntityIds,
  unanchoredComponents,
} from "@services/dependency-graph/componentAnchoringService";
import { createSchedulableGraph } from "@services/dependency-graph/dependencyGraphService";
import {
  ConstraintVerdict,
  validateMilestoneConstraints,
  validateTaskConstraints,
} from "@services/schedule/scheduleConstraintService";

export type { ScheduleDiagnostic, ScheduleDiagnosticSeverity, ScheduleEndpoint };

/**
 * Evaluates the semantic rules a structurally valid document must also satisfy:
 * per-entity determinacy, dependency endpoints, and component anchoring.
 *
 * @param projectDoc The document to evaluate.
 * @returns Every diagnostic found, in entity then dependency then component order.
 */
export function evaluateScheduleDiagnostics(
  projectDoc: ProjectDocument,
): readonly ScheduleDiagnostic[] {
  return [
    ...evaluateWorkingCalendar(projectDoc),
    ...evaluateScheduleConstraints(projectDoc),
    ...evaluateScheduleAnchoring(projectDoc),
  ];
}

/** Validates calendar values that could otherwise make traversal impossible. */
function evaluateWorkingCalendar(projectDoc: ProjectDocument): readonly ScheduleDiagnostic[] {
  const { daysOff } = projectDoc.settings.workingCalendar;
  const uniqueDaysOff = new Set(daysOff);
  const invalidDaysOff = daysOff.some((day) => !Number.isInteger(day) || day < 1 || day > 7);
  const invalidHours =
    !Number.isFinite(projectDoc.settings.workingDayHours) ||
    projectDoc.settings.workingDayHours <= 0 ||
    projectDoc.settings.workingDayHours > 24;
  const invalidStart =
    !Number.isFinite(projectDoc.settings.workingDayStart) ||
    projectDoc.settings.workingDayStart < 0 ||
    projectDoc.settings.workingDayStart >= 24;
  if (!invalidDaysOff && uniqueDaysOff.size < 7 && !invalidHours && !invalidStart) {
    return [];
  }
  return [{ kind: "invalidWorkingCalendar", severity: "blocking" }];
}

/**
 * Evaluates determinacy and dependency endpoint rules without component anchoring.
 *
 * @param projectDoc The document to evaluate.
 * @returns Constraint and endpoint diagnostics in entity then dependency order.
 */
export function evaluateScheduleConstraints(
  projectDoc: ProjectDocument,
): readonly ScheduleDiagnostic[] {
  const entityIds = new Set([
    ...projectDoc.tasks.map((task) => task.id),
    ...projectDoc.milestones.map((milestone) => milestone.id),
    ...projectDoc.groups.map((group) => group.id),
  ]);
  const groupIds = new Set(projectDoc.groups.map((group) => group.id));

  const determinacy = [
    ...projectDoc.tasks.map((task) =>
      diagnoseDeterminacy(task.id, validateTaskConstraints(task, projectDoc.dependencies)),
    ),
    ...projectDoc.milestones.map((milestone) =>
      diagnoseDeterminacy(
        milestone.id,
        validateMilestoneConstraints(milestone, projectDoc.dependencies),
      ),
    ),
  ].filter((diagnostic): diagnostic is ScheduleDiagnostic => diagnostic !== undefined);

  const endpoints = projectDoc.dependencies
    .map((dependency) => diagnoseEndpoints(dependency, entityIds, groupIds))
    .filter((diagnostic): diagnostic is ScheduleDiagnostic => diagnostic !== undefined);

  return [...determinacy, ...endpoints];
}

/**
 * Evaluates whether every schedulable dependency component has an absolute date anchor.
 *
 * @param projectDoc The document to evaluate.
 * @returns One diagnostic per unanchored component.
 */
export function evaluateScheduleAnchoring(
  projectDoc: ProjectDocument,
): readonly ScheduleDiagnostic[] {
  const graph = createSchedulableGraph(projectDoc);
  const schedulable = schedulableEntityIds(projectDoc);
  return unanchoredComponents(
    graph.connectedComponents(),
    anchoredEntityIds(projectDoc),
    schedulable,
  ).map((component) => ({
    kind: "unanchoredComponent",
    severity: "blocking",
    entityIds: component.filter((id) => schedulable.has(id)),
  }));
}

/** Returns the diagnostics that must stop the document from being persisted. */
export function blockingDiagnostics(
  diagnostics: readonly ScheduleDiagnostic[],
): readonly ScheduleDiagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.severity === "blocking");
}

/**
 * Returns whether any diagnostic prevents persistence.
 *
 * @param diagnostics The diagnostics to inspect.
 */
export function hasBlockingScheduleDiagnostic(diagnostics: readonly ScheduleDiagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "blocking");
}

/**
 * Returns the diagnostics that should be reported against one entity.
 *
 * @param diagnostics The diagnostics to filter.
 * @param entityId The entity to report against.
 */
export function diagnosticsFor(
  diagnostics: readonly ScheduleDiagnostic[],
  entityId: string,
): readonly ScheduleDiagnostic[] {
  return diagnostics.filter((diagnostic) =>
    scheduleDiagnosticEntityIds(diagnostic).includes(entityId),
  );
}

/** Turns a determinacy verdict into a diagnostic, if the entity has a problem. */
function diagnoseDeterminacy(
  entityId: string,
  verdict: ConstraintVerdict,
): ScheduleDiagnostic | undefined {
  if (verdict.underConstrained) {
    return {
      kind: "underConstrained",
      severity: "blocking",
      entityId,
      count: verdict.count,
    };
  }
  if (!verdict.overConstrained) {
    return undefined;
  }
  return {
    kind: "overConstrained",
    severity: verdict.blocking ? "blocking" : "warning",
    entityId,
    count: verdict.count,
    duplicateEndpoints: duplicatedEndpoints(verdict),
  };
}

/** Reports a dependency whose endpoints are missing or are groups. */
function diagnoseEndpoints(
  dependency: Dependency,
  entityIds: ReadonlySet<string>,
  groupIds: ReadonlySet<string>,
): ScheduleDiagnostic | undefined {
  const endpointIds = [dependency.sourceId, dependency.targetId];
  if (!endpointIds.every((id) => entityIds.has(id))) {
    return {
      kind: "danglingDependency",
      severity: "blocking",
      dependencyId: dependency.id,
      sourceId: dependency.sourceId,
      targetId: dependency.targetId,
    };
  }
  if (endpointIds.some((id) => groupIds.has(id))) {
    return {
      kind: "groupDependency",
      severity: "blocking",
      dependencyId: dependency.id,
      sourceId: dependency.sourceId,
      targetId: dependency.targetId,
    };
  }
  return undefined;
}

/** Lists the endpoints that are constrained both statically and by a dependency. */
function duplicatedEndpoints(verdict: ConstraintVerdict): readonly ScheduleEndpoint[] {
  const endpoints: ScheduleEndpoint[] = [];
  if (verdict.duplicateStart) {
    endpoints.push("start");
  }
  if (verdict.duplicateEnd) {
    endpoints.push("end");
  }
  return endpoints;
}
