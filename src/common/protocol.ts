import {
  Dependency,
  Group,
  Milestone,
  ProjectItemType,
  ProjectView,
  Task,
} from "@common/documents";
import { ProjectPresentation } from "@common/presentation/project";

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
  | { type: "editEntity"; entity: EditableEntityRef }
  | {
      //  Authoritative outcome of one correlated webview entity-update proposal.
      //  This acknowledgment is independent of `documentChanged`; either message may arrive first.
      type: "updateEntityResult";
      requestId: number;
      entity: EditableEntityRef;
      updated: boolean;
    }
  | { type: "deleteEntityResult"; entity: EditableEntityRef; deleted: boolean };

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
 * Message posted by the webview to propose an entity update against a document revision.
 * The host returns an `updateEntityResult` with the same request id after validation and apply.
 */
export type UpdateEntityMessage = {
  [K in EditableEntityKind]: {
    type: "updateEntity";
    /** Correlates this proposal with its authoritative host result. */
    requestId: number;
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
  | { type: "addDependency"; dependency: Dependency; baseRevision: number }
  | { type: "removeDependency"; dependencyId: string; baseRevision: number }
  | {
      type: "deleteEntity";
      entity: EditableEntityRef;
      strategy?: GroupDeleteStrategy;
      baseRevision: number;
    }
  | { type: "requestEditEntity"; entity: EditableEntityRef };
