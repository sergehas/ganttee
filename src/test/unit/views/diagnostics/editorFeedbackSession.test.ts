import { EMPTY_LABEL_SNAPSHOT, GantteeFinding } from "@common/models";
import { TransientFeedbackStore } from "@services/diagnostics/transientFeedbackStore";
import {
  CLEANUP_OPERATION_KEY,
  EditorFeedbackSession,
} from "@views/diagnostics/editorFeedbackSession";
import { GantteeDiagnosticsService } from "@views/diagnostics/gantteeDiagnosticsService";
import * as assert from "assert";
import * as vscode from "vscode";
import { codeOf, openGantteeText, projectText, replaceText } from "./diagnosticsTestUtils";

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
  let notifications: { severity: "error" | "warning"; message: string }[];

  setup(async () => {
    store = new TransientFeedbackStore();
    collection = vscode.languages.createDiagnosticCollection("ganttee-session-test");
    service = new GantteeDiagnosticsService(store, { collection });
    document = await openGantteeText(VALID_TEXT);
    notifications = [];
    session = new EditorFeedbackSession(service, document, "session-1", (severity, message) => {
      notifications.push({ severity, message });
    });
  });

  teardown(() => {
    session.dispose();
    service.dispose();
  });

  /** Returns the codes of the diagnostics published for the document. */
  function codes(): string[] {
    return (collection.get(document.uri) ?? []).map((diagnostic) => codeOf(diagnostic));
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

  test("reports an operation warning in Problems and its notification", () => {
    const finding: GantteeFinding = {
      category: "sortUnavailable",
      severity: "warning",
      origin: "operation",
      subjects: [],
    };
    const explanations = session.operationFailure("sort", [finding], EMPTY_LABEL_SNAPSHOT);
    assert.deepStrictEqual(
      { explanations, notifications, codes: codes() },
      {
        explanations: ["Sort is unavailable without a schedule."],
        notifications: [
          { severity: "warning", message: "Sort is unavailable without a schedule." },
        ],
        codes: ["sortUnavailable"],
      },
    );
  });

  test("keeps dependency rejection wording separate from the Problems origin prefix", () => {
    const explanations = session.operationFailure(
      "addDependency",
      [
        {
          category: "dependencyCycleRejected",
          severity: "error",
          origin: "operation",
          subjects: [],
        },
      ],
      EMPTY_LABEL_SNAPSHOT,
      "dependency",
    );
    assert.deepStrictEqual(
      { explanations, notifications, codes: codes() },
      {
        explanations: ["the project would create a dependency cycle."],
        notifications: [
          {
            severity: "error",
            message: "Cannot add dependency: the project would create a dependency cycle.",
          },
        ],
        codes: ["dependencyCycleRejected"],
      },
    );
  });

  test("returns rejected-draft explanations and mirrors them in Problems and a notification", () => {
    const explanations = session.rejectProposal(
      projectText({
        tasks: [{ id: "hidden-id", name: "Design", start: "2026-01-05", end: "2026-01-04" }],
        sequence: ["hidden-id"],
      }),
      { context: "entityDraft", baseRevision: document.version },
    );
    assert.deepStrictEqual(
      { explanations, notifications, codes: codes() },
      {
        explanations: ['Task "Design" starts after it ends.'],
        notifications: [
          {
            severity: "error",
            message: 'Cannot apply update: Task "Design" starts after it ends.',
          },
        ],
        codes: ["invalidTaskDateRange"],
      },
    );
  });

  test("summarizes a document error without hiding the remaining Problems entry", async () => {
    await replaceText(
      document,
      projectText({
        tasks: [
          { id: "a", name: "Design", start: "2026-01-05", end: "2026-01-04" },
          { id: "b", name: "Build", start: "2026-01-05", end: "2026-01-04" },
        ],
        sequence: ["a", "b"],
      }),
    );
    assert.strictEqual(
      session.documentError(),
      'Ganttee: Task "Design" starts after it ends. 1 more problem is listed in the Problems view.',
    );
  });

  test("summarizes a single document error", async () => {
    await replaceText(document, "[]");
    assert.strictEqual(
      session.documentError(),
      "Ganttee: The document root must be a JSON object.",
    );
  });

  test("uses an honest fallback when no document error is available", () => {
    assert.strictEqual(session.documentError(), "Ganttee: the document cannot be loaded.");
  });

  test("uses plural wording for multiple remaining document errors", async () => {
    await replaceText(
      document,
      projectText({
        tasks: ["a", "b", "c"].map((id) => ({
          id,
          name: id,
          start: "2026-01-05",
          end: "2026-01-04",
        })),
        sequence: ["a", "b", "c"],
      }),
    );
    assert.strictEqual(
      session.documentError(),
      'Ganttee: Task "a" starts after it ends. 2 more problems are listed in the Problems view.',
    );
  });

  test("reports a generic rejected proposal as an operation with fallback wording", () => {
    const explanations = session.rejectProposal(projectText());
    const diagnostic = collection.get(document.uri)?.[0];
    assert.deepStrictEqual(
      { explanations, notifications, diagnostic: diagnostic?.message },
      {
        explanations: ["The update to the project was rejected."],
        notifications: [
          {
            severity: "error",
            message: "Cannot apply update: The update to the project was rejected.",
          },
        ],
        diagnostic: "Operation: The update to the project was rejected.",
      },
    );
  });

  test("shows cleanup wording with the Ganttee prefix and source labels", () => {
    const finding = session.reportCleanup(
      { removedEntityIds: ["t"], removedDependencyIds: [] },
      { items: [{ kind: "task", id: "t", name: "Design", index: 0 }], dependencies: [] },
      "replacement",
    );
    session.showFindings(
      [finding],
      { items: [{ kind: "task", id: "t", name: "Design", index: 0 }], dependencies: [] },
      "ganttee",
    );
    assert.deepStrictEqual(notifications, [
      {
        severity: "warning",
        message:
          'Ganttee: Automatic cleanup removed items that could not be scheduled: Task "Design".',
      },
    ]);
  });

  test("replaces cleanup feedback and notifies when its document write is rejected", async () => {
    await session.applyCleanup(
      { removedEntityIds: ["t"], removedDependencyIds: [] },
      { items: [{ kind: "task", id: "t", name: "Design", index: 0 }], dependencies: [] },
      "replacement",
      async () => false,
    );
    assert.deepStrictEqual(
      { codes: codes(), notifications },
      {
        codes: ["cleanupFailed"],
        notifications: [
          {
            severity: "warning",
            message:
              'Ganttee: Automatic cleanup removed items that could not be scheduled: Task "Design".',
          },
          {
            severity: "error",
            message: "Ganttee: Automatic scheduling cleanup could not be applied.",
          },
        ],
      },
    );
  });

  test("keeps cleanup feedback across its successful source replacement", async () => {
    const replacement = VALID_TEXT.replace("Task", "Clean");
    await session.applyCleanup(
      { removedEntityIds: ["t"], removedDependencyIds: [] },
      { items: [{ kind: "task", id: "t", name: "Task", index: 0 }], dependencies: [] },
      replacement,
      async (text) => {
        await replaceText(document, text);
        service.track(document);
        return true;
      },
    );
    assert.deepStrictEqual(
      { codes: codes(), text: document.getText(), notifications },
      {
        codes: ["cleanupRemoved"],
        text: replacement,
        notifications: [
          {
            severity: "warning",
            message:
              'Ganttee: Automatic cleanup removed items that could not be scheduled: Task "Task".',
          },
        ],
      },
    );
  });

  test("does not write cleanup after disposal", async () => {
    const before = document.getText();
    session.dispose();
    await session.applyCleanup(
      { removedEntityIds: [], removedDependencyIds: [] },
      EMPTY_LABEL_SNAPSHOT,
      "replacement",
      async (text) => {
        await replaceText(document, text);
        return true;
      },
    );
    assert.deepStrictEqual(
      { codes: codes(), text: document.getText(), notifications },
      { codes: ["cleanupFailed"], text: before, notifications: [] },
    );
  });

  test("retains cleanup failure without notifying after disposal during a write", async () => {
    await session.applyCleanup(
      { removedEntityIds: [], removedDependencyIds: [] },
      EMPTY_LABEL_SNAPSHOT,
      "replacement",
      async () => {
        session.dispose();
        return false;
      },
    );
    assert.deepStrictEqual(
      { codes: codes(), notifications: notifications.map((entry) => entry.severity) },
      { codes: ["cleanupFailed"], notifications: ["warning"] },
    );
  });

  test("does not notify for empty findings or after disposal", () => {
    session.showFindings([], EMPTY_LABEL_SNAPSHOT);
    session.dispose();
    session.showFindings([REJECTED_FINDING], EMPTY_LABEL_SNAPSHOT);
    session.rejectProposal(projectText());
    assert.deepStrictEqual(notifications, []);
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
