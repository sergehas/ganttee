/**
 * Localized wording for schedule diagnostics.
 *
 * This is the only place that turns a {@link ScheduleDiagnostic} into text. The
 * services that produce diagnostics stay free of `vscode`, so the webview can
 * import them; anything user-facing is resolved here on the host.
 */

import { scheduleDiagnosticEntityIds } from "@common/models";
import { ScheduleDiagnostic } from "@services/schedule/scheduleGraphValidationService";
import * as vscode from "vscode";

/**
 * Describes one diagnostic, phrased around a specific entity when the
 * diagnostic spans more than one.
 *
 * Determinacy, dependency, and calendar diagnostics already name their
 * subject unambiguously (an `entityId`, a `dependencyId`, or nothing), so
 * `contextEntityId` is only read for `unanchoredComponent`, whose
 * `entityIds` can list every member of a connected component and the caller
 * must pick which one the message is shown against.
 *
 * @param diagnostic The diagnostic to describe.
 * @param contextEntityId The entity to phrase a multi-entity diagnostic around.
 * @returns A localized, human-readable sentence.
 */
export function describeDiagnostic(
  diagnostic: ScheduleDiagnostic,
  contextEntityId: string,
): string {
  switch (diagnostic.kind) {
    case "underConstrained":
      return vscode.l10n.t(
        "Task '{0}' is under-constrained ({1} constraints, need 2).",
        diagnostic.entityId,
        String(diagnostic.count),
      );
    case "overConstrained":
      return diagnostic.duplicateEndpoints.length > 0
        ? vscode.l10n.t(
            "Task '{0}' has a duplicate {1} constraint.",
            diagnostic.entityId,
            diagnostic.duplicateEndpoints.join(vscode.l10n.t(" and ")),
          )
        : vscode.l10n.t(
            "Task '{0}' is over-constrained ({1} constraints, need 2).",
            diagnostic.entityId,
            String(diagnostic.count),
          );
    case "danglingDependency":
      return vscode.l10n.t(
        "Dependency '{0}' references a missing entity.",
        diagnostic.dependencyId,
      );
    case "groupDependency":
      return vscode.l10n.t(
        "Dependency '{0}' involves a group (groups cannot carry dependencies).",
        diagnostic.dependencyId,
      );
    case "unanchoredComponent":
      return vscode.l10n.t(
        "Component containing '{0}' has no absolute date anchor.",
        contextEntityId,
      );
    case "invalidWorkingCalendar":
      return vscode.l10n.t("The project working calendar is invalid.");
  }
}

/**
 * Summarizes why a document cannot be saved, grouping the blocking diagnostics
 * by kind so one message covers them all.
 *
 * @param diagnostics The blocking diagnostics to summarize.
 * @returns A localized summary, or an empty string when nothing blocks.
 */
export function summarizeBlockingDiagnostics(diagnostics: readonly ScheduleDiagnostic[]): string {
  const groups: readonly {
    kind: ScheduleDiagnostic["kind"];
    format: (subjects: string) => string;
  }[] = [
    {
      kind: "underConstrained",
      format: (subjects) => vscode.l10n.t("under-constrained items: {0}", subjects),
    },
    {
      kind: "overConstrained",
      format: (subjects) => vscode.l10n.t("over-constrained items: {0}", subjects),
    },
    {
      kind: "danglingDependency",
      format: (subjects) => vscode.l10n.t("dangling dependencies: {0}", subjects),
    },
    {
      kind: "groupDependency",
      format: (subjects) => vscode.l10n.t("group dependencies: {0}", subjects),
    },
    {
      kind: "unanchoredComponent",
      format: (subjects) => vscode.l10n.t("unanchored components: {0}", subjects),
    },
    {
      kind: "invalidWorkingCalendar",
      format: () => vscode.l10n.t("invalid working calendar"),
    },
  ];

  return groups
    .map((group) => ({
      group,
      present: diagnostics.some((diagnostic) => diagnostic.kind === group.kind),
      subjects: subjectsOf(diagnostics, group.kind),
    }))
    .filter((entry) => entry.present)
    .map((entry) => entry.group.format(entry.subjects.join(", ")))
    .join("; ");
}

/** Lists the ids a diagnostic kind should name in a summary. */
function subjectsOf(
  diagnostics: readonly ScheduleDiagnostic[],
  kind: ScheduleDiagnostic["kind"],
): readonly string[] {
  return diagnostics
    .filter((diagnostic) => diagnostic.kind === kind)
    .flatMap((diagnostic) =>
      diagnostic.kind === "danglingDependency" || diagnostic.kind === "groupDependency"
        ? [diagnostic.dependencyId]
        : scheduleDiagnosticEntityIds(diagnostic),
    );
}
