/**
 * Builders for draft-local findings that edit forms mirror into Problems. They
 * derive from unsaved drafts only and never carry source locations, so valid
 * source text is not marked as containing an unsaved invalid value.
 */

import { Dependency, Group, Milestone, ProjectContent, Task } from "@common/documents";
import {
  DeterminacyDiagnostic,
  GantteeFinding,
  LabelSnapshot,
  labelSnapshotOf,
  SubjectRef,
} from "@common/models";
import { EditableEntityKind, EditableEntityMap } from "@common/protocol";
import {
  diagnoseDeterminacy,
  validateMilestoneConstraints,
  validateTaskConstraints,
} from "@services/schedule/scheduleConstraintService";

/** Draft-local settings conditions that block a settings form submission. */
export interface SettingsDraftState {
  /** Whether the entered holiday range ends before it starts. */
  readonly invalidHolidayRange: boolean;
  /** Whether the new status name is blank. */
  readonly blankStatusName: boolean;
}

/**
 * Computes the draft findings shown by an entity edit form.
 *
 * @param kind The edited entity kind.
 * @param entity The unsaved draft.
 * @param dependencies Dependencies of the current document revision.
 * @returns Findings in display order; empty when the draft is valid.
 */
export function entityDraftFindings(
  kind: EditableEntityKind,
  entity: EditableEntityMap[EditableEntityKind],
  dependencies: readonly Dependency[],
): GantteeFinding[] {
  const subject: SubjectRef = { kind, id: entity.id };
  const findings: GantteeFinding[] = [];
  if (entity.name.trim() === "") {
    findings.push(
      draftFinding("invalidInput", "error", subject, {
        field: "name",
        expectation: "nonEmptyString",
      }),
    );
  }
  switch (kind) {
    case "task":
      findings.push(...taskFindings(entity as Task, subject, dependencies));
      break;
    case "milestone":
      findings.push(
        ...determinacyFindings(
          subject,
          diagnoseDeterminacy(
            entity.id,
            validateMilestoneConstraints(entity as Milestone, dependencies),
          ),
        ),
      );
      break;
    case "group":
      if ((entity as Group).groupId === entity.id) {
        findings.push(draftFinding("groupSelfParent", "error", subject));
      }
      break;
  }
  return findings;
}

/**
 * Computes the draft findings shown by the settings form.
 *
 * @param state The blocking conditions currently shown inline.
 * @param holidayCount Number of holidays in the current revision; locates the new range.
 */
export function settingsDraftFindings(
  state: SettingsDraftState,
  holidayCount: number,
): GantteeFinding[] {
  const findings: GantteeFinding[] = [];
  if (state.invalidHolidayRange) {
    findings.push(
      draftFinding("invalidHolidayRange", "error", { kind: "holiday", index: holidayCount }),
    );
  }
  if (state.blankStatusName) {
    findings.push(draftFinding("blankStatusName", "error", { kind: "status" }));
  }
  return findings;
}

/**
 * Captures labels for a draft, letting an unsaved rename or new item take precedence
 * over the authoritative document labels.
 *
 * @param document The current document revision.
 * @param kind The edited entity kind.
 * @param entity The unsaved draft.
 */
export function draftLabelSnapshot(
  document: ProjectContent,
  kind: EditableEntityKind,
  entity: EditableEntityMap[EditableEntityKind],
): LabelSnapshot {
  return labelSnapshotOf({
    ...document,
    tasks: kind === "task" ? replaced(document.tasks, entity as Task) : document.tasks,
    milestones:
      kind === "milestone"
        ? replaced(document.milestones, entity as Milestone)
        : document.milestones,
    groups: kind === "group" ? replaced(document.groups, entity as Group) : document.groups,
  });
}

/** Describes a failed chart image export. */
export function exportFailedFinding(): GantteeFinding {
  return { category: "exportFailed", severity: "error", origin: "operation", subjects: [] };
}

/** Builds task-only date, duration, and determinacy findings. */
function taskFindings(
  task: Task,
  subject: SubjectRef,
  dependencies: readonly Dependency[],
): GantteeFinding[] {
  const findings: GantteeFinding[] = [];
  if (task.start !== undefined && task.end !== undefined && task.end < task.start) {
    findings.push(draftFinding("invalidTaskDateRange", "error", subject));
  }
  if (task.duration !== undefined && !(Number.isFinite(task.duration) && task.duration >= 0)) {
    findings.push(draftFinding("invalidDuration", "error", subject));
  }
  findings.push(
    ...determinacyFindings(
      subject,
      diagnoseDeterminacy(task.id, validateTaskConstraints(task, dependencies)),
    ),
  );
  return findings;
}

/** Maps a determinacy diagnostic to the same finding the document evaluation produces. */
function determinacyFindings(
  subject: SubjectRef,
  diagnostic: DeterminacyDiagnostic | undefined,
): GantteeFinding[] {
  if (diagnostic === undefined) {
    return [];
  }
  const severity = diagnostic.severity === "blocking" ? "error" : "warning";
  return [
    draftFinding(
      diagnostic.kind,
      severity,
      subject,
      diagnostic.kind === "overConstrained"
        ? { count: diagnostic.count, duplicateEndpoints: diagnostic.duplicateEndpoints }
        : { count: diagnostic.count },
    ),
  ];
}

/** Builds one draft-origin finding. */
function draftFinding(
  category: GantteeFinding["category"],
  severity: GantteeFinding["severity"],
  subject: SubjectRef,
  args?: GantteeFinding["args"],
): GantteeFinding {
  return { category, severity, origin: "draft", subjects: [subject], args };
}

/** Replaces the item with the draft's id, or appends the draft when it is new. */
function replaced<T extends { id: string }>(items: readonly T[], draft: T): T[] {
  const index = items.findIndex((item) => item.id === draft.id);
  return index < 0
    ? [...items, draft]
    : [...items.slice(0, index), draft, ...items.slice(index + 1)];
}
