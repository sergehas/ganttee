import * as vscode from "vscode";
import type { GanttEditorController } from "./views/editor/ganttEditorController";

/**
 * Tracks the currently active Gantt editor so the sidebar tree and commands can
 * operate on it. There is one active controller at a time (the focused editor).
 */
export class GanttStore {
  private _active: GanttEditorController | undefined;
  private readonly _onDidChangeActive = new vscode.EventEmitter<void>();

  /** Fires when the active controller or its model changes. */
  readonly onDidChangeActive = this._onDidChangeActive.event;

  get active(): GanttEditorController | undefined {
    return this._active;
  }

  setActive(controller: GanttEditorController): void {
    this._active = controller;
    this._onDidChangeActive.fire();
  }

  clear(controller: GanttEditorController): void {
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
