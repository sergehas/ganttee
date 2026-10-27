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
    assert.ok(all.includes("ganttee.newTask"), "ganttee.newTask not registered");
  });

  test("ganttee.editProjectItem command is registered", async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(all.includes("ganttee.editProjectItem"), "ganttee.editProjectItem not registered");
  });

  test("ganttee.deleteProjectItem command is registered", async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(
      all.includes("ganttee.deleteProjectItem"),
      "ganttee.deleteProjectItem not registered",
    );
  });

  test("ganttee.openSettings command is registered", async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(all.includes("ganttee.openSettings"), "ganttee.openSettings not registered");
  });

  test("ganttee.openSettings opens the Settings editor for the active document", async () => {
    const uri = await openGantteeEditor("v2-simple.ganttee");
    await vscode.commands.executeCommand("ganttee.openSettings");
    await new Promise((resolve) => setTimeout(resolve, 500));

    const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    assert.ok(input instanceof vscode.TabInputCustom);
    assert.strictEqual(input.viewType, "ganttee.settingsEditor");
    assert.strictEqual(input.uri.toString(), uri.toString());
  });

  test("ganttee.openSettings ignores a chart when an unrelated editor is active", async () => {
    const uri = await openGantteeEditor("v2-simple.ganttee");
    const textDocument = await vscode.workspace.openTextDocument({
      language: "plaintext",
      content: "unrelated",
    });
    await vscode.window.showTextDocument(textDocument);

    await vscode.commands.executeCommand("ganttee.openSettings");
    const settingsTabs = vscode.window.tabGroups.all
      .flatMap((group) => group.tabs)
      .filter(
        (tab) =>
          tab.input instanceof vscode.TabInputCustom &&
          tab.input.viewType === "ganttee.settingsEditor" &&
          tab.input.uri.toString() === uri.toString(),
      );

    assert.strictEqual(settingsTabs.length, 0);
  });

  test("ganttee.settingsEditor opens the same project document", async () => {
    const uri = await openGantteeEditor("v2-simple.ganttee");

    await vscode.commands.executeCommand("vscode.openWith", uri, "ganttee.settingsEditor");
  });
});
