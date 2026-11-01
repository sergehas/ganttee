import type { GanttEditorController } from "@views/editor/ganttEditorController";
import * as vscode from "vscode";

/**
 * Tracks the currently active Gantt editor so the sidebar tree and commands can
 * operate on it. There is one active controller at a time (the focused editor).
 */
export class GanttStore {
  private _active: GanttEditorController | undefined;
  /** Every open chart controller, so commands can target a document that is not focused. */
  private readonly _controllers = new Set<GanttEditorController>();
  private readonly _onDidChangeActive = new vscode.EventEmitter<void>();

  /** Fires when the active controller or its model changes. */
  readonly onDidChangeActive = this._onDidChangeActive.event;

  get active(): GanttEditorController | undefined {
    return this._active;
  }

  /**
   * Returns an open chart controller of a document, preferring the active one.
   *
   * @param uri The document URI.
   */
  controllerFor(uri: vscode.Uri): GanttEditorController | undefined {
    const key = uri.toString();
    if (this._active?.uri.toString() === key) {
      return this._active;
    }
    return [...this._controllers].find((controller) => controller.uri.toString() === key);
  }

  setActive(controller: GanttEditorController): void {
    this._controllers.add(controller);
    this._active = controller;
    this._onDidChangeActive.fire();
  }

  clear(controller: GanttEditorController): void {
    this._controllers.delete(controller);
    if (this._active === controller) {
      this._active = undefined;
      this._onDidChangeActive.fire();
    }
  }

  /** Signals that the active model changed without changing which editor is active. */
  notifyModelChanged(): void {
    this._onDidChangeActive.fire();
  }

  dispose(): void {
    this._onDidChangeActive.dispose();
  }
}
