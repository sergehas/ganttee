import { GantteeFinding, LabelSnapshot, SubjectRef } from "@common/models";
import {
  describeFindingWithOrigin,
  describeRelated,
  Translate,
} from "@common/presentation/diagnostics";
import {
  DocumentEvaluation,
  evaluateDocumentText,
} from "@services/diagnostics/documentDiagnosticsService";
import { TransientFeedbackStore } from "@services/diagnostics/transientFeedbackStore";
import {
  encodeProblemItemArgument,
  OPEN_PROBLEM_ITEM_COMMAND,
  problemItemRef,
} from "@services/diagnostics/problemNavigation";
import { JsonSourceNode, nodeAt, scanJson } from "@services/document/jsonSourceMapService";
import * as vscode from "vscode";

/** Native diagnostic source shown in Problems. */
export const GANTTEE_DIAGNOSTIC_SOURCE = "Ganttee";

/** Hidden command clearing one operation finding. Arguments: URI string, operation key. */
export const DISMISS_OPERATION_PROBLEM_COMMAND = "ganttee.dismissOperationProblem";

/** Language identifier of `.ganttee` documents. */
const GANTTEE_LANGUAGE_ID = "ganttee";

/** Authored collection path of each label kind. */
const COLLECTION_PATHS: Readonly<
  Record<"task" | "milestone" | "group" | "status", readonly string[]>
> = {
  task: ["tasks"],
  milestone: ["milestones"],
  group: ["groups"],
  status: ["settings", "statuses"],
};

/** Evaluation of one document revision, with its source map. */
interface Projection {
  /** Evaluated document version. */
  readonly revision: number;
  /** Findings and labels of that revision. */
  readonly evaluation: DocumentEvaluation;
  /** Source map of the evaluated text, when it is valid JSON. */
  readonly root?: JsonSourceNode;
}

/** A published operation diagnostic and the key that dismisses it. */
interface OperationDiagnostic {
  /** The published diagnostic. */
  readonly diagnostic: vscode.Diagnostic;
  /** Its operation key. */
  readonly operationKey: string;
}

/** Optional collaborators, replaceable in tests. */
export interface GantteeDiagnosticsOptions {
  /** Native collection receiving the findings. */
  readonly collection?: vscode.DiagnosticCollection;
  /** Translator for the current display language. */
  readonly translate?: Translate;
  /** Command registrar; replaceable so tests do not clash with the activated extension. */
  readonly registerCommand?: (
    command: string,
    callback: (...args: unknown[]) => unknown,
  ) => vscode.Disposable;
}

/**
 * Publishes every document-associated Ganttee finding to native Problems.
 *
 * One replaceable projection exists per open `.ganttee` URI, independently of
 * editor panels. Document findings are re-evaluated from the current text on
 * every observed revision; transient draft, rejected-edit, and operation
 * findings come from the {@link TransientFeedbackStore}.
 */
export class GantteeDiagnosticsService implements vscode.Disposable, vscode.CodeActionProvider {
  /** Owner of transient findings. */
  readonly feedback: TransientFeedbackStore;
  /** Native collection receiving the findings. */
  private readonly _collection: vscode.DiagnosticCollection;
  /** Translator for the current display language. */
  private readonly _translate: Translate;
  /** Tracked documents by URI string. */
  private readonly _documents = new Map<string, vscode.TextDocument>();
  /** Latest evaluated projection by URI string. */
  private readonly _projections = new Map<string, Projection>();
  /** Normalized replacement text of a pending automatic cleanup, by URI string. */
  private readonly _expectedCleanupTexts = new Map<string, string>();
  /** Published operation diagnostics by URI string, for the dismiss quick fix. */
  private readonly _operationDiagnostics = new Map<string, OperationDiagnostic[]>();
  /** Owned subscriptions. */
  private readonly _disposables: vscode.Disposable[] = [];

  /**
   * @param feedback Owner of transient findings.
   * @param options Replaceable collaborators.
   */
  constructor(feedback: TransientFeedbackStore, options: GantteeDiagnosticsOptions = {}) {
    this.feedback = feedback;
    this._collection =
      options.collection ?? vscode.languages.createDiagnosticCollection(GANTTEE_LANGUAGE_ID);
    this._translate = options.translate ?? ((message, ...args) => vscode.l10n.t(message, ...args));
    this._disposables.push(this._collection);
    const unsubscribe = feedback.onDidChange((uri) => this.publish(uri));
    this._disposables.push({ dispose: unsubscribe });
  }

  /**
   * Creates the service, tracks every open and future `.ganttee` document,
   * and registers its dismiss command and quick fix.
   *
   * @param options Replaceable collaborators.
   * @returns The service; dispose it to remove every owned finding and subscription.
   */
  static register(options: GantteeDiagnosticsOptions = {}): GantteeDiagnosticsService {
    const service = new GantteeDiagnosticsService(new TransientFeedbackStore(), options);
    const registerCommand = options.registerCommand ?? vscode.commands.registerCommand;
    service._disposables.push(
      vscode.workspace.onDidOpenTextDocument((document) => service.track(document)),
      vscode.workspace.onDidChangeTextDocument((event) => service.track(event.document)),
      vscode.workspace.onDidCloseTextDocument((document) => service.close(document)),
      registerCommand(DISMISS_OPERATION_PROBLEM_COMMAND, (uri, key) => service.dismiss(uri, key)),
      vscode.languages.registerCodeActionsProvider({ language: GANTTEE_LANGUAGE_ID }, service, {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
      }),
    );
    for (const document of vscode.workspace.textDocuments) {
      service.track(document);
    }
    return service;
  }

  /**
   * Returns whether a document is a `.ganttee` document.
   *
   * @param document The document to test.
   */
  static isGanttee(document: vscode.TextDocument): boolean {
    return document.languageId === GANTTEE_LANGUAGE_ID || document.uri.path.endsWith(".ganttee");
  }

  /**
   * Observes an opened or changed document revision and republishes its findings.
   * Non-Ganttee documents are ignored.
   *
   * @param document The observed document.
   */
  track(document: vscode.TextDocument): void {
    if (!GantteeDiagnosticsService.isGanttee(document)) {
      return;
    }
    const uri = document.uri.toString();
    const known = this._documents.has(uri);
    this._documents.set(uri, document);
    if (!known) {
      this.feedback.openDocument(uri, document.version);
    } else if (this._projections.get(uri)?.revision !== document.version) {
      const expected = this._expectedCleanupTexts.get(uri);
      this._expectedCleanupTexts.delete(uri);
      const cleanup = expected !== undefined && normalizeEol(document.getText()) === expected;
      this.feedback.noteDocumentChange(uri, document.version, { cleanup });
    }
    this.publish(uri);
  }

  /**
   * Forgets a closed document and removes every finding it owns.
   *
   * @param document The closed document.
   */
  close(document: vscode.TextDocument): void {
    const uri = document.uri.toString();
    if (!this._documents.delete(uri)) {
      return;
    }
    this._projections.delete(uri);
    this._expectedCleanupTexts.delete(uri);
    this._operationDiagnostics.delete(uri);
    this.feedback.clearUri(uri);
    this._collection.delete(document.uri);
  }

  /**
   * Clears the current finding of one operation. Invalid arguments are ignored.
   *
   * @param uri The document URI string.
   * @param operationKey The operation key.
   * @returns Whether a finding was cleared.
   */
  dismiss(uri: unknown, operationKey: unknown): boolean {
    return (
      typeof uri === "string" &&
      typeof operationKey === "string" &&
      this.feedback.dismissOperation(uri, operationKey)
    );
  }

  /**
   * Returns the evaluation of a document's current revision.
   *
   * @param document The document to evaluate.
   */
  evaluation(document: vscode.TextDocument): DocumentEvaluation {
    return this.projection(document).evaluation;
  }

  /**
   * Marks the next observed change of a URI as the automatic cleanup's own
   * replacement when its text equals `text`, so it does not expire the cleanup
   * finding.
   *
   * @param uri The document URI.
   * @param text The replacement text about to be applied.
   */
  expectCleanupChange(uri: vscode.Uri, text: string): void {
    this._expectedCleanupTexts.set(uri.toString(), normalizeEol(text));
  }

  /**
   * Cancels a cleanup expectation after the cleanup edit was rejected.
   *
   * @param uri The document URI.
   */
  cancelCleanupChange(uri: vscode.Uri): void {
    this._expectedCleanupTexts.delete(uri.toString());
  }

  /**
   * Renders a finding as a localized, label-safe message.
   *
   * @param finding The finding.
   * @param labels The label context of its origin.
   */
  describe(finding: GantteeFinding, labels: LabelSnapshot): string {
    return describeFindingWithOrigin(finding, labels, this._translate);
  }

  /**
   * Offers a dismiss quick fix for each operation diagnostic in the context.
   *
   * @param document The document.
   * @param _range The requested range.
   * @param context The diagnostics in the requested range.
   */
  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const uri = document.uri.toString();
    const published = this._operationDiagnostics.get(uri) ?? [];
    const actions: vscode.CodeAction[] = [];
    for (const diagnostic of context.diagnostics) {
      const match = published.find((entry) => sameDiagnostic(entry.diagnostic, diagnostic));
      if (match === undefined) {
        continue;
      }
      const action = new vscode.CodeAction(
        this._translate("Dismiss this operation problem"),
        vscode.CodeActionKind.QuickFix,
      );
      action.diagnostics = [diagnostic];
      action.command = {
        command: DISMISS_OPERATION_PROBLEM_COMMAND,
        title: action.title,
        arguments: [uri, match.operationKey],
      };
      actions.push(action);
    }
    return actions;
  }

  /** Removes every owned finding and subscription. */
  dispose(): void {
    this._collection.clear();
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
    this._disposables.length = 0;
    this._documents.clear();
    this._projections.clear();
    this._expectedCleanupTexts.clear();
    this._operationDiagnostics.clear();
  }

  /** Republishes every finding of one tracked URI from its current revision. */
  private publish(uri: string): void {
    const document = this._documents.get(uri);
    if (document === undefined || document.isClosed) {
      return;
    }
    const projection = this.projection(document);
    const diagnostics = projection.evaluation.findings.map((finding) =>
      this.toDiagnostic(document, projection, finding, projection.evaluation.labels),
    );
    const operations: OperationDiagnostic[] = [];
    for (const entry of this.feedback.entries(uri)) {
      for (const finding of entry.findings) {
        const diagnostic = this.toDiagnostic(document, projection, finding, entry.labels);
        diagnostics.push(diagnostic);
        if (entry.operationKey !== undefined) {
          operations.push({ diagnostic, operationKey: entry.operationKey });
        }
      }
    }
    this._operationDiagnostics.set(uri, operations);
    this._collection.set(document.uri, diagnostics);
  }

  /** Returns the projection of a document's current revision, evaluating it when needed. */
  private projection(document: vscode.TextDocument): Projection {
    const uri = document.uri.toString();
    const cached = this._projections.get(uri);
    if (cached !== undefined && cached.revision === document.version) {
      return cached;
    }
    const text = document.getText();
    const scan = scanJson(text);
    const projection: Projection = {
      revision: document.version,
      evaluation: evaluateDocumentText(text),
      root: scan.ok ? scan.root : undefined,
    };
    if (this._documents.has(uri)) {
      this._projections.set(uri, projection);
    }
    return projection;
  }

  /** Converts one finding into a native diagnostic for the current revision. */
  private toDiagnostic(
    document: vscode.TextDocument,
    projection: Projection,
    finding: GantteeFinding,
    labels: LabelSnapshot,
  ): vscode.Diagnostic {
    const diagnostic = new vscode.Diagnostic(
      this.primaryRange(document, projection, finding),
      this.describe(finding, labels),
      finding.severity === "error"
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning,
    );
    diagnostic.source = GANTTEE_DIAGNOSTIC_SOURCE;
    diagnostic.code = this.code(document, projection, finding);
    const related = (finding.related ?? []).flatMap((entry) => {
      const range =
        finding.origin === "document"
          ? offsetRange(document, entry.location.start, entry.location.end)
          : this.subjectRange(document, projection, entry.subject);
      return range === undefined
        ? []
        : [
            new vscode.DiagnosticRelatedInformation(
              new vscode.Location(document.uri, range),
              describeRelated(entry, labels, this._translate),
            ),
          ];
    });
    if (related.length > 0) {
      diagnostic.relatedInformation = related;
    }
    return diagnostic;
  }

  /**
   * Returns the diagnostic code: the finding category, linked to the edit form
   * of its primary item when that item exists in the current revision.
   */
  private code(
    document: vscode.TextDocument,
    projection: Projection,
    finding: GantteeFinding,
  ): vscode.Diagnostic["code"] {
    const entity = problemItemRef(finding, projection.evaluation.labels);
    if (entity === undefined) {
      return finding.category;
    }
    const argument = encodeProblemItemArgument({ uri: document.uri.toString(), entity });
    return {
      value: finding.category,
      target: vscode.Uri.from({
        scheme: "command",
        path: OPEN_PROBLEM_ITEM_COMMAND,
        query: JSON.stringify([argument]),
      }),
    };
  }

  /**
   * Returns the primary range of a finding. Document findings carry offsets
   * into the evaluated text; transient findings point at the current record of
   * their primary subject, or the document start.
   */
  private primaryRange(
    document: vscode.TextDocument,
    projection: Projection,
    finding: GantteeFinding,
  ): vscode.Range {
    const documentRange =
      finding.origin === "document"
        ? offsetRange(document, finding.location?.start, finding.location?.end)
        : undefined;
    const subject = finding.subjects[0];
    return (
      documentRange ??
      (subject === undefined ? undefined : this.subjectRange(document, projection, subject)) ??
      new vscode.Range(0, 0, 0, 0)
    );
  }

  /** Returns a zero-width range at the current authored record of a subject. */
  private subjectRange(
    document: vscode.TextDocument,
    projection: Projection,
    subject: SubjectRef,
  ): vscode.Range | undefined {
    const node = this.subjectNode(projection, subject);
    if (node === undefined) {
      return undefined;
    }
    const position = document.positionAt(node.start);
    return new vscode.Range(position, position);
  }

  /** Finds the authored record of a subject in the current revision. */
  private subjectNode(projection: Projection, subject: SubjectRef): JsonSourceNode | undefined {
    const root = projection.root;
    if (root === undefined || subject.id === undefined) {
      return undefined;
    }
    const labels = projection.evaluation.labels;
    if (subject.kind === "dependency") {
      const entry = labels.dependencies.find((dependency) => dependency.id === subject.id);
      return entry === undefined ? undefined : nodeAt(root, ["dependencies", entry.index]);
    }
    const entry = labels.items.find(
      (item) =>
        item.id === subject.id &&
        (subject.kind === "item" ? item.kind !== "status" : item.kind === subject.kind),
    );
    return entry === undefined
      ? undefined
      : nodeAt(root, [...COLLECTION_PATHS[entry.kind], entry.index]);
  }
}

/** Returns the range of resolved offsets, or undefined when no authored span is known. */
function offsetRange(
  document: vscode.TextDocument,
  start: number | undefined,
  end: number | undefined,
): vscode.Range | undefined {
  if (start === undefined || end === undefined || end === 0) {
    return undefined;
  }
  return new vscode.Range(document.positionAt(start), document.positionAt(end));
}

/** Normalizes line endings so EOL conversion by the editor does not hide a match. */
function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

/** Returns whether two diagnostics describe the same published problem. */
function sameDiagnostic(left: vscode.Diagnostic, right: vscode.Diagnostic): boolean {
  return (
    left.message === right.message &&
    left.range.isEqual(right.range) &&
    codeValue(left.code) === codeValue(right.code)
  );
}

/** Returns the displayed value of a diagnostic code, linked or not. */
function codeValue(code: vscode.Diagnostic["code"]): string {
  return String(typeof code === "object" ? code.value : code);
}
