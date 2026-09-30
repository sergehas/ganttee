import {
  Dependency,
  Group,
  Milestone,
  ProjectItemType,
  ProjectSettings,
  ProjectStatus,
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
      surface: ProjectEditorSurface;
    }
  | { type: "documentChanged"; project: ProjectPresentation; revision: number }
  | { type: "documentError"; message: string }
  | {
      type: "settingsEditResult";
      requestId: number;
      accepted: boolean;
      message?: string;
    }
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

/** Webview surface rendered for one project document. */
export type ProjectEditorSurface = "chart" | "settings";

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

/** Message posted to save the complete settings snapshot against one revision. */
export interface UpdateSettingsMessage {
  /** Correlates this proposal with its authoritative host result. */
  requestId: number;
  /** Complete next settings value from the current project presentation. */
  settings: ProjectSettings;
  /** Document revision from which the settings edit was derived. */
  baseRevision: number;
}

/** Message posted to add a status with a host-generated identifier. */
export interface AddProjectStatusMessage {
  /** Correlates this proposal with its authoritative host result. */
  requestId: number;
  /** New status metadata before the host assigns its document-local id. */
  status: Omit<ProjectStatus, "id">;
  /** Document revision from which the status addition was derived. */
  baseRevision: number;
}

/** Messages sent from the webview to the extension host. */
export type WebviewToHostMessage =
  | { type: "ready" }
  | { type: "openSettings" }
  | UpdateEntityMessage
  | ({ type: "updateSettings" } & UpdateSettingsMessage)
  | ({ type: "addProjectStatus" } & AddProjectStatusMessage)
  | {
      type: "updateProjectStatus";
      requestId: number;
      status: ProjectStatus;
      baseRevision: number;
    }
  | {
      type: "deleteProjectStatus";
      requestId: number;
      statusId: string;
      baseRevision: number;
    }
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
