import { createEmptyDocument } from "@common/documents";
import { EMPTY_LABEL_SNAPSHOT, GantteeFinding, LabelSnapshot } from "@common/models";
import { TransientFeedbackStore } from "@services/diagnostics/transientFeedbackStore";
import {
  DISMISS_OPERATION_PROBLEM_COMMAND,
  GANTTEE_DIAGNOSTIC_SOURCE,
  GantteeDiagnosticsService,
} from "@views/diagnostics/gantteeDiagnosticsService";
import * as assert from "assert";
import * as vscode from "vscode";
import { openGantteeText, projectText, replaceText } from "./diagnosticsTestUtils";

/** Builds an operation finding about the given subjects. */
function operationFinding(
  subjects: GantteeFinding["subjects"],
  extra: Partial<GantteeFinding> = {},
): GantteeFinding {
  return { category: "unknownItem", severity: "warning", origin: "operation", subjects, ...extra };
}

/** A valid project with one task, one milestone, one group, and one dependency. */
const VALID_TEXT = projectText({
  tasks: [{ id: "t", name: "Task", start: "2026-01-05", duration: 2 }],
  milestones: [{ id: "m", name: "Milestone" }],
  groups: [{ id: "g", name: "Group" }],
  dependencies: [{ id: "d", sourceId: "t", targetId: "m", type: "startAfter" }],
  sequence: ["t", "m"],
  settings: {
    ...createEmptyDocument().settings,
    statuses: [{ id: "s", name: "Status", color: "#112233ff" }],
  },
});

/** Categories used by the transient findings of these tests. */
const TRANSIENT_CODES = ["unknownItem", "editRejected"];

/** Code action context for the given diagnostics. */
function actionContext(diagnostics: readonly vscode.Diagnostic[]): vscode.CodeActionContext {
  return { diagnostics, triggerKind: vscode.CodeActionTriggerKind.Invoke, only: undefined };
}

suite("GantteeDiagnosticsService", () => {
  let store: TransientFeedbackStore;
  let collection: vscode.DiagnosticCollection;
  let service: GantteeDiagnosticsService;

  setup(() => {
    store = new TransientFeedbackStore();
    collection = vscode.languages.createDiagnosticCollection("ganttee-test");
    service = new GantteeDiagnosticsService(store, { collection });
  });

  teardown(() => {
    service.dispose();
  });

  /** Returns the diagnostics published for a document. */
  function published(document: vscode.TextDocument): readonly vscode.Diagnostic[] {
    return collection.get(document.uri) ?? [];
  }

  /** Returns the published diagnostics of transient test findings. */
  function transient(document: vscode.TextDocument): readonly vscode.Diagnostic[] {
    return published(document).filter((diagnostic) =>
      TRANSIENT_CODES.includes(String(diagnostic.code)),
    );
  }

  /** Publishes operation findings for a tracked document. */
  function report(
    document: vscode.TextDocument,
    findings: readonly GantteeFinding[],
    labels: LabelSnapshot = EMPTY_LABEL_SNAPSHOT,
    key = "op",
  ): void {
    const uri = document.uri.toString();
    assert.ok(store.reportOperation(uri, key, store.nextAttempt(uri, key), findings, labels));
  }

  test("recognizes Ganttee documents by language or extension", async () => {
    const plain = await vscode.workspace.openTextDocument({ content: "{" });
    service.track(plain);
    assert.deepStrictEqual(published(plain), []);
    assert.ok(
      GantteeDiagnosticsService.isGanttee({
        languageId: "json",
        uri: vscode.Uri.file("/x/plan.ganttee"),
      } as vscode.TextDocument),
    );
  });

  test("publishes document findings with source, code, severity, and range", async () => {
    const text = projectText({
      tasks: [{ id: "id-sentinel-1", name: "Build", start: "bad-date", duration: 1 }],
      sequence: ["id-sentinel-1"],
    });
    const document = await openGantteeText(text);
    service.track(document);
    const [diagnostic] = published(document);
    assert.strictEqual(diagnostic.source, GANTTEE_DIAGNOSTIC_SOURCE);
    assert.strictEqual(diagnostic.code, "invalidField");
    assert.strictEqual(diagnostic.severity, vscode.DiagnosticSeverity.Error);
    assert.ok(!diagnostic.message.includes("id-sentinel-1"));
    const offset = text.indexOf('"bad-date"');
    assert.deepStrictEqual(diagnostic.range.start, document.positionAt(offset));
    assert.deepStrictEqual(diagnostic.range.end, document.positionAt(offset + '"bad-date"'.length));
  });

  test("publishes warnings and related locations of document findings", async () => {
    const warned = await openGantteeText(
      projectText({
        tasks: [{ id: "t", name: "T", start: "2026-01-05", duration: 1, status: "ghost" }],
        sequence: ["t"],
      }),
    );
    service.track(warned);
    assert.ok(
      published(warned).some(
        (diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Warning,
      ),
    );

    const duplicated = await openGantteeText(
      projectText({
        tasks: [
          { id: "t", name: "First", start: "2026-01-05", duration: 1 },
          { id: "t", name: "Second", start: "2026-01-05", duration: 1 },
        ],
        sequence: ["t"],
      }),
    );
    service.track(duplicated);
    const duplicate = published(duplicated).find(
      (diagnostic) => diagnostic.code === "duplicateEntityId",
    );
    assert.ok(duplicate?.relatedInformation?.length);
    assert.strictEqual(
      duplicate.relatedInformation[0].location.uri.toString(),
      duplicated.uri.toString(),
    );
  });

  test("positions transient findings at the current record of their subject", async () => {
    const document = await openGantteeText(VALID_TEXT);
    service.track(document);
    assert.deepStrictEqual(transient(document), []);
    const statusId = "s";
    report(document, [
      operationFinding([{ kind: "task", id: "t" }]),
      operationFinding([{ kind: "item", id: "m" }]),
      operationFinding([{ kind: "dependency", id: "d" }]),
      operationFinding([{ kind: "status", id: statusId }]),
      operationFinding([{ kind: "task", id: "missing" }]),
      operationFinding([{ kind: "dependency", id: "missing" }]),
      operationFinding([{ kind: "project" }]),
      operationFinding([]),
    ]);
    const recordStart = (marker: string): number =>
      VALID_TEXT.lastIndexOf("{", VALID_TEXT.indexOf(marker));
    assert.deepStrictEqual(
      transient(document).map((diagnostic) => document.offsetAt(diagnostic.range.start)),
      [
        recordStart('"id": "t"'),
        recordStart('"id": "m"'),
        recordStart('"id": "d"'),
        recordStart(`"id": "${statusId}"`),
        0,
        0,
        0,
        0,
      ],
    );
    for (const diagnostic of transient(document)) {
      assert.ok(diagnostic.range.isEmpty);
      assert.strictEqual(diagnostic.code, "unknownItem");
    }
  });

  test("keeps related transient locations only when their subject exists", async () => {
    const document = await openGantteeText(VALID_TEXT);
    service.track(document);
    report(document, [
      operationFinding([{ kind: "task", id: "t" }], {
        related: [
          { subject: { kind: "group", id: "g" }, location: {} },
          { subject: { kind: "group", id: "gone" }, location: {} },
        ],
      }),
      operationFinding([{ kind: "task", id: "t" }], {
        related: [{ subject: { kind: "group", id: "gone" }, location: {} }],
      }),
    ]);
    const [kept, dropped] = transient(document);
    assert.strictEqual(kept.relatedInformation?.length, 1);
    assert.strictEqual(dropped.relatedInformation, undefined);
  });

  test("falls back to the document start for unlocated document findings", async () => {
    const document = await openGantteeText(VALID_TEXT);
    service.track(document);
    report(document, [
      {
        category: "editRejected",
        severity: "error",
        origin: "document",
        subjects: [],
        location: { start: 0, end: 0 },
        related: [{ subject: { kind: "task", id: "t" }, location: { start: 0, end: 0 } }],
      },
    ]);
    const [diagnostic] = transient(document);
    assert.ok(diagnostic.range.isEmpty);
    assert.strictEqual(document.offsetAt(diagnostic.range.start), 0);
    assert.strictEqual(diagnostic.relatedInformation, undefined);
  });

  test("anchors transient findings at the start of invalid JSON", async () => {
    const document = await openGantteeText("{ invalid");
    service.track(document);
    report(document, [operationFinding([{ kind: "task", id: "t" }])]);
    const operation = transient(document).find((diagnostic) => diagnostic.code === "unknownItem");
    assert.strictEqual(operation?.range.start.line, 0);
    assert.strictEqual(operation.range.start.character, 0);
  });

  test("expires operation findings on edits except for the cleanup replacement", async () => {
    const document = await openGantteeText(VALID_TEXT);
    service.track(document);
    report(document, [operationFinding([])]);
    const cleaned = VALID_TEXT.replace("Task", "Cleaned");
    service.expectCleanupChange(document.uri, cleaned.replace(/\n/g, "\r\n"));
    await replaceText(document, cleaned);
    service.track(document);
    assert.strictEqual(transient(document).length, 1);

    service.track(document);
    assert.strictEqual(transient(document).length, 1);

    service.expectCleanupChange(document.uri, "something else");
    await replaceText(document, VALID_TEXT);
    service.track(document);
    assert.deepStrictEqual(transient(document), []);

    report(document, [operationFinding([])]);
    service.expectCleanupChange(document.uri, cleaned);
    service.cancelCleanupChange(document.uri);
    await replaceText(document, cleaned);
    service.track(document);
    assert.deepStrictEqual(transient(document), []);
  });

  test("removes every finding when a document closes", async () => {
    const document = await openGantteeText("{");
    service.track(document);
    assert.ok(published(document).length > 0);
    service.close(document);
    assert.deepStrictEqual(published(document), []);
    assert.deepStrictEqual(store.entries(document.uri.toString()), []);
    service.close(document);
  });

  test("ignores closed documents and evaluates untracked ones", async () => {
    const document = await openGantteeText("{");
    const closed = {
      uri: document.uri,
      languageId: "ganttee",
      version: 1,
      isClosed: true,
      getText: () => "{",
    } as unknown as vscode.TextDocument;
    service.track(closed);
    assert.deepStrictEqual(published(document), []);
    service.close(closed);
    assert.strictEqual(service.evaluation(document).findings[0].category, "invalidJson");
  });

  test("dismisses operation findings and validates arguments", async () => {
    const document = await openGantteeText(VALID_TEXT);
    service.track(document);
    report(document, [operationFinding([])]);
    const uri = document.uri.toString();
    assert.strictEqual(service.dismiss(1, "op"), false);
    assert.strictEqual(service.dismiss(uri, undefined), false);
    assert.strictEqual(service.dismiss(uri, "op"), true);
    assert.strictEqual(service.dismiss(uri, "op"), false);
    assert.deepStrictEqual(transient(document), []);
  });

  test("offers a dismiss quick fix for published operation diagnostics only", async () => {
    const document = await openGantteeText("{");
    service.track(document);
    report(document, [operationFinding([])], EMPTY_LABEL_SNAPSHOT, "host:sort");
    const diagnostics = published(document);
    const operation = diagnostics.find((diagnostic) => diagnostic.code === "unknownItem");
    assert.ok(operation);
    const actions = service.provideCodeActions(
      document,
      new vscode.Range(0, 0, 0, 0),
      actionContext(diagnostics),
    );
    assert.strictEqual(actions.length, 1);
    assert.deepStrictEqual(actions[0].diagnostics, [operation]);
    assert.strictEqual(actions[0].kind?.value, vscode.CodeActionKind.QuickFix.value);
    assert.strictEqual(actions[0].command?.command, DISMISS_OPERATION_PROBLEM_COMMAND);
    assert.deepStrictEqual(actions[0].command?.arguments, [document.uri.toString(), "host:sort"]);
    const other = await openGantteeText("{");
    assert.deepStrictEqual(
      service.provideCodeActions(other, new vscode.Range(0, 0, 0, 0), actionContext([operation])),
      [],
    );
  });

  test("uses the injected translator", async () => {
    const ownCollection = vscode.languages.createDiagnosticCollection("ganttee-translate-test");
    const translated = new GantteeDiagnosticsService(new TransientFeedbackStore(), {
      collection: ownCollection,
      translate: () => "translated",
    });
    try {
      const document = await openGantteeText("{");
      translated.track(document);
      assert.ok(
        (ownCollection.get(document.uri) ?? []).every(
          (diagnostic) => diagnostic.message === "translated",
        ),
      );
    } finally {
      translated.dispose();
    }
  });

  test("creates its own collection by default", () => {
    new GantteeDiagnosticsService(new TransientFeedbackStore()).dispose();
  });

  test("registers listeners, the dismiss command, and existing documents", async () => {
    const existing = await openGantteeText("{");
    const commands = new Map<string, (...args: unknown[]) => unknown>();
    const registered = GantteeDiagnosticsService.register({
      collection: vscode.languages.createDiagnosticCollection("ganttee-register-test"),
      registerCommand: (command, callback) => {
        commands.set(command, callback);
        return { dispose: () => commands.delete(command) };
      },
    });
    try {
      const uri = existing.uri.toString();
      const feedback = registered.feedback;
      assert.ok(
        feedback.reportOperation(uri, "op", 1, [operationFinding([])], EMPTY_LABEL_SNAPSHOT),
      );
      assert.strictEqual(commands.get(DISMISS_OPERATION_PROBLEM_COMMAND)?.(uri, "op"), true);

      const opened = await openGantteeText(VALID_TEXT);
      const openedUri = opened.uri.toString();
      assert.ok(
        feedback.reportOperation(openedUri, "op", 1, [operationFinding([])], EMPTY_LABEL_SNAPSHOT),
      );
      await replaceText(opened, VALID_TEXT.replace("Task", "Changed"));
      assert.deepStrictEqual(feedback.entries(openedUri), []);
    } finally {
      registered.dispose();
    }
    assert.strictEqual(commands.size, 0);
  });
});
