import { GanttStore } from "@src/ganttStore";
import type { GanttEditorController } from "@views/editor/ganttEditorController";
import * as assert from "assert";
import * as vscode from "vscode";

/** Builds a stand-in controller for a document path. */
function controllerOf(path: string): GanttEditorController {
  return { uri: vscode.Uri.file(path) } as GanttEditorController;
}

suite("GanttStore", () => {
  let store: GanttStore;
  let changes: number;

  setup(() => {
    store = new GanttStore();
    changes = 0;
    store.onDidChangeActive(() => changes++);
  });

  teardown(() => store.dispose());

  test("finds open controllers by document, preferring the active one", () => {
    const first = controllerOf("/a.ganttee");
    const second = controllerOf("/b.ganttee");
    const duplicate = controllerOf("/a.ganttee");
    store.setActive(first);
    store.setActive(second);
    assert.strictEqual(store.active, second);
    assert.strictEqual(store.controllerFor(vscode.Uri.file("/a.ganttee")), first);
    store.setActive(duplicate);
    assert.strictEqual(store.controllerFor(vscode.Uri.file("/a.ganttee")), duplicate);
    assert.strictEqual(store.controllerFor(vscode.Uri.file("/c.ganttee")), undefined);
    assert.strictEqual(changes, 3);
  });

  test("forgets cleared controllers and only clears the active one when it matches", () => {
    const first = controllerOf("/a.ganttee");
    const second = controllerOf("/b.ganttee");
    store.setActive(first);
    store.setActive(second);
    store.clear(first);
    assert.strictEqual(store.active, second);
    assert.strictEqual(store.controllerFor(first.uri), undefined);
    store.clear(second);
    assert.strictEqual(store.active, undefined);
    store.notifyModelChanged();
    assert.strictEqual(changes, 4);
  });
});
