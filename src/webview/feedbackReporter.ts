import { GantteeFinding, LabelSnapshot } from "@common/models";
import { FeedbackContext, ReportFeedbackMessage } from "@common/protocol";

/** Browser feedback contexts owned by an edit form. */
export type DraftFeedbackContext = Exclude<FeedbackContext, "operation">;

/**
 * Sends browser-only feedback to the host so it can be mirrored in Problems.
 * Draft contexts carry a strictly increasing generation; operations carry a stable key
 * and a strictly increasing attempt. Repeated identical reports are not re-sent.
 */
export class FeedbackReporter {
  /** Last generation sent per draft context. */
  private readonly _generations = new Map<DraftFeedbackContext, number>();
  /** Last attempt sent per operation key. */
  private readonly _attempts = new Map<string, number>();
  /** Serialized last report per context or operation, used to skip duplicates. */
  private readonly _lastReports = new Map<string, string>();

  /**
   * @param post Delivers one message to the host.
   */
  constructor(private readonly post: (message: ReportFeedbackMessage) => void) {}

  /**
   * Replaces the findings of one draft context; empty findings clear it.
   *
   * @param context The form context.
   * @param baseRevision The document revision the draft was validated against.
   * @param findings The current draft findings.
   * @param labels Labels of the draft and its document.
   * @returns Whether a message was sent.
   */
  reportDraft(
    context: DraftFeedbackContext,
    baseRevision: number,
    findings: readonly GantteeFinding[],
    labels: LabelSnapshot,
  ): boolean {
    const key = `draft:${context}`;
    if (!this.changed(key, baseRevision, findings, labels)) {
      return false;
    }
    const generation = (this._generations.get(context) ?? 0) + 1;
    this._generations.set(context, generation);
    this.post({ type: "reportFeedback", context, generation, baseRevision, findings, labels });
    return true;
  }

  /**
   * Reports the outcome of a new operation attempt; empty findings clear its previous failure.
   *
   * @param operationKey Stable logical operation key.
   * @param baseRevision The document revision the operation ran against.
   * @param findings The attempt's findings.
   * @param labels Labels of referenced items.
   * @returns Whether a message was sent.
   */
  reportOperation(
    operationKey: string,
    baseRevision: number,
    findings: readonly GantteeFinding[],
    labels: LabelSnapshot,
  ): boolean {
    if (!this.changed(`operation:${operationKey}`, baseRevision, findings, labels)) {
      return false;
    }
    const attempt = (this._attempts.get(operationKey) ?? 0) + 1;
    this._attempts.set(operationKey, attempt);
    this.post({
      type: "reportFeedback",
      context: "operation",
      generation: attempt,
      baseRevision,
      findings,
      labels,
      operationKey,
      attempt,
    });
    return true;
  }

  /**
   * Records the report and returns whether it must be sent. A clear is sent only when the
   * previous report for the key had findings.
   */
  private changed(
    key: string,
    baseRevision: number,
    findings: readonly GantteeFinding[],
    labels: LabelSnapshot,
  ): boolean {
    const serialized =
      findings.length === 0 ? "" : JSON.stringify([baseRevision, findings, labels]);
    if ((this._lastReports.get(key) ?? "") === serialized) {
      return false;
    }
    this._lastReports.set(key, serialized);
    return true;
  }
}
