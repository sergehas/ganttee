import { Dependency } from "./models/dependency";
import { GanttDocument } from "./models/document";
import { Milestone, Task } from "./models/task";

/**
 * Message protocol between the extension host and the editor webview.
 *
 * `HostToWebview` messages are posted by the extension host; `WebviewToHost`
 * messages are posted by the webview. Both sides discriminate on `type`.
 */

/** Messages sent from the extension host to the webview. */
export type HostToWebviewMessage =
  | { type: "init"; document: GanttDocument }
  | { type: "documentChanged"; document: GanttDocument }
  | { type: "selectTask"; taskId: string }
  | { type: "editTask"; taskId: string };

/** Messages sent from the webview to the extension host. */
export type WebviewToHostMessage =
  | { type: "ready" }
  | { type: "updateTask"; task: Task }
  | { type: "updateMilestone"; milestone: Milestone }
  | { type: "addDependency"; dependency: Dependency }
  | { type: "removeDependency"; dependencyId: string }
  | { type: "deleteTask"; taskId: string }
  | { type: "requestEditTask"; taskId: string };
