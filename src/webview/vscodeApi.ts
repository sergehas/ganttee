import { HostToWebviewMessage, WebviewToHostMessage } from "../common/protocol";

interface VsCodeApi {
  postMessage(message: WebviewToHostMessage): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): void;
}

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
