import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { FIXTURES_DIR } from "../testFixtures";

/** Opens a fixture file with the Ganttee custom editor and waits for it to become active. */
export async function openGantteeEditor(
  fixtureName: string,
): Promise<vscode.Uri> {
  const uri = vscode.Uri.file(path.join(FIXTURES_DIR, fixtureName));
  await openGantteeDocument(uri);
  return uri;
}

/** Opens a Ganttee document with the custom editor and waits for it to become active. */
export async function openGantteeDocument(uri: vscode.Uri): Promise<void> {
  await vscode.commands.executeCommand(
    "vscode.openWith",
    uri,
    "ganttee.chartEditor",
  );
  // Give the editor and its webview time to initialize.
  await new Promise((resolve) => setTimeout(resolve, 500));
}

/** Creates a writable Ganttee document for a smoke test. */
export async function createTemporaryGantteeDocument(
  content: string,
): Promise<vscode.Uri> {
  const directory = vscode.Uri.file(path.join(os.tmpdir(), "ganttee-smoke"));
  await vscode.workspace.fs.createDirectory(directory);
  const uri = vscode.Uri.file(
    path.join(directory.fsPath, `${Date.now()}-${Math.random()}.ganttee`),
  );
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
  return uri;
}

/** Deletes a writable Ganttee smoke-test document and its parent directory when empty. */
export async function deleteTemporaryGantteeDocument(
  uri: vscode.Uri,
): Promise<void> {
  await vscode.workspace.fs.delete(uri, { useTrash: false });
}

/** Waits for an open document to satisfy an expected text predicate. */
export async function waitForDocumentText(
  uri: vscode.Uri,
  predicate: (text: string) => boolean,
): Promise<vscode.TextDocument> {
  const document = await vscode.workspace.openTextDocument(uri);
  if (predicate(document.getText())) {
    return document;
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      listener.dispose();
      reject(new Error(`Timed out waiting for ${uri.fsPath} to update.`));
    }, 5_000);
    const listener = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() !== uri.toString()) {
        return;
      }
      if (predicate(event.document.getText())) {
        clearTimeout(timeout);
        listener.dispose();
        resolve(event.document);
      }
    });
  });
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
