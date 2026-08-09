import * as path from "path";
import * as vscode from "vscode";
import { FIXTURES_DIR } from "../testFixtures";

/** Opens a fixture file with the Ganttee custom editor and waits for it to become active. */
export async function openGantteeEditor(
  fixtureName: string,
): Promise<vscode.Uri> {
  const uri = vscode.Uri.file(path.join(FIXTURES_DIR, fixtureName));
  await vscode.commands.executeCommand(
    "vscode.openWith",
    uri,
    "ganttee.chartEditor",
  );
  // Give the editor and its webview time to initialize.
  await new Promise((resolve) => setTimeout(resolve, 500));
  return uri;
}

/** Memoizes the first activation so repeated suite setups don't reopen the fixture. */
let activation: Promise<void> | undefined;

/**
 * Forces extension activation by opening a fixture, which fires the implicit
 * `onCustomEditor:ganttee.chartEditor` event. The manifest declares no explicit
 * activation events, so commands are absent from the registry until this runs.
 */
export function activateExtension(): Promise<void> {
  activation ??= (async () => {
    await openGantteeEditor("v2-simple.ganttee");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  })();
  return activation;
}
