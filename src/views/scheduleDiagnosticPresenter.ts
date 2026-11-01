/**
 * Localized, label-safe wording for schedule diagnostics on the extension host.
 *
 * Diagnostics are mapped to structured findings and rendered with the shared
 * finding presenter, so every item is named by its authored label, a localized
 * unnamed descriptor, or a localized missing descriptor; never by its id.
 */

import { ProjectContent } from "@common/documents";
import { labelSnapshotOf, ScheduleDiagnostic } from "@common/models";
import { describeFinding, Translate } from "@common/presentation/diagnostics";
import { scheduleDiagnosticFindings } from "@services/diagnostics/documentDiagnosticsService";
import * as vscode from "vscode";

/** Project content that supplies labels for diagnostic subjects. */
export type DiagnosticLabelSource = Pick<
  ProjectContent,
  "tasks" | "milestones" | "groups" | "dependencies"
> &
  Partial<Pick<ProjectContent, "settings">>;

/** Translates with the host localization bundle. */
const hostTranslate: Translate = (message, ...args) => vscode.l10n.t(message, ...args);

/**
 * Describes each diagnostic as one localized sentence.
 *
 * @param diagnostics The diagnostics to describe.
 * @param source The validated project the diagnostics were computed from.
 * @param translate Translator; defaults to the host bundle.
 * @returns One sentence per diagnostic, in the same order.
 */
export function describeDiagnostics(
  diagnostics: readonly ScheduleDiagnostic[],
  source: DiagnosticLabelSource,
  translate: Translate = hostTranslate,
): string[] {
  const labels = labelSnapshotOf(source);
  return scheduleDiagnosticFindings(source, diagnostics).map((finding) =>
    describeFinding(finding, labels, translate),
  );
}
