import { EditableEntityRef } from "@common/protocol";
import { DocumentEvaluation } from "@services/diagnostics/documentDiagnosticsService";
import { encodeProblemItemArgument } from "@services/diagnostics/problemNavigation";
import {
  OpenProblemItemDependencies,
  openProblemItem,
  ProblemItemEditor,
} from "@views/diagnostics/openProblemItem";
import * as assert from "assert";
import * as vscode from "vscode";
import { openGantteeText } from "./diagnosticsTestUtils";

/** Records the edit requests it receives. */
class FakeEditor implements ProblemItemEditor {
  /** Received requests. */
  readonly requests: [EditableEntityRef, boolean][] = [];

  /** Records one request. */
  editEntity(entity: EditableEntityRef, keepOpen: boolean): void {
    this.requests.push([entity, keepOpen]);
  }
}

const TASK: EditableEntityRef = { kind: "task", id: "t" };

suite("openProblemItem", () => {
  let document: vscode.TextDocument;
  let editor: FakeEditor;
  let openEditor: FakeEditor | undefined;
  let opened: vscode.Uri[];
  let messages: string[];
  let dependencies: OpenProblemItemDependencies;

  setup(async () => {
    document = await openGantteeText("{}");
    editor = new FakeEditor();
    openEditor = editor;
    opened = [];
    messages = [];
    const evaluation = {
      findings: [],
      labels: { items: [{ kind: "task", id: "t", index: 0 }], dependencies: [] },
    } as unknown as DocumentEvaluation;
    dependencies = {
      editorFor: (uri) => (uri.toString() === document.uri.toString() ? openEditor : undefined),
      diagnostics: { evaluation: () => evaluation },
      openChart: (uri) => {
        opened.push(uri);
        openEditor = editor;
        return Promise.resolve();
      },
      showInformation: (message) => {
        messages.push(message);
        return Promise.resolve();
      },
    };
  });

  /** Encodes a target in the given document. */
  function argument(entity: EditableEntityRef, uri = document.uri.toString()): string {
    return encodeProblemItemArgument({ uri, entity });
  }

  test("opens the form in the document's open chart without toggling it", async () => {
    assert.strictEqual(await openProblemItem(argument(TASK), dependencies), true);
    assert.deepStrictEqual(editor.requests, [[TASK, true]]);
    assert.deepStrictEqual(opened, []);
  });

  test("opens the chart first when the document has none", async () => {
    openEditor = undefined;
    assert.strictEqual(await openProblemItem(argument(TASK), dependencies), true);
    assert.deepStrictEqual(
      opened.map((uri) => uri.toString()),
      [document.uri.toString()],
    );
    assert.deepStrictEqual(editor.requests, [[TASK, true]]);
  });

  test("gives up when no chart becomes available", async () => {
    openEditor = undefined;
    const failing = { ...dependencies, openChart: () => Promise.resolve() };
    assert.strictEqual(await openProblemItem(argument(TASK), failing), false);
    assert.deepStrictEqual(editor.requests, []);
  });

  test("reports an item that no longer exists", async () => {
    assert.strictEqual(
      await openProblemItem(argument({ kind: "group", id: "t" }), dependencies),
      false,
    );
    assert.strictEqual(messages.length, 1);
    assert.deepStrictEqual(editor.requests, []);
  });

  test("ignores malformed arguments and documents that are not open", async () => {
    assert.strictEqual(await openProblemItem("not-hex", dependencies), false);
    assert.strictEqual(
      await openProblemItem(argument(TASK, "untitled:never-opened"), dependencies),
      false,
    );
    assert.deepStrictEqual(editor.requests, []);
    assert.deepStrictEqual(messages, []);
  });
});
