import * as vscode from "vscode";
import { GanttStore } from "../../ganttStore";
import { GanttEditorController } from "./ganttEditorController";

/** Registers the Gantt chart custom editor for `.ganttee` files. */
export class GanttEditorProvider implements vscode.CustomTextEditorProvider {
  static readonly viewType = "ganttee.chartEditor";

  static register(
    context: vscode.ExtensionContext,
    store: GanttStore,
  ): vscode.Disposable {
    const provider = new GanttEditorProvider(context, store);
    return vscode.window.registerCustomEditorProvider(
      GanttEditorProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } },
    );
  }

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly store: GanttStore,
  ) {}

  resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
  ): void {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist"),
        vscode.Uri.joinPath(this.context.extensionUri, "media"),
      ],
    };
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

    const controller = new GanttEditorController(document, webviewPanel);
    this.store.setActive(controller);

    const modelSubscription = controller.onDidChangeModel(() => {
      if (this.store.active === controller) {
        this.store.notifyModelChanged();
      }
    });

    const viewStateSubscription = webviewPanel.onDidChangeViewState((event) => {
      if (event.webviewPanel.active) {
        this.store.setActive(controller);
      }
    });

    webviewPanel.onDidDispose(() => {
      modelSubscription.dispose();
      viewStateSubscription.dispose();
      this.store.clear(controller);
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
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Gantt Chart</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function createNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
