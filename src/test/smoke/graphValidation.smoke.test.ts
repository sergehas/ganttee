import * as assert from "assert";
import * as vscode from "vscode";
import {
  activateExtension,
  createTemporaryGantteeDocument,
  deleteTemporaryGantteeDocument,
  openGantteeDocument,
  waitForDocumentText,
} from "./smokeHelpers";

/** Creates a version-two Ganttee document for smoke-test input. */
function documentText(document: object): string {
  return JSON.stringify(document, undefined, 2);
}

/** Fast end-to-end checks of graph-validation behavior in the custom editor. */
suite("graph validation smoke", () => {
  const temporaryDocuments: vscode.Uri[] = [];

  suiteSetup(async () => {
    await activateExtension();
  });

  teardown(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await Promise.all(
      temporaryDocuments.splice(0).map(deleteTemporaryGantteeDocument),
    );
  });

  /** Creates an isolated writable document that the controller may sanitize. */
  async function createDocument(content: string): Promise<vscode.Uri> {
    const uri = await createTemporaryGantteeDocument(content);
    temporaryDocuments.push(uri);
    return uri;
  }

  test("opens an anchored under-constrained task without rewriting it", async () => {
    const content = documentText({
      version: 2,
      tasks: [{ id: "under", name: "Under", start: "2026-01-01" }],
      groups: [],
      milestones: [],
      dependencies: [],
    });
    const uri = await createDocument(content);

    await assert.doesNotReject(openGantteeDocument(uri));

    const document = await vscode.workspace.openTextDocument(uri);
    assert.strictEqual(document.getText(), content);
  });

  test("opens a duplicate-only endpoint constraint without rewriting it", async () => {
    const content = documentText({
      version: 2,
      tasks: [
        { id: "source", name: "Source", start: "2026-01-01" },
        {
          id: "target",
          name: "Target",
          start: "2026-01-02",
          end: "2026-01-03",
        },
      ],
      groups: [],
      milestones: [],
      dependencies: [
        {
          id: "duplicate-start",
          sourceId: "source",
          targetId: "target",
          type: "startAfter",
        },
      ],
    });
    const uri = await createDocument(content);

    await assert.doesNotReject(openGantteeDocument(uri));

    const document = await vscode.workspace.openTextDocument(uri);
    assert.strictEqual(document.getText(), content);
  });

  test("removes dangling source and target dependencies on open", async () => {
    const uri = await createDocument(
      documentText({
        version: 2,
        tasks: [
          { id: "task", name: "Task", start: "2026-01-01", end: "2026-01-02" },
        ],
        groups: [],
        milestones: [],
        dependencies: [
          {
            id: "missing-source",
            sourceId: "missing",
            targetId: "task",
            type: "startAfter",
          },
          {
            id: "missing-target",
            sourceId: "task",
            targetId: "missing",
            type: "startAfter",
          },
        ],
      }),
    );

    await openGantteeDocument(uri);

    const document = await waitForDocumentText(
      uri,
      (text) =>
        !text.includes("missing-source") && !text.includes("missing-target"),
    );
    const parsed = JSON.parse(document.getText()) as {
      tasks: { id: string }[];
      dependencies: unknown[];
    };
    assert.deepStrictEqual(
      parsed.tasks.map((task) => task.id),
      ["task"],
    );
    assert.deepStrictEqual(parsed.dependencies, []);
  });

  test("removes group endpoint dependencies but preserves the group", async () => {
    const uri = await createDocument(
      documentText({
        version: 2,
        tasks: [
          { id: "task", name: "Task", start: "2026-01-01", end: "2026-01-02" },
        ],
        groups: [{ id: "group", name: "Group" }],
        milestones: [],
        dependencies: [
          {
            id: "group-source",
            sourceId: "group",
            targetId: "task",
            type: "startAfter",
          },
          {
            id: "group-target",
            sourceId: "task",
            targetId: "group",
            type: "endWith",
          },
        ],
      }),
    );

    await openGantteeDocument(uri);

    const document = await waitForDocumentText(
      uri,
      (text) =>
        !text.includes("group-source") && !text.includes("group-target"),
    );
    const parsed = JSON.parse(document.getText()) as {
      groups: { id: string }[];
      dependencies: unknown[];
    };
    assert.deepStrictEqual(
      parsed.groups.map((group) => group.id),
      ["group"],
    );
    assert.deepStrictEqual(parsed.dependencies, []);
  });

  test("removes every unanchored component member and its dependencies", async () => {
    const uri = await createDocument(
      documentText({
        version: 2,
        tasks: [
          {
            id: "anchored",
            name: "Anchored",
            start: "2026-01-01",
            end: "2026-01-02",
          },
          { id: "floating-task", name: "Floating task" },
        ],
        groups: [{ id: "standalone-group", name: "Standalone group" }],
        milestones: [{ id: "floating-milestone", name: "Floating milestone" }],
        dependencies: [
          {
            id: "floating-edge",
            sourceId: "floating-task",
            targetId: "floating-milestone",
            type: "startAfter",
          },
        ],
      }),
    );

    await openGantteeDocument(uri);

    const document = await waitForDocumentText(
      uri,
      (text) =>
        !text.includes("floating-task") && !text.includes("floating-milestone"),
    );
    const parsed = JSON.parse(document.getText()) as {
      tasks: { id: string }[];
      groups: { id: string }[];
      milestones: unknown[];
      dependencies: unknown[];
    };
    assert.deepStrictEqual(
      parsed.tasks.map((task) => task.id),
      ["anchored"],
    );
    assert.deepStrictEqual(
      parsed.groups.map((group) => group.id),
      ["standalone-group"],
    );
    assert.deepStrictEqual(parsed.milestones, []);
    assert.deepStrictEqual(parsed.dependencies, []);
  });

  test("preserves a cyclic document because structural errors are not sanitized", async () => {
    const content = documentText({
      version: 2,
      tasks: [
        { id: "first", name: "First", start: "2026-01-01", end: "2026-01-02" },
        {
          id: "second",
          name: "Second",
          start: "2026-01-03",
          end: "2026-01-04",
        },
      ],
      groups: [],
      milestones: [],
      dependencies: [
        {
          id: "forward",
          sourceId: "first",
          targetId: "second",
          type: "startAfter",
        },
        {
          id: "back",
          sourceId: "second",
          targetId: "first",
          type: "startAfter",
        },
      ],
    });
    const uri = await createDocument(content);

    await assert.doesNotReject(openGantteeDocument(uri));

    const document = await vscode.workspace.openTextDocument(uri);
    assert.strictEqual(document.getText(), content);
  });
});
