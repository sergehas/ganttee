import * as assert from "assert";
import * as vscode from "vscode";
import { activateExtension, openGantteeEditor } from "./smokeHelpers";

/** Fast end-to-end checks that `ganttee.chartEditor` opens real fixture files and that the expected commands are registered after activation. */
suite("editor smoke", () => {
  suiteSetup(async () => {
    await activateExtension();
  });

  teardown(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  test("ganttee.chartEditor opens a v2 fixture without throwing", async () => {
    await assert.doesNotReject(openGantteeEditor("v2-simple.ganttee"));
  });

  /** Migration must run transparently; the editor provider must not throw on a v1 file. */
  test("ganttee.chartEditor opens a v1 fixture (migration runs transparently)", async () => {
    await assert.doesNotReject(openGantteeEditor("v1-minimal.ganttee"));
  });

  test("ganttee.chartEditor opens a v2 fixture with dependencies", async () => {
    await assert.doesNotReject(openGantteeEditor("v2-with-deps.ganttee"));
  });

  test("ganttee.newTask command is registered", async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(
      all.includes("ganttee.newTask"),
      "ganttee.newTask not registered",
    );
  });

  test("ganttee.editTask command is registered", async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(
      all.includes("ganttee.editTask"),
      "ganttee.editTask not registered",
    );
  });

  test("ganttee.deleteTask command is registered", async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(
      all.includes("ganttee.deleteTask"),
      "ganttee.deleteTask not registered",
    );
  });
});
