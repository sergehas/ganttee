import * as assert from "assert";
import * as vscode from "vscode";
import { activateExtension, openGantteeEditor } from "./smokeHelpers";

/** Fast end-to-end checks that the sidebar tree view and its commands are wired up after extension activation. */
suite("sidebar smoke", () => {
  suiteSetup(async () => {
    await activateExtension();
  });

  teardown(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  /** VS Code auto-registers `<viewId>.focus` for every contributed view. */
  test("ganttee.explorer view is registered", async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(
      all.includes("ganttee.explorer.focus"),
      "ganttee.explorer view not registered",
    );
  });

  test("ganttee.refreshExplorer command is registered", async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(
      all.includes("ganttee.refreshExplorer"),
      "refreshExplorer not registered",
    );
  });

  test("refreshExplorer command executes without error after opening a fixture", async () => {
    await openGantteeEditor("v2-simple.ganttee");

    await assert.doesNotReject(
      Promise.resolve(
        vscode.commands.executeCommand("ganttee.refreshExplorer"),
      ),
    );
  });

  /** Guards against accidental deregistration of the reveal command the tree items bind to. */
  test("revealEntity command is registered", async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(
      all.includes("ganttee.revealEntity"),
      "ganttee.revealEntity not registered",
    );
  });
});
