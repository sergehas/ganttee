import { GantteeFinding, LabelSnapshot } from "@common/models";
import { describeFinding } from "@common/presentation/diagnostics";
import { DraftFeedbackContext } from "@services/diagnostics/transientFeedbackStore";
import { proposalRejection } from "@services/diagnostics/documentDiagnosticsService";
import { parseReportFeedback } from "@services/diagnostics/feedbackMessageValidation";
import {
  cleanupFailedFinding,
  cleanupRemovedFinding,
  CleanupRemoval,
  editRejectedFinding,
} from "@services/diagnostics/operationFindings";
import { GantteeDiagnosticsService } from "@views/diagnostics/gantteeDiagnosticsService";
import * as vscode from "vscode";

/** Operation key of automatic scheduling cleanup; one per URI. */
export const CLEANUP_OPERATION_KEY = "cleanup";

/** Prefix of host-originated operation keys. */
const HOST_OPERATION_PREFIX = "host:";

/** External notification effect; replaceable without changing VS Code globals. */
type FeedbackNotification = (severity: "error" | "warning", message: string) => void;

/** Form session context of a rejected document proposal. */
export interface RejectedEditTarget {
  /** Form that owns the proposal. */
  readonly context: DraftFeedbackContext;
  /** Document revision targeted by the proposal. */
  readonly baseRevision: number;
}

/** Shows an actionable finding through the native notification surface. */
function showNotification(severity: "error" | "warning", message: string): void {
  if (severity === "error") {
    void vscode.window.showErrorMessage(message);
  } else {
    void vscode.window.showWarningMessage(message);
  }
}

/**
 * Routes panel feedback to native Problems and localized notifications, returning form explanations.
 *
 * The session owns draft and rejected-edit feedback; it ends when the panel
 * closes. Operation findings it reports are URI-owned and outlive the session.
 * The URI always comes from the panel's document, never from the browser.
 */
export class EditorFeedbackSession implements vscode.Disposable {
  /** URI string of the panel's document. */
  private readonly _uri: string;
  /** Whether the session ended. */
  private _isDisposed = false;

  /**
   * @param diagnostics The shared Problems publisher.
   * @param document The panel's document.
   * @param sessionId Unique id of the panel session.
   * @param notify Native notification effect.
   */
  constructor(
    private readonly diagnostics: GantteeDiagnosticsService,
    private readonly document: vscode.TextDocument,
    readonly sessionId: string,
    private readonly notify: FeedbackNotification = showNotification,
  ) {
    this._uri = document.uri.toString();
    diagnostics.track(document);
    diagnostics.feedback.openSession(this._uri, sessionId);
  }

  /**
   * Accepts a browser `reportFeedback` message. Malformed payloads, ended
   * sessions, stale generations, and incompatible revisions are ignored.
   *
   * @param value The untrusted message.
   * @returns Whether the feedback was accepted.
   */
  receive(value: unknown): boolean {
    const message = parseReportFeedback(value);
    if (message === undefined || this._isDisposed) {
      return false;
    }
    const feedback = this.diagnostics.feedback;
    if (message.context === "operation") {
      return (
        message.baseRevision === this.document.version &&
        feedback.reportOperation(
          this._uri,
          `${this.sessionId}:${message.operationKey ?? ""}`,
          message.attempt ?? 0,
          message.findings,
          message.labels,
        )
      );
    }
    return feedback.reportDraft(
      this._uri,
      this.sessionId,
      message.context,
      message.generation,
      message.baseRevision,
      message.findings,
      message.labels,
    );
  }

  /**
   * Publishes (or clears, when empty) the rejected-edit findings of a form.
   *
   * @param context The form context.
   * @param baseRevision The revision the proposal targeted.
   * @param findings The rejection findings.
   * @param labels Labels of the rejected proposal.
   */
  reportRejection(
    context: DraftFeedbackContext,
    baseRevision: number,
    findings: readonly GantteeFinding[],
    labels: LabelSnapshot,
  ): void {
    if (!this._isDisposed) {
      this.diagnostics.feedback.reportRejectedEdit(
        this._uri,
        this.sessionId,
        context,
        baseRevision,
        findings,
        labels,
      );
    }
  }

  /**
   * Publishes (or clears, when empty) the finding of a host operation as a newer attempt.
   *
   * @param name Stable operation name.
   * @param findings The operation findings.
   * @param labels Labels of the operation's input.
   */
  reportOperation(name: string, findings: readonly GantteeFinding[], labels: LabelSnapshot): void {
    this.publishOperation(`${HOST_OPERATION_PREFIX}${name}`, findings, labels);
  }

  /** Publishes an operation failure and returns the explanations shown to the user. */
  operationFailure(
    name: string,
    findings: readonly GantteeFinding[],
    labels: LabelSnapshot,
    context: "plain" | "ganttee" | "dependency" = "plain",
  ): string[] {
    this.reportOperation(name, findings, labels);
    return this.showFindings(findings, labels, context);
  }

  /** Shows the first finding as a notification and returns all label-safe explanations. */
  showFindings(
    findings: readonly GantteeFinding[],
    labels: LabelSnapshot,
    context: "plain" | "ganttee" | "dependency" = "plain",
  ): string[] {
    const explanations = this.describe(findings, labels);
    const first = findings[0];
    if (!this._isDisposed && first !== undefined) {
      const description = explanations[0];
      const message =
        context === "ganttee"
          ? vscode.l10n.t("Ganttee: {0}", description)
          : context === "dependency"
            ? vscode.l10n.t("Cannot add dependency: {0}", description)
            : description;
      this.notify(first.severity, message);
    }
    return explanations;
  }

  /** Publishes a rejected proposal and returns the explanations for its correlated result. */
  rejectProposal(text: string, target?: RejectedEditTarget): string[] {
    const rejection = proposalRejection(text);
    const findings =
      rejection.findings.length > 0 ? rejection.findings : [editRejectedFinding("project")];
    const explanations = this.describe(findings, rejection.labels);
    if (!this._isDisposed) {
      this.notify("error", vscode.l10n.t("Cannot apply update: {0}", explanations.join(" ")));
    }
    if (target !== undefined) {
      this.reportRejection(target.context, target.baseRevision, findings, rejection.labels);
    } else {
      this.reportOperation(
        "apply",
        findings.map((finding) => ({ ...finding, origin: "operation" })),
        rejection.labels,
      );
    }
    return explanations;
  }

  /** Summarizes current document errors while directing the user to the complete Problems list. */
  documentError(): string {
    const evaluation = this.diagnostics.evaluation(this.document);
    const errors = evaluation.findings.filter((finding) => finding.severity === "error");
    const first = errors[0];
    if (first === undefined) {
      return vscode.l10n.t("Ganttee: the document cannot be loaded.");
    }
    const description = this.describe([first], evaluation.labels)[0];
    const more = errors.length - 1;
    if (more === 0) {
      return vscode.l10n.t("Ganttee: {0}", description);
    }
    return more === 1
      ? vscode.l10n.t("Ganttee: {0} 1 more problem is listed in the Problems view.", description)
      : vscode.l10n.t(
          "Ganttee: {0} {1} more problems are listed in the Problems view.",
          description,
          more,
        );
  }

  /**
   * Publishes the cleanup warning before the cleanup edit is applied, and marks
   * that edit as exempt from operation expiration.
   *
   * @param removal The items cleanup removes.
   * @param labels Labels of the source revision before cleanup.
   * @param replacement The replacement text about to be applied.
   * @returns The finding, for notifications.
   */
  reportCleanup(
    removal: CleanupRemoval,
    labels: LabelSnapshot,
    replacement: string,
  ): GantteeFinding {
    const finding = cleanupRemovedFinding(removal);
    this.publishOperation(CLEANUP_OPERATION_KEY, [finding], labels);
    this.diagnostics.expectCleanupChange(this.document.uri, replacement);
    return finding;
  }

  /**
   * Replaces the cleanup warning with a failure after the cleanup edit was rejected.
   *
   * @param labels Labels of the unchanged source.
   * @returns The finding, for notifications.
   */
  reportCleanupFailed(labels: LabelSnapshot): GantteeFinding {
    const finding = cleanupFailedFinding();
    this.diagnostics.cancelCleanupChange(this.document.uri);
    this.publishOperation(CLEANUP_OPERATION_KEY, [finding], labels);
    return finding;
  }

  /** Coordinates cleanup notifications and Problems lifetime around the external document write. */
  async applyCleanup(
    removal: CleanupRemoval,
    labels: LabelSnapshot,
    replacement: string,
    write: (text: string) => Promise<boolean>,
  ): Promise<void> {
    const finding = this.reportCleanup(removal, labels, replacement);
    this.showFindings([finding], labels, "ganttee");
    if (this._isDisposed) {
      this.reportCleanupFailed(labels);
      return;
    }
    if (!(await write(replacement))) {
      this.showFindings([this.reportCleanupFailed(labels)], labels, "ganttee");
    }
  }

  /**
   * Renders findings as localized, label-safe sentences.
   *
   * @param findings The findings.
   * @param labels Their label context.
   */
  describe(findings: readonly GantteeFinding[], labels: LabelSnapshot): string[] {
    return findings.map((finding) =>
      describeFinding(finding, labels, (message, ...args) => vscode.l10n.t(message, ...args)),
    );
  }

  /** Ends the session and clears its draft and rejected-edit feedback. */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this.diagnostics.feedback.disposeSession(this._uri, this.sessionId);
  }

  /** Publishes an operation result as the newest attempt of its key. */
  private publishOperation(
    key: string,
    findings: readonly GantteeFinding[],
    labels: LabelSnapshot,
  ): void {
    const feedback = this.diagnostics.feedback;
    feedback.reportOperation(
      this._uri,
      key,
      feedback.nextAttempt(this._uri, key),
      findings,
      labels,
    );
  }
}
