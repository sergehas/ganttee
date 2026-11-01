import { EditableEntityRef } from "@common/protocol";
import { decodeProblemItemArgument, hasProblemItem } from "@services/diagnostics/problemNavigation";
import { GantteeDiagnosticsService } from "@views/diagnostics/gantteeDiagnosticsService";
import * as vscode from "vscode";

/** An open chart editor that can show an item's edit form. */
export interface ProblemItemEditor {
  /**
   * Reveals the editor and opens the item's form.
   *
   * @param entity The item.
   * @param keepOpen Keeps an already open form of the item open.
   */
  editEntity(entity: EditableEntityRef, keepOpen: boolean): void;
}

/** Collaborators of {@link openProblemItem}, replaceable in tests. */
export interface OpenProblemItemDependencies {
  /** Returns an open chart editor of a document. */
  readonly editorFor: (uri: vscode.Uri) => ProblemItemEditor | undefined;
  /** Evaluates a document's current revision. */
  readonly diagnostics: Pick<GantteeDiagnosticsService, "evaluation">;
  /** Opens the chart editor of a document. */
  readonly openChart: (uri: vscode.Uri) => Thenable<unknown>;
  /** Shows an information message. */
  readonly showInformation: (message: string) => Thenable<unknown>;
}

/**
 * Opens the edit form of the item a Problems code link points to. Opens the
 * chart editor first when the document has none. Malformed arguments and
 * closed documents are ignored; an item that no longer exists is reported.
 *
 * @param argument The untrusted command argument.
 * @param dependencies The collaborators.
 * @returns Whether a form was requested.
 */
export async function openProblemItem(
  argument: unknown,
  dependencies: OpenProblemItemDependencies,
): Promise<boolean> {
  const target = decodeProblemItemArgument(argument);
  if (target === undefined) {
    return false;
  }
  const document = vscode.workspace.textDocuments.find(
    (candidate) => candidate.uri.toString() === target.uri,
  );
  if (document === undefined) {
    return false;
  }
  if (!hasProblemItem(dependencies.diagnostics.evaluation(document).labels, target.entity)) {
    void dependencies.showInformation(vscode.l10n.t("This item no longer exists in the document."));
    return false;
  }
  let editor = dependencies.editorFor(document.uri);
  if (editor === undefined) {
    await dependencies.openChart(document.uri);
    editor = dependencies.editorFor(document.uri);
  }
  if (editor === undefined) {
    return false;
  }
  editor.editEntity(target.entity, true);
  return true;
}
