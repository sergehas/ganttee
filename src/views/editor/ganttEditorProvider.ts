import { ProjectEditorSurface } from "@common/protocol";
import { GanttStore } from "@src/ganttStore";
import { DocumentEditQueue } from "@views/editor/documentEditQueue";
import {
  GANTTEE_CHART_EDITOR_VIEW_TYPE,
  GANTTEE_SETTINGS_EDITOR_VIEW_TYPE,
} from "@views/editor/editorViewTypes";
import { GanttEditorController } from "@views/editor/ganttEditorController";
import * as vscode from "vscode";

/** Registers the Gantt chart custom editor for `.ganttee` files. */
export class GanttEditorProvider implements vscode.CustomTextEditorProvider {
  static readonly viewType = GANTTEE_CHART_EDITOR_VIEW_TYPE;
  static readonly settingsViewType = GANTTEE_SETTINGS_EDITOR_VIEW_TYPE;

  /**
   * Registers the provider.
   * @param context Extension context owning the registration.
   * @param store Active-editor store.
   * @param log Output channel receiving document-loading warnings.
   * @returns The registration disposable.
   */
  static register(
    context: vscode.ExtensionContext,
    store: GanttStore,
    log: vscode.LogOutputChannel,
  ): vscode.Disposable {
    const editQueue = new DocumentEditQueue();
    const chartProvider = new GanttEditorProvider(context, store, log, editQueue, "chart");
    const settingsProvider = new GanttEditorProvider(
      context,
      undefined,
      log,
      editQueue,
      "settings",
    );
    return vscode.Disposable.from(
      vscode.window.registerCustomEditorProvider(GanttEditorProvider.viewType, chartProvider, {
        webviewOptions: { retainContextWhenHidden: true },
      }),
      vscode.window.registerCustomEditorProvider(
        GanttEditorProvider.settingsViewType,
        settingsProvider,
        { webviewOptions: { retainContextWhenHidden: true } },
      ),
    );
  }

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly store: GanttStore | undefined,
    private readonly log: vscode.LogOutputChannel,
    private readonly editQueue: DocumentEditQueue,
    private readonly surface: ProjectEditorSurface,
  ) {}

  resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): void {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist"),
        vscode.Uri.joinPath(this.context.extensionUri, "media"),
      ],
    };
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

    const iconBaseUri = webviewPanel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "icons"),
    );
    const controller = new GanttEditorController(
      document,
      webviewPanel,
      iconBaseUri.toString(),
      this.log,
      this.editQueue,
      this.surface,
    );
    this.store?.setActive(controller);

    const modelSubscription = this.store
      ? controller.onDidChangeModel(() => {
          if (this.store?.active === controller) {
            this.store.notifyModelChanged();
          }
        })
      : undefined;

    const viewStateSubscription = this.store
      ? webviewPanel.onDidChangeViewState((event) => {
          if (event.webviewPanel.active) {
            this.store?.setActive(controller);
          }
        })
      : undefined;

    webviewPanel.onDidDispose(() => {
      modelSubscription?.dispose();
      viewStateSubscription?.dispose();
      this.store?.clear(controller);
      controller.dispose();
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.js"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.css"),
    );
    const nonce = createNonce();
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} https: data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="${vscode.env.language}">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>${vscode.l10n.t(this.surface === "settings" ? "Project Settings" : "Gantt Chart")}</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function createNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
