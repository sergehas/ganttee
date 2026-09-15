import "@vscode/codicons/dist/codicon.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./features/chart/chart.scss";
import "./features/entity-editor/entityEditor.scss";
import "./index.scss";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<App />);
}
