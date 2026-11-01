import { createEmptyDocument, ProjectDocument } from "@common/documents";
import * as assert from "assert";
import * as vscode from "vscode";

/**
 * Serializes a project built from overrides of the empty document.
 *
 * @param parts Top-level overrides.
 */
export function projectText(parts: Partial<ProjectDocument> = {}): string {
  return JSON.stringify({ ...createEmptyDocument(), ...parts }, undefined, 2);
}

/**
 * Opens an untitled `.ganttee` document with the given text.
 *
 * @param content The document text.
 */
export function openGantteeText(content: string): Thenable<vscode.TextDocument> {
  return vscode.workspace.openTextDocument({ language: "ganttee", content });
}

/**
 * Replaces the whole text of a document and asserts the edit was applied.
 *
 * @param document The document to edit.
 * @param text The replacement text.
 */
export async function replaceText(document: vscode.TextDocument, text: string): Promise<void> {
  const edit = new vscode.WorkspaceEdit();
  edit.replace(
    document.uri,
    new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)),
    text,
  );
  assert.ok(await vscode.workspace.applyEdit(edit));
}

/**
 * Returns the displayed value of a diagnostic code, linked or not.
 *
 * @param diagnostic The diagnostic.
 */
export function codeOf(diagnostic: vscode.Diagnostic): string {
  const code = diagnostic.code;
  return String(typeof code === "object" ? code.value : code);
}
