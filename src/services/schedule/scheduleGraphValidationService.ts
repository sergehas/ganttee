/**
 * Semantic validation of a schedule graph.
 *
 * Reports what is wrong with a document as data, never as text: severity plus
 * the ids the problem should be reported against. Localized wording is the
 * host's responsibility, which keeps this module usable from the webview.
 */

import { Dependency, ProjectDocument } from "@common/documents";
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

/** Whether a diagnostic prevents persistence or only warrants a warning. */
export type ScheduleDiagnosticSeverity = "blocking" | "warning";

/** A schedulable endpoint that a diagnostic refers to. */
export type ScheduleEndpoint = "start" | "end";

/** A single semantic problem found in a schedule graph. */
export type ScheduleDiagnostic =
  | {
      kind: "underConstrained";
      severity: "blocking";
      entityIds: readonly string[];
      count: number;
    }
  | {
      kind: "overConstrained";
      severity: ScheduleDiagnosticSeverity;
      entityIds: readonly string[];
      count: number;
      duplicateEndpoints: readonly ScheduleEndpoint[];
    }
  | {
      kind: "danglingDependency";
      severity: "blocking";
      entityIds: readonly string[];
      dependencyId: string;
    }
  | {
      kind: "groupDependency";
      severity: "blocking";
      entityIds: readonly string[];
      dependencyId: string;
    }
  | {
      kind: "unanchoredComponent";
      severity: "blocking";
      entityIds: readonly string[];
    };

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
  return [...evaluateScheduleConstraints(projectDoc), ...evaluateScheduleAnchoring(projectDoc)];
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
  return diagnostics.filter((diagnostic) => diagnostic.entityIds.includes(entityId));
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
      entityIds: [entityId],
      count: verdict.count,
    };
  }
  if (!verdict.overConstrained) {
    return undefined;
  }
  return {
    kind: "overConstrained",
    severity: verdict.blocking ? "blocking" : "warning",
    entityIds: [entityId],
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
      entityIds: endpointIds,
      dependencyId: dependency.id,
    };
  }
  if (endpointIds.some((id) => groupIds.has(id))) {
    return {
      kind: "groupDependency",
      severity: "blocking",
      entityIds: endpointIds,
      dependencyId: dependency.id,
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
