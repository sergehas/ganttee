import { ProjectModel, ProjectSnapshot, ScheduleDiagnostic, SchedulingError } from "@common/models";
import { hasBlockingScheduleDiagnostic } from "@services/schedule/scheduleGraphValidationService";
import { schedule } from "@services/schedule/schedulingService";

/** Result of assembling one immutable project snapshot. */
export interface ProjectSnapshotCreation {
  /** Hydrated state with any successfully computed schedule. */
  readonly snapshot: ProjectSnapshot;
  /** Recoverable scheduling failure, when schedule computation failed. */
  readonly schedulingError?: SchedulingError;
}

/**
 * Builds a project snapshot, scheduling only when diagnostics permit it.
 *
 * @param model Hydrated authored project state.
 * @param diagnostics Current semantic diagnostics.
 * @returns Snapshot plus any recoverable scheduling failure.
 */
export function createProjectSnapshot(
  model: ProjectModel,
  diagnostics: readonly ScheduleDiagnostic[],
): ProjectSnapshotCreation {
  if (hasBlockingScheduleDiagnostic(diagnostics)) {
    return { snapshot: new ProjectSnapshot(model, undefined, diagnostics) };
  }
  try {
    return { snapshot: new ProjectSnapshot(model, schedule(model), diagnostics) };
  } catch (error) {
    if (!(error instanceof SchedulingError)) {
      throw error;
    }
    return {
      snapshot: new ProjectSnapshot(model, undefined, diagnostics),
      schedulingError: error,
    };
  }
}
