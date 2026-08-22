import { HostToWebviewMessage, WebviewToHostMessage } from "../common/protocol";

interface VsCodeApi {
  /** Sends a message to the extension host. */
  postMessage(message: WebviewToHostMessage): void;
  /** Reads persisted webview state. */
  getState<T>(): T | undefined;
  /** Persists webview state. */
  setState<T>(state: T): void;
}

/** Acquires the VS Code webview API exposed by the host. */
declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();

/** Posts a typed message to the extension host. */
export function postToHost(message: WebviewToHostMessage): void {
  vscode.postMessage(message);
}

/** Subscribes to typed messages from the extension host. */
export function onHostMessage(
  handler: (message: HostToWebviewMessage) => void,
): () => void {
  const listener = (event: MessageEvent<HostToWebviewMessage>) =>
    handler(event.data);
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
