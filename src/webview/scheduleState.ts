import { GanttDocument, ScheduledModel } from "../common/models";
import { EditableEntityKind, EditableEntityMap } from "../common/protocol";
import { replaceEntity } from "../services/documentEntityService";
import { hydrateDocument } from "../services/ganttModelService";
import { schedule } from "../services/schedulingService";

/** Webview state associating a host document revision with its computed schedule. */
export interface WebviewScheduleState {
  /** Host-authoritative authoring document used to derive the schedule. */
  readonly document: GanttDocument;
  /** Host text-document revision used for stale-write rejection. */
  readonly revision: number;
  /** Complete task, milestone, and group scheduling result. */
  readonly scheduledModel: ScheduledModel;
}

/**
 * Creates webview scheduling state from one host document revision.
 *
 * @param document The authoring document received from the host.
 * @param revision The corresponding host text-document revision.
 */
export function createWebviewScheduleState(
  document: GanttDocument,
  revision: number,
): WebviewScheduleState {
  const model = hydrateDocument(document);
  return {
    document,
    revision,
    scheduledModel: schedule(model, model.graph),
  };
}

/**
 * Replaces one authoring entity and recomputes the local schedule.
 *
 * @param current The current host-based webview state.
 * @param kind The entity collection to update.
 * @param entity The replacement entity.
 * @returns Recomputed state, or undefined when the entity is stale.
 */
export function updateWebviewScheduleEntity<K extends EditableEntityKind>(
  current: WebviewScheduleState,
  kind: K,
  entity: EditableEntityMap[K],
): WebviewScheduleState | undefined {
  const document = replaceEntity(current.document, kind, entity);
  return document === undefined
    ? undefined
    : createWebviewScheduleState(document, current.revision);
}
