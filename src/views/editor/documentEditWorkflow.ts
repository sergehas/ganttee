import { ProjectDocument } from "@common/documents";
import {
  GanttParseError,
  parseDocument,
  serializeDocument,
} from "@services/document/documentService";
import {
  blockingDiagnostics,
  evaluateScheduleDiagnostics,
} from "@services/schedule/scheduleGraphValidationService";
import { DocumentEditQueue } from "@views/editor/documentEditQueue";
import * as vscode from "vscode";

/** Authoritative outcome of a document proposal. */
export type DocumentEditOutcome =
  | { readonly status: "applied" | "stale" | "writeRejected" | "disposed" }
  | { readonly status: "validationRejected"; readonly text: string };

/** Owns document writes without retaining a parallel project model. */
export class DocumentEditWorkflow implements vscode.Disposable {
  /** Whether the owning editor has closed. */
  private _isDisposed = false;

  /**
   * @param document Authoritative source of text and revision.
   * @param queue Shared per-URI edit serialization.
   * @param applyEdit External VS Code write effect.
   */
  constructor(
    private readonly document: vscode.TextDocument,
    private readonly queue: DocumentEditQueue,
    private readonly applyEdit: typeof vscode.workspace.applyEdit = vscode.workspace.applyEdit,
  ) {}

  /** Applies a serialized proposal without changing derived editor state. */
  apply(next: ProjectDocument, baseRevision: number): Promise<DocumentEditOutcome> {
    return this.queue.run(this.document.uri.toString(), async () => {
      if (baseRevision !== this.document.version) {
        return { status: "stale" };
      }
      if (this._isDisposed) {
        return { status: "disposed" };
      }
      const text = serializeDocument(next);
      try {
        if (blockingDiagnostics(evaluateScheduleDiagnostics(parseDocument(text))).length > 0) {
          return { status: "validationRejected", text };
        }
      } catch (error) {
        if (!(error instanceof GanttParseError)) {
          throw error;
        }
        return { status: "validationRejected", text };
      }
      return {
        status: (await this.replaceText(text)) ? "applied" : "writeRejected",
      };
    });
  }

  /** Writes replacement text; automatic cleanup uses this path without semantic validation. */
  async replaceText(text: string): Promise<boolean> {
    if (this._isDisposed) {
      return false;
    }
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      this.document.positionAt(0),
      this.document.positionAt(this.document.getText().length),
    );
    edit.replace(this.document.uri, fullRange, text);
    return this.applyEdit(edit);
  }

  /** Stops future writes when the owning editor closes. */
  dispose(): void {
    this._isDisposed = true;
  }
}
