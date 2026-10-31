import { EMPTY_LABEL_SNAPSHOT, GantteeFinding, LabelSnapshot } from "@common/models";
import { ReportFeedbackMessage } from "@common/protocol";
import { FeedbackReporter } from "@webview/feedbackReporter";
import * as assert from "assert";

const draftError: GantteeFinding = {
  category: "invalidDuration",
  severity: "error",
  origin: "draft",
  subjects: [{ kind: "task", id: "t" }],
};

const exportError: GantteeFinding = {
  category: "exportFailed",
  severity: "error",
  origin: "operation",
  subjects: [],
};

const labels: LabelSnapshot = {
  items: [{ kind: "task", id: "t", name: "Task", index: 0 }],
  dependencies: [],
};

/** Creates a reporter that records posted messages. */
function recordingReporter(): { reporter: FeedbackReporter; sent: ReportFeedbackMessage[] } {
  const sent: ReportFeedbackMessage[] = [];
  return { reporter: new FeedbackReporter((message) => sent.push(message)), sent };
}

suite("FeedbackReporter", () => {
  test("does not send an initial clear for a context that never had findings", () => {
    const { reporter, sent } = recordingReporter();
    assert.strictEqual(reporter.reportDraft("entityDraft", 1, [], EMPTY_LABEL_SNAPSHOT), false);
    assert.strictEqual(reporter.reportOperation("export", 1, [], EMPTY_LABEL_SNAPSHOT), false);
    assert.deepStrictEqual(sent, []);
  });

  test("sends draft findings with increasing generations and skips duplicates", () => {
    const { reporter, sent } = recordingReporter();
    assert.ok(reporter.reportDraft("entityDraft", 1, [draftError], labels));
    assert.strictEqual(reporter.reportDraft("entityDraft", 1, [draftError], labels), false);
    assert.ok(reporter.reportDraft("entityDraft", 2, [draftError], labels));
    assert.ok(reporter.reportDraft("entityDraft", 2, [], EMPTY_LABEL_SNAPSHOT));
    assert.strictEqual(reporter.reportDraft("entityDraft", 3, [], EMPTY_LABEL_SNAPSHOT), false);
    assert.deepStrictEqual(
      sent.map((message) => [message.context, message.generation, message.baseRevision]),
      [
        ["entityDraft", 1, 1],
        ["entityDraft", 2, 2],
        ["entityDraft", 3, 2],
      ],
    );
    assert.deepStrictEqual(sent[2].findings, []);
    assert.strictEqual(sent[0].operationKey, undefined);
  });

  test("keeps independent generations per draft context", () => {
    const { reporter, sent } = recordingReporter();
    reporter.reportDraft("entityDraft", 1, [draftError], labels);
    reporter.reportDraft("settingsDraft", 1, [draftError], labels);
    assert.deepStrictEqual(
      sent.map((message) => [message.context, message.generation]),
      [
        ["entityDraft", 1],
        ["settingsDraft", 1],
      ],
    );
  });

  test("reports operation attempts with a stable key and increasing attempt", () => {
    const { reporter, sent } = recordingReporter();
    assert.ok(reporter.reportOperation("export", 4, [exportError], EMPTY_LABEL_SNAPSHOT));
    assert.ok(reporter.reportOperation("export", 4, [], EMPTY_LABEL_SNAPSHOT));
    assert.ok(reporter.reportOperation("export", 4, [exportError], EMPTY_LABEL_SNAPSHOT));
    assert.deepStrictEqual(
      sent.map((message) => ({
        context: message.context,
        operationKey: message.operationKey,
        attempt: message.attempt,
        generation: message.generation,
        count: message.findings.length,
      })),
      [
        { context: "operation", operationKey: "export", attempt: 1, generation: 1, count: 1 },
        { context: "operation", operationKey: "export", attempt: 2, generation: 2, count: 0 },
        { context: "operation", operationKey: "export", attempt: 3, generation: 3, count: 1 },
      ],
    );
  });

  test("skips a repeated identical operation failure", () => {
    const { reporter, sent } = recordingReporter();
    reporter.reportOperation("export", 1, [exportError], EMPTY_LABEL_SNAPSHOT);
    assert.strictEqual(
      reporter.reportOperation("export", 1, [exportError], EMPTY_LABEL_SNAPSHOT),
      false,
    );
    assert.strictEqual(sent.length, 1);
  });
});
