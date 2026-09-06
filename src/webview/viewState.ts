import { GanttDocument, ScheduledModel } from "../common/models";
import { EditableEntityKind, EditableEntityMap } from "../common/protocol";
import { replaceEntity } from "../services/documentEntityService";
import { hydrateDocument } from "../services/ganttModelService";
import { fromScheduledDocument } from "../services/scheduledDocumentService";

/** Webview state associating a host document revision with its host-computed schedule. */
export interface GanttViewState {
  /** Host-authoritative authoring document used to derive the schedule. */
  readonly document: GanttDocument;
  /** Host text-document revision used for stale-write rejection. */
  readonly revision: number;
  /** Complete task, milestone, and group scheduling result. */
  readonly scheduledModel: ScheduledModel;
}

/**
 * Creates webview display state from one host document revision and schedule.
 *
 * @param document The authoring document received from the host.
 * @param revision The corresponding host text-document revision.
 */
export function createGanttViewState(
  document: GanttDocument,
  revision: number,
): GanttViewState {
  const model = hydrateDocument(document);
  if (document.schedule === undefined) {
    throw new Error("Host document does not contain a computed schedule.");
  }
  return {
    document,
    revision,
    scheduledModel: fromScheduledDocument(model, document.schedule),
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
): GanttDocument | undefined {
  const document = replaceEntity(current.document, kind, entity);
  if (document === undefined) {
    return undefined;
  }
  const { schedule: _schedule, ...authoredDocument } = document;
  return authoredDocument;
}
