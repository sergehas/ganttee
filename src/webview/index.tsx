import "@vscode/codicons/dist/codicon.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./features/chart/chart.css";
import "./features/entity-editor/entityEditor.css";
import "./index.css";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<App />);
}
