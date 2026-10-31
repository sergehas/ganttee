import * as assert from "assert";
import * as vscode from "vscode";
import { activateExtension } from "./smokeHelpers";

/** Polls the Problems diagnostics of a resource until the predicate holds or the timeout elapses. */
async function waitForDiagnostics(
  uri: vscode.Uri,
  predicate: (diagnostics: readonly vscode.Diagnostic[]) => boolean,
  timeoutMs = 5000,
): Promise<readonly vscode.Diagnostic[]> {
  const deadline = Date.now() + timeoutMs;
  let diagnostics = vscode.languages.getDiagnostics(uri);
  while (!predicate(diagnostics) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    diagnostics = vscode.languages.getDiagnostics(uri);
  }
  return diagnostics;
}

/** End-to-end checks that Ganttee findings reach the native Problems view. */
suite("diagnostics smoke", () => {
  suiteSetup(async () => {
    await activateExtension();
  });

  teardown(async () => {
    // Revert first so the dirty untitled document closes without a save prompt.
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  test("ganttee.dismissOperationProblem command is registered", async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(
      all.includes("ganttee.dismissOperationProblem"),
      "ganttee.dismissOperationProblem not registered",
    );
  });

  test("malformed JSON publishes a Ganttee error that clears after repair", async () => {
    const document = await vscode.workspace.openTextDocument({
      language: "ganttee",
      content: '{ "version": 2, "tasks": [',
    });
    await vscode.window.showTextDocument(document);

    const invalid = await waitForDiagnostics(document.uri, (diagnostics) =>
      diagnostics.some((diagnostic) => diagnostic.source === "Ganttee"),
    );
    const gantteeDiagnostics = invalid.filter((diagnostic) => diagnostic.source === "Ganttee");
    assert.ok(gantteeDiagnostics.length > 0, "no Ganttee diagnostic was published");
    assert.ok(
      gantteeDiagnostics.some(
        (diagnostic) =>
          diagnostic.severity === vscode.DiagnosticSeverity.Error &&
          diagnostic.code === "invalidJson",
      ),
    );

    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)),
      "{}",
    );
    await vscode.workspace.applyEdit(edit);

    const repaired = await waitForDiagnostics(
      document.uri,
      (diagnostics) => !diagnostics.some((diagnostic) => diagnostic.code === "invalidJson"),
    );
    assert.ok(
      !repaired.some((diagnostic) => diagnostic.code === "invalidJson"),
      "the malformed JSON finding was not cleared after repair",
    );
  });
});
