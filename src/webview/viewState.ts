import { ProjectDocument } from "@common/documents";
import { ProjectSchedule } from "@common/models";
import { EditableEntityKind, EditableEntityMap } from "@common/protocol";
import {
  CriticalPathProjection,
  projectCriticalPath,
} from "@services/dependency-graph/criticalPathService";
import { replaceEntity } from "@services/document/projectItemService";
import { hydrateDocument } from "@services/model/projectModelService";
import { fromScheduledDocument } from "@services/schedule/scheduledDocumentService";

/** Webview state associating a host document revision with its host-computed schedule. */
export interface GanttViewState {
  /** Host-authoritative authoring document used to derive the schedule. */
  readonly document: ProjectDocument;
  /** Host text-document revision used for stale-write rejection. */
  readonly revision: number;
  /** Complete task, milestone, and group scheduling result. */
  readonly scheduledModel: ProjectSchedule;
  /** Derived critical path for the current valid schedule. */
  readonly criticalPath: CriticalPathProjection;
}

/**
 * Creates webview display state from one host document revision and schedule.
 *
 * @param document The authoring document received from the host.
 * @param revision The corresponding host text-document revision.
 */
export function createGanttViewState(document: ProjectDocument, revision: number): GanttViewState {
  const model = hydrateDocument(document);
  if (document.schedule === undefined) {
    throw new Error("Host document does not contain a computed schedule.");
  }
  const scheduledModel = fromScheduledDocument(model, document.schedule);
  return {
    document,
    revision,
    scheduledModel,
    criticalPath: projectCriticalPath(model.graph, scheduledModel),
  };
}

/**
 * Replaces one authoring entity without retaining a stale schedule.
 *
 * @param current The current host-based webview state.
 * @param kind The entity collection to update.
 * @param entity The replacement entity.
 * @returns The updated authored document, or undefined when the entity is stale.
 */
export function updateGanttViewDocument<K extends EditableEntityKind>(
  current: GanttViewState,
  kind: K,
  entity: EditableEntityMap[K],
): ProjectDocument | undefined {
  const document = replaceEntity(current.document, kind, entity);
  if (document === undefined) {
    return undefined;
  }
  const { schedule: _schedule, ...authoredDocument } = document;
  return authoredDocument;
}
