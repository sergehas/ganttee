import {
  Dependency,
  Group,
  Milestone,
  ProjectItemType,
  ProjectView,
  Task,
} from "@common/documents";
import { ProjectPresentation } from "@common/presentation";

/**
 * Message protocol between the extension host and the editor webview.
 *
 * `HostToWebview` messages are posted by the extension host; `WebviewToHost`
 * messages are posted by the webview. Both sides discriminate on `type`.
 */

/** Messages sent from the extension host to the webview. */
export type HostToWebviewMessage =
  | {
      type: "l10nCatalog";
      locale: string;
      strings: Readonly<Record<string, string>>;
    }
  | {
      type: "init";
      project: ProjectPresentation;
      revision: number;
      iconBaseUri: string;
    }
  | { type: "documentChanged"; project: ProjectPresentation; revision: number }
  | { type: "selectEntity"; entity: EditableEntityRef }
  | { type: "editEntity"; entity: EditableEntityRef };

/** Supported editable entity kinds. */
export type EditableEntityKind = ProjectItemType;

/** Lightweight identity reference used by routing messages. */
export interface EditableEntityRef {
  kind: EditableEntityKind;
  id: string;
}

/**
 * Persisted entity payload mapped by editable kind.
 */
export interface EditableEntityMap {
  task: Task;
  milestone: Milestone;
  group: Group;
}

/** Strategy to apply when deleting a non-empty group. */
export type GroupDeleteStrategy = "cascade" | "reparent";

/**
 * Message posted by the webview to save an edited entity.
 */
export type UpdateEntityMessage = {
  [K in EditableEntityKind]: {
    type: "updateEntity";
    kind: K;
    entity: EditableEntityMap[K];
    baseRevision: number;
  };
}[EditableEntityKind];

/** Messages sent from the webview to the extension host. */
export type WebviewToHostMessage =
  | { type: "ready" }
  | UpdateEntityMessage
  | { type: "updateView"; view: ProjectView; baseRevision: number }
  | { type: "addDependency"; dependency: Dependency }
  | { type: "removeDependency"; dependencyId: string }
  | {
      type: "deleteEntity";
      entity: EditableEntityRef;
      strategy?: GroupDeleteStrategy;
    }
  | { type: "requestEditEntity"; entity: EditableEntityRef };
