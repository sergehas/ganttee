import { ProjectPresentation } from "@common/presentation/project";

/** Webview state associating a host document revision with its host-computed schedule. */
export interface GanttViewState {
  /** Host-authoritative authored and computed presentation. */
  readonly project: ProjectPresentation;
  /** Host text-document revision used for stale-write rejection. */
  readonly revision: number;
}

/**
 * Creates webview display state from one host document revision and schedule.
 *
 * @param document The authoring document received from the host.
 * @param revision The corresponding host text-document revision.
 */
export function createGanttViewState(
  project: ProjectPresentation,
  revision: number,
): GanttViewState {
  return { project, revision };
}
