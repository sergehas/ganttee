/**
 * Localized wording for schedule diagnostics.
 *
 * This is the only place that turns a {@link ScheduleDiagnostic} into text. The
 * services that produce diagnostics stay free of `vscode`, so the webview can
 * import them; anything user-facing is resolved here on the host.
 */

import * as vscode from "vscode";
import { ScheduleDiagnostic } from "../services/scheduleGraphValidationService";

/**
 * Describes one diagnostic as it applies to a single entity.
 *
 * @param diagnostic The diagnostic to describe.
 * @param entityId The entity the message is shown against.
 * @returns A localized, human-readable sentence.
 */
export function describeDiagnostic(
  diagnostic: ScheduleDiagnostic,
  entityId: string,
): string {
  switch (diagnostic.kind) {
    case "underConstrained":
      return vscode.l10n.t(
        "Task '{0}' is under-constrained ({1} constraints, need 2).",
        entityId,
        String(diagnostic.count),
      );
    case "overConstrained":
      return vscode.l10n.t(
        "Task '{0}' is over-constrained ({1} constraints, need 2).",
        entityId,
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
        entityId,
      );
  }
}

/**
 * Summarizes why a document cannot be saved, grouping the blocking diagnostics
 * by kind so one message covers them all.
 *
 * @param diagnostics The blocking diagnostics to summarize.
 * @returns A localized summary, or an empty string when nothing blocks.
 */
export function summarizeBlockingDiagnostics(
  diagnostics: readonly ScheduleDiagnostic[],
): string {
  const groups: readonly {
    kind: ScheduleDiagnostic["kind"];
    format: (subjects: string) => string;
  }[] = [
    {
      kind: "underConstrained",
      format: (subjects) =>
        vscode.l10n.t("under-constrained items: {0}", subjects),
    },
    {
      kind: "overConstrained",
      format: (subjects) =>
        vscode.l10n.t("over-constrained items: {0}", subjects),
    },
    {
      kind: "danglingDependency",
      format: (subjects) =>
        vscode.l10n.t("dangling dependencies: {0}", subjects),
    },
    {
      kind: "groupDependency",
      format: (subjects) => vscode.l10n.t("group dependencies: {0}", subjects),
    },
    {
      kind: "unanchoredComponent",
      format: (subjects) =>
        vscode.l10n.t("unanchored components: {0}", subjects),
    },
  ];

  return groups
    .map((group) => ({
      group,
      subjects: subjectsOf(diagnostics, group.kind),
    }))
    .filter((entry) => entry.subjects.length > 0)
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
      diagnostic.kind === "danglingDependency" ||
      diagnostic.kind === "groupDependency"
        ? [diagnostic.dependencyId]
        : [...diagnostic.entityIds],
    );
}
