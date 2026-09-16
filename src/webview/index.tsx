import "@vscode/codicons/dist/codicon.css";
import { App } from "@webview/App";
import "@webview/index.scss";
import { createRoot } from "react-dom/client";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<App />);
}
