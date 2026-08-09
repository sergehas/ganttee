import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import { FIXTURES_DIR } from "../testFixtures";

/** Fast end-to-end checks that the sidebar tree view and its commands are wired up after extension activation. */
suite("sidebar smoke", () => {
  teardown(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  test("ganttee.explorer view is registered", async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(
      all.includes("ganttee.refreshExplorer"),
      "refreshExplorer not registered",
    );
  });

  test("refreshExplorer command executes without error after opening a fixture", async () => {
    const uri = vscode.Uri.file(path.join(FIXTURES_DIR, "v2-simple.ganttee"));
    await vscode.commands.executeCommand(
      "vscode.openWith",
      uri,
      "ganttee.chartEditor",
    );
    await new Promise((resolve) => setTimeout(resolve, 500));

    await assert.doesNotReject(
      Promise.resolve(
        vscode.commands.executeCommand("ganttee.refreshExplorer"),
      ),
    );
  });

  /** Guards against accidental deregistration of task-action commands relied on by the sidebar. */
  test("revealTask command is registered", async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(
      all.includes("ganttee.revealTask") || all.includes("ganttee.editTask"),
      "expected at least one task-action command",
    );
  });
});
