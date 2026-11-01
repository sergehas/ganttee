import { createEmptyDocument } from "@common/documents";
import { serializeDocument } from "@services/document/documentService";
import { DocumentEditQueue } from "@views/editor/documentEditQueue";
import { DocumentEditWorkflow } from "@views/editor/documentEditWorkflow";
import { openGantteeText } from "../diagnostics/diagnosticsTestUtils";
import * as assert from "assert";
import * as vscode from "vscode";

suite("DocumentEditWorkflow", () => {
  let document: vscode.TextDocument;
  let workflow: DocumentEditWorkflow;

  setup(async () => {
    document = await openGantteeText(serializeDocument(createEmptyDocument()));
    workflow = new DocumentEditWorkflow(document, new DocumentEditQueue());
  });

  teardown(() => {
    workflow.dispose();
  });

  test("applies a valid proposal to the authoritative TextDocument", async () => {
    const next = {
      ...createEmptyDocument(),
      tasks: [{ id: "design", name: "Design", start: "2026-01-05", duration: 2 }],
      sequence: ["design"],
    };
    const outcome = await workflow.apply(next, document.version);
    assert.deepStrictEqual(
      { outcome, text: document.getText() },
      { outcome: { status: "applied" }, text: serializeDocument(next) },
    );
  });

  test("rejects a queued proposal after an earlier write advances the revision", async () => {
    const next = {
      ...createEmptyDocument(),
      tasks: [{ id: "design", name: "Design", start: "2026-01-05", duration: 2 }],
      sequence: ["design"],
    };
    const revision = document.version;
    const first = workflow.apply(next, revision);
    const second = workflow.apply(createEmptyDocument(), revision);
    assert.deepStrictEqual(
      { outcomes: await Promise.all([first, second]), text: document.getText() },
      { outcomes: [{ status: "applied" }, { status: "stale" }], text: serializeDocument(next) },
    );
  });

  test("returns rejected proposal text without overwriting the document", async () => {
    const before = document.getText();
    const next = {
      ...createEmptyDocument(),
      tasks: [{ id: "design", name: "Design", start: "2026-01-05", end: "2026-01-04" }],
      sequence: ["design"],
    };
    assert.deepStrictEqual(
      { outcome: await workflow.apply(next, document.version), text: document.getText() },
      { outcome: { status: "validationRejected", text: serializeDocument(next) }, text: before },
    );
  });

  test("rejects blocking semantic diagnostics without changing the source", async () => {
    const before = document.getText();
    const next = {
      ...createEmptyDocument(),
      tasks: [{ id: "design", name: "Design", duration: 2 }],
      sequence: ["design"],
    };
    assert.deepStrictEqual(
      { outcome: await workflow.apply(next, document.version), text: document.getText() },
      { outcome: { status: "validationRejected", text: serializeDocument(next) }, text: before },
    );
  });

  test("reports a rejected VS Code write without changing the source", async () => {
    const before = document.getText();
    workflow.dispose();
    workflow = new DocumentEditWorkflow(document, new DocumentEditQueue(), async () => false);
    assert.deepStrictEqual(
      {
        outcome: await workflow.apply(createEmptyDocument(), document.version),
        text: document.getText(),
      },
      { outcome: { status: "writeRejected" }, text: before },
    );
  });

  test("does not write queued proposals after disposal", async () => {
    const before = document.getText();
    const pending = workflow.apply(createEmptyDocument(), document.version);
    workflow.dispose();
    assert.deepStrictEqual(
      { outcome: await pending, text: document.getText() },
      { outcome: { status: "disposed" }, text: before },
    );
  });

  test("applies cleanup replacement text without semantic proposal validation", async () => {
    const text = serializeDocument({
      ...createEmptyDocument(),
      tasks: [{ id: "design", name: "Design", duration: 2 }],
      sequence: ["design"],
    });
    assert.deepStrictEqual(
      { applied: await workflow.replaceText(text), text: document.getText() },
      { applied: true, text },
    );
  });

  test("rejects cleanup writes after disposal", async () => {
    const before = document.getText();
    workflow.dispose();
    assert.deepStrictEqual(
      { applied: await workflow.replaceText("unused"), text: document.getText() },
      { applied: false, text: before },
    );
  });

  test("propagates unexpected write errors", async () => {
    workflow.dispose();
    workflow = new DocumentEditWorkflow(document, new DocumentEditQueue(), async () => {
      throw new Error("write failed");
    });
    await assert.rejects(workflow.apply(createEmptyDocument(), document.version), /write failed/);
  });
});
