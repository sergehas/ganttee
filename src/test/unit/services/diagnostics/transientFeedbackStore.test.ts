import { EMPTY_LABEL_SNAPSHOT, GantteeFinding } from "@common/models";
import { TransientFeedbackStore } from "@services/diagnostics/transientFeedbackStore";
import * as assert from "assert";

const URI = "file:///plan.ganttee";
const LABELS = EMPTY_LABEL_SNAPSHOT;

/** Builds a finding of the given origin. */
function finding(origin: GantteeFinding["origin"]): GantteeFinding {
  return { category: "invalidInput", severity: "error", origin, subjects: [] };
}

const DRAFT = [finding("draft")];
const REJECTED = [finding("rejectedEdit")];
const OPERATION = [finding("operation")];

/** Creates a store with one open document and session and records change events. */
function setup(): { store: TransientFeedbackStore; events: string[] } {
  const store = new TransientFeedbackStore();
  const events: string[] = [];
  store.onDidChange((uri) => events.push(uri));
  store.openDocument(URI, 1);
  store.openSession(URI, "s1");
  return { store, events };
}

/** Returns the origins of the current entries. */
function origins(store: TransientFeedbackStore): string[] {
  return store.entries(URI).flatMap((entry) => entry.findings.map((item) => item.origin));
}

suite("TransientFeedbackStore", () => {
  test("publishes and clears draft feedback by generation", () => {
    const { store, events } = setup();
    assert.ok(store.reportDraft(URI, "s1", "entityDraft", 1, 1, DRAFT, LABELS));
    assert.deepStrictEqual(origins(store), ["draft"]);
    assert.strictEqual(store.reportDraft(URI, "s1", "entityDraft", 1, 1, [], LABELS), false);
    assert.strictEqual(store.reportDraft(URI, "s1", "entityDraft", 0, 1, [], LABELS), false);
    assert.deepStrictEqual(origins(store), ["draft"]);
    assert.ok(store.reportDraft(URI, "s1", "entityDraft", 2, 1, [], LABELS));
    assert.deepStrictEqual(origins(store), []);
    assert.strictEqual(events.length, 2);
  });

  test("keeps draft contexts and sessions independent", () => {
    const { store } = setup();
    store.openSession(URI, "s2");
    store.reportDraft(URI, "s1", "entityDraft", 1, 1, DRAFT, LABELS);
    store.reportDraft(URI, "s1", "settingsDraft", 1, 1, DRAFT, LABELS);
    store.reportDraft(URI, "s2", "entityDraft", 1, 1, DRAFT, LABELS);
    assert.strictEqual(store.entries(URI).length, 3);
    store.disposeSession(URI, "s1");
    assert.strictEqual(store.entries(URI).length, 1);
  });

  test("rejects feedback for unknown, disposed, or stale sessions", () => {
    const { store } = setup();
    assert.strictEqual(
      store.reportDraft("file:///other", "s1", "entityDraft", 1, 1, DRAFT, LABELS),
      false,
    );
    assert.strictEqual(store.reportDraft(URI, "nope", "entityDraft", 1, 1, DRAFT, LABELS), false);
    assert.strictEqual(store.reportDraft(URI, "s1", "entityDraft", 1, 0, DRAFT, LABELS), false);
    store.disposeSession(URI, "s1");
    store.openSession(URI, "s1");
    assert.strictEqual(store.reportDraft(URI, "s1", "entityDraft", 5, 1, DRAFT, LABELS), false);
    assert.strictEqual(
      store.reportRejectedEdit(URI, "s1", "entityDraft", 1, REJECTED, LABELS),
      false,
    );
  });

  test("replaces rejected-edit feedback with a newer draft generation", () => {
    const { store } = setup();
    assert.ok(store.reportRejectedEdit(URI, "s1", "entityDraft", 1, REJECTED, LABELS));
    assert.deepStrictEqual(origins(store), ["rejectedEdit"]);
    store.reportDraft(URI, "s1", "entityDraft", 1, 1, [], LABELS);
    assert.deepStrictEqual(origins(store), []);
    store.reportRejectedEdit(URI, "s1", "settingsDraft", 1, REJECTED, LABELS);
    assert.ok(store.reportRejectedEdit(URI, "s1", "settingsDraft", 1, [], LABELS));
    assert.deepStrictEqual(origins(store), []);
    assert.strictEqual(
      store.reportRejectedEdit(URI, "s1", "settingsDraft", 0, REJECTED, LABELS),
      false,
    );
  });

  test("clears session feedback from older revisions on document change", () => {
    const { store, events } = setup();
    store.reportDraft(URI, "s1", "entityDraft", 1, 1, DRAFT, LABELS);
    store.reportRejectedEdit(URI, "s1", "settingsDraft", 1, REJECTED, LABELS);
    events.length = 0;
    store.noteDocumentChange(URI, 2);
    assert.deepStrictEqual(origins(store), []);
    assert.deepStrictEqual(events, [URI]);
    store.noteDocumentChange(URI, 3);
    assert.deepStrictEqual(events, [URI]);
    store.noteDocumentChange("file:///unknown", 1);
    assert.ok(store.reportDraft(URI, "s1", "entityDraft", 2, 3, DRAFT, LABELS));
  });

  test("tracks operation attempts, dismissal, and expiry", () => {
    const { store } = setup();
    assert.strictEqual(store.nextAttempt(URI, "export"), 1);
    assert.ok(store.reportOperation(URI, "export", 1, OPERATION, LABELS));
    assert.strictEqual(store.entries(URI)[0].operationKey, "export");
    assert.strictEqual(store.nextAttempt(URI, "export"), 2);
    assert.strictEqual(store.reportOperation(URI, "export", 1, OPERATION, LABELS), false);
    assert.ok(store.dismissOperation(URI, "export"));
    assert.strictEqual(store.dismissOperation(URI, "export"), false);
    assert.strictEqual(store.dismissOperation(URI, "missing"), false);
    assert.strictEqual(store.reportOperation(URI, "export", 1, OPERATION, LABELS), false);
    assert.ok(store.reportOperation(URI, "export", 2, OPERATION, LABELS));
    store.noteDocumentChange(URI, 2, { cleanup: true });
    assert.deepStrictEqual(origins(store), ["operation"]);
    store.noteDocumentChange(URI, 3);
    assert.deepStrictEqual(origins(store), []);
    assert.ok(store.reportOperation(URI, "export", 3, [], LABELS));
    assert.strictEqual(
      store.reportOperation("file:///none", "export", 1, OPERATION, LABELS),
      false,
    );
    assert.strictEqual(store.nextAttempt("file:///none", "export"), 1);
  });

  test("keeps operation findings when a session ends and drops all on close", () => {
    const { store, events } = setup();
    store.reportOperation(URI, "cleanup", 1, OPERATION, LABELS);
    store.reportDraft(URI, "s1", "entityDraft", 1, 1, DRAFT, LABELS);
    assert.deepStrictEqual(origins(store), ["draft", "operation"]);
    store.disposeSession(URI, "s1");
    assert.deepStrictEqual(origins(store), ["operation"]);
    events.length = 0;
    store.disposeSession(URI, "s1");
    assert.deepStrictEqual(events, []);
    store.clearUri(URI);
    assert.deepStrictEqual(store.entries(URI), []);
    store.clearUri(URI);
    assert.deepStrictEqual(events, [URI]);
  });

  test("stops notifying after unsubscribing", () => {
    const store = new TransientFeedbackStore();
    const events: string[] = [];
    const unsubscribe = store.onDidChange((uri) => events.push(uri));
    store.openDocument(URI, 1);
    store.reportOperation(URI, "op", 1, OPERATION, LABELS);
    unsubscribe();
    store.reportOperation(URI, "op", 2, [], LABELS);
    assert.deepStrictEqual(events, [URI]);
  });
});
