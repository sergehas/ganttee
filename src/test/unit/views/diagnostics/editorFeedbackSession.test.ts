import { EMPTY_LABEL_SNAPSHOT, GantteeFinding } from "@common/models";
import { TransientFeedbackStore } from "@services/diagnostics/transientFeedbackStore";
import {
  CLEANUP_OPERATION_KEY,
  EditorFeedbackSession,
} from "@views/diagnostics/editorFeedbackSession";
import { GantteeDiagnosticsService } from "@views/diagnostics/gantteeDiagnosticsService";
import * as assert from "assert";
import * as vscode from "vscode";
import { openGantteeText, projectText, replaceText } from "./diagnosticsTestUtils";

/** A valid project with one task. */
const VALID_TEXT = projectText({
  tasks: [{ id: "t", name: "Task", start: "2026-01-05", duration: 2 }],
  sequence: ["t"],
});

/** A draft-local finding about the task. */
const DRAFT_FINDING: GantteeFinding = {
  category: "invalidDuration",
  severity: "error",
  origin: "draft",
  subjects: [{ kind: "task", id: "t" }],
};

/** A rejected-edit finding about the task. */
const REJECTED_FINDING: GantteeFinding = {
  category: "editRejected",
  severity: "error",
  origin: "rejectedEdit",
  subjects: [{ kind: "task", id: "t" }],
};

suite("EditorFeedbackSession", () => {
  let store: TransientFeedbackStore;
  let collection: vscode.DiagnosticCollection;
  let service: GantteeDiagnosticsService;
  let document: vscode.TextDocument;
  let session: EditorFeedbackSession;

  setup(async () => {
    store = new TransientFeedbackStore();
    collection = vscode.languages.createDiagnosticCollection("ganttee-session-test");
    service = new GantteeDiagnosticsService(store, { collection });
    document = await openGantteeText(VALID_TEXT);
    session = new EditorFeedbackSession(service, document, "session-1");
  });

  teardown(() => {
    session.dispose();
    service.dispose();
  });

  /** Returns the codes of the diagnostics published for the document. */
  function codes(): string[] {
    return (collection.get(document.uri) ?? []).map((diagnostic) => String(diagnostic.code));
  }

  /** Builds a browser feedback message. */
  function message(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      type: "reportFeedback",
      context: "entityDraft",
      generation: 1,
      baseRevision: document.version,
      findings: [DRAFT_FINDING],
      labels: EMPTY_LABEL_SNAPSHOT,
      ...overrides,
    };
  }

  test("tracks the document when the session opens", () => {
    assert.deepStrictEqual(codes(), []);
    assert.strictEqual(session.sessionId, "session-1");
  });

  test("publishes valid draft feedback and ignores malformed messages", () => {
    assert.strictEqual(session.receive({ type: "reportFeedback" }), false);
    assert.strictEqual(session.receive(message()), true);
    assert.deepStrictEqual(codes(), ["invalidDuration"]);
    assert.strictEqual(session.receive(message({ findings: [] })), false);
    assert.strictEqual(session.receive(message({ generation: 2, findings: [] })), true);
    assert.deepStrictEqual(codes(), []);
  });

  test("accepts browser operations only for the current revision", () => {
    const operation = {
      context: "operation",
      operationKey: "export",
      attempt: 1,
      findings: [
        { category: "exportFailed", severity: "error", origin: "operation", subjects: [] },
      ],
    };
    assert.strictEqual(
      session.receive(message({ ...operation, baseRevision: document.version + 1 })),
      false,
    );
    assert.strictEqual(session.receive(message(operation)), true);
    assert.deepStrictEqual(codes(), ["exportFailed"]);
    assert.ok(service.dismiss(document.uri.toString(), "session-1:export"));
  });

  test("publishes and clears rejected edits", () => {
    session.reportRejection(
      "entityDraft",
      document.version,
      [REJECTED_FINDING],
      EMPTY_LABEL_SNAPSHOT,
    );
    assert.deepStrictEqual(codes(), ["editRejected"]);
    session.reportRejection("entityDraft", document.version, [], EMPTY_LABEL_SNAPSHOT);
    assert.deepStrictEqual(codes(), []);
  });

  test("publishes host operations as newer attempts", () => {
    const finding: GantteeFinding = {
      category: "sortUnavailable",
      severity: "warning",
      origin: "operation",
      subjects: [],
    };
    session.reportOperation("sort", [finding], EMPTY_LABEL_SNAPSHOT);
    session.reportOperation("sort", [finding], EMPTY_LABEL_SNAPSHOT);
    assert.deepStrictEqual(codes(), ["sortUnavailable"]);
    session.reportOperation("sort", [], EMPTY_LABEL_SNAPSHOT);
    assert.deepStrictEqual(codes(), []);
  });

  test("keeps the cleanup warning across its own replacement", async () => {
    const replacement = VALID_TEXT.replace("Task", "Clean");
    const finding = session.reportCleanup(
      { removedEntityIds: ["t"], removedDependencyIds: [] },
      EMPTY_LABEL_SNAPSHOT,
      replacement,
    );
    assert.strictEqual(finding.category, "cleanupRemoved");
    await replaceText(document, replacement);
    service.track(document);
    assert.deepStrictEqual(codes(), ["cleanupRemoved"]);
  });

  test("replaces the cleanup warning when the cleanup edit fails", async () => {
    session.reportCleanup(
      { removedEntityIds: [], removedDependencyIds: ["d"] },
      EMPTY_LABEL_SNAPSHOT,
      "unused",
    );
    assert.strictEqual(session.reportCleanupFailed(EMPTY_LABEL_SNAPSHOT).category, "cleanupFailed");
    assert.deepStrictEqual(codes(), ["cleanupFailed"]);
    assert.ok(service.dismiss(document.uri.toString(), CLEANUP_OPERATION_KEY));
  });

  test("describes findings without ids", () => {
    const [sentence] = session.describe([REJECTED_FINDING], {
      items: [{ kind: "task", id: "t", name: "Visible label", index: 0 }],
      dependencies: [],
    });
    assert.ok(sentence.includes("Visible label"));
  });

  test("clears session feedback and ignores input after disposal", () => {
    session.receive(message());
    session.reportRejection(
      "settingsDraft",
      document.version,
      [REJECTED_FINDING],
      EMPTY_LABEL_SNAPSHOT,
    );
    assert.strictEqual(codes().length, 2);
    session.dispose();
    session.dispose();
    assert.deepStrictEqual(codes(), []);
    assert.strictEqual(session.receive(message({ generation: 5 })), false);
    session.reportRejection(
      "settingsDraft",
      document.version,
      [REJECTED_FINDING],
      EMPTY_LABEL_SNAPSHOT,
    );
    assert.deepStrictEqual(codes(), []);
  });
});
