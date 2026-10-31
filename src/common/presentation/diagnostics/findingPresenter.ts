/**
 * Localized, label-safe wording for {@link GantteeFinding}s.
 *
 * This module is shared by the extension host (which injects `vscode.l10n.t`)
 * and the webview (which injects its catalog translator). It never renders
 * internal ids: subjects resolve to authored labels, localized unnamed
 * descriptors, or localized missing descriptors.
 */

import { DependencyType } from "@common/documents/project/dependency";
import {
  FieldExpectation,
  GantteeFinding,
  GantteeFindingOrigin,
  LabelEntry,
  LabelSnapshot,
  RelatedFindingLocation,
  SchedulingFailureReason,
  SubjectRef,
} from "@common/models/diagnostics";

/** Localizes an English template with `{0}`-style positional arguments. */
export type Translate = (message: string, ...args: (string | number)[]) => string;

/** Every English template rendered by this module; each must exist in both l10n bundles. */
export const FINDING_TEMPLATES = {
  taskLabel: 'Task "{0}"',
  milestoneLabel: 'Milestone "{0}"',
  groupLabel: 'Group "{0}"',
  statusLabel: 'Status "{0}"',
  unnamedTask: "unnamed task #{0}",
  unnamedMilestone: "unnamed milestone #{0}",
  unnamedGroup: "unnamed group #{0}",
  unnamedStatus: "unnamed status #{0}",
  missingTask: "missing task",
  missingMilestone: "missing milestone",
  missingGroup: "missing group",
  missingStatus: "missing status",
  missingItem: "missing item",
  inGroup: '{0} in group "{1}"',
  occurrence: "{0} (occurrence {1})",
  dependencyLabel: "dependency {0} {1} {2}",
  unnamedDependency: "dependency #{0}",
  missingDependency: "missing dependency",
  holidayLabel: "holiday #{0}",
  holiday: "holiday",
  project: "the project",
  typeStartAfter: "starts after",
  typeStartWith: "starts with",
  typeEndWith: "ends with",
  typeUnknown: "is linked to",
  listSeparator: ", ",
  cycleSeparator: " → ",
  endpointStart: "start",
  endpointEnd: "end",
  endpointAnd: " and ",
  expectObject: "an object",
  expectArray: "a list",
  expectStringArray: "a list of text values",
  expectNonEmptyString: "non-empty text",
  expectIsoDate: "a date in YYYY-MM-DD format",
  expectNonNegativeNumber: "a non-negative number",
  expectInRange: "a value in the allowed range",
  expectIsoWeekday: "a weekday number from 1 to 7",
  expectItemState: "open or closed",
  expectDependencyType: "startAfter, startWith, or endWith",
  expectZeroDuration: "a zero duration",
  expectDateOrder: "a start that is not after the end",
  expectValid: "a valid value",
  invalidJsonAt: "The document is not valid JSON (line {0}, column {1}).",
  invalidJson: "The document is not valid JSON.",
  invalidRoot: "The document root must be a JSON object.",
  invalidField: 'Invalid value for "{1}" in {0}: expected {2}.',
  unsupportedField: 'Unsupported field "{1}" in {0}.',
  duplicateEntityId: "{0} reuses the identifier of another item.",
  duplicateDependencyId: "{0} reuses the identifier of another dependency.",
  duplicateStatusId: "{0} reuses the identifier of another status.",
  invalidDateRange: "{0} starts after it ends.",
  groupSelfParent: "{0} cannot be its own parent group.",
  unknownParentGroup: "{0} references a missing parent group.",
  groupParentCycle: "Group nesting forms a cycle: {0}.",
  unknownItemGroup: "{0} references a missing group.",
  sequenceNotDirectChild: "The order of {0} lists an item that is not its direct child.",
  sequenceDuplicate: "The order of {0} lists an item more than once.",
  sequenceMissing: "The order of {0} omits one of its items.",
  unknownStatus: "{0} references a missing status; no status is applied.",
  invalidViewValue: 'View setting "{0}" is invalid; the default value {1} is used.',
  selfLoopDependency: "{0} connects an item to itself.",
  parallelDependency: "{0} duplicates another dependency between the same items.",
  dependencyCycle: "Dependencies form a cycle: {0}.",
  underConstrained: "{0} is under-constrained ({1} constraints, need 2).",
  overConstrained: "{0} is over-constrained ({1} constraints, need 2).",
  duplicateConstraint: "{0} has a duplicate {1} constraint.",
  danglingDependency: "{0} references a missing item.",
  groupDependency: "{0} involves a group; groups cannot carry dependencies.",
  unanchoredComponent: "Items without an absolute date anchor: {0}.",
  invalidWorkingCalendar: "The project working calendar is invalid.",
  schedulingFailed: "The schedule cannot be computed: {0}.",
  reasonUnknownEntity: "{0} cannot be found",
  reasonGraphOmission: "{0} is missing from the dependency graph",
  reasonInvalidWorkingTime: "the working time settings are invalid",
  reasonUnscheduledTarget: "{0} could not be placed",
  reasonStartAfterEnd: "{0} would start after it ends",
  reasonUnderConstrained: "{0} lacks enough constraints",
  reasonInvalidDuration: "{0} has an invalid duration",
  reasonUnexpected: "an unexpected scheduling error occurred",
  cleanupRemoved: "Automatic cleanup removed items that could not be scheduled: {0}.",
  cleanupFailed: "Automatic scheduling cleanup could not be applied.",
  invalidDuration: "{0} has an invalid duration.",
  blankStatusName: "A status name cannot be blank.",
  invalidInput: 'Invalid value for "{1}" in {0}: expected {2}.',
  exportFailed: "The chart image could not be exported.",
  dependencyCycleRejected: "{0} would create a dependency cycle.",
  sortUnavailable: "Sort is unavailable without a schedule.",
  unknownItem: "{0} no longer exists.",
  editRejected: "The update to {0} was rejected.",
  originDraft: "Unsaved draft: {0}",
  originRejectedEdit: "Rejected edit: {0}",
  originOperation: "Operation: {0}",
  relatedSubject: "Also affects {0}",
} as const;

const T = FINDING_TEMPLATES;

type ItemKind = LabelEntry["kind"];

const LABEL_TEMPLATES: Record<ItemKind, { named: string; unnamed: string; missing: string }> = {
  task: { named: T.taskLabel, unnamed: T.unnamedTask, missing: T.missingTask },
  milestone: { named: T.milestoneLabel, unnamed: T.unnamedMilestone, missing: T.missingMilestone },
  group: { named: T.groupLabel, unnamed: T.unnamedGroup, missing: T.missingGroup },
  status: { named: T.statusLabel, unnamed: T.unnamedStatus, missing: T.missingStatus },
};

const DEPENDENCY_TYPE_TEMPLATES: Record<DependencyType, string> = {
  startAfter: T.typeStartAfter,
  startWith: T.typeStartWith,
  endWith: T.typeEndWith,
};

const EXPECTATION_TEMPLATES: Record<FieldExpectation, string> = {
  object: T.expectObject,
  array: T.expectArray,
  stringArray: T.expectStringArray,
  nonEmptyString: T.expectNonEmptyString,
  isoDate: T.expectIsoDate,
  nonNegativeNumber: T.expectNonNegativeNumber,
  inRange: T.expectInRange,
  isoWeekday: T.expectIsoWeekday,
  itemState: T.expectItemState,
  dependencyType: T.expectDependencyType,
  zeroDuration: T.expectZeroDuration,
  dateOrder: T.expectDateOrder,
};

const REASON_TEMPLATES: Record<SchedulingFailureReason, string> = {
  unknownEntity: T.reasonUnknownEntity,
  graphOmission: T.reasonGraphOmission,
  invalidWorkingTime: T.reasonInvalidWorkingTime,
  unscheduledTarget: T.reasonUnscheduledTarget,
  startAfterEnd: T.reasonStartAfterEnd,
  underConstrained: T.reasonUnderConstrained,
  invalidDuration: T.reasonInvalidDuration,
};

const ORIGIN_TEMPLATES: Partial<Record<GantteeFindingOrigin, string>> = {
  draft: T.originDraft,
  rejectedEdit: T.originRejectedEdit,
  operation: T.originOperation,
};

/** Item kinds an `item` subject may resolve to. */
const ENTITY_KINDS: readonly ItemKind[] = ["task", "milestone", "group"];

/**
 * Finds the label entry a subject refers to. An exact id + index match wins
 * (duplicate ids), then the first id match; subjects without an id resolve by
 * index within a single kind.
 */
function findEntry(
  kinds: readonly ItemKind[],
  subject: SubjectRef,
  labels: LabelSnapshot,
): LabelEntry | undefined {
  const candidates = labels.items.filter((entry) => kinds.includes(entry.kind));
  if (subject.id === undefined) {
    return kinds.length === 1 && subject.index !== undefined
      ? candidates.find((entry) => entry.index === subject.index)
      : undefined;
  }
  const byId = candidates.filter((entry) => entry.id === subject.id);
  return byId.find((entry) => entry.index === subject.index) ?? byId[0];
}

/** Returns the trimmed authored name, or undefined when blank or absent. */
function nameOf(entry: LabelEntry): string | undefined {
  const name = typeof entry.name === "string" ? entry.name.trim() : "";
  return name.length > 0 ? name : undefined;
}

/** Returns the nonblank name of an entry's containing group, when known. */
function groupNameOf(entry: LabelEntry, labels: LabelSnapshot): string | undefined {
  const group = labels.items.find((item) => item.kind === "group" && item.id === entry.groupId);
  return group === undefined ? undefined : nameOf(group);
}

/** Labels an existing label entry, disambiguating unnamed and duplicate-named entries. */
function labelEntry(entry: LabelEntry, labels: LabelSnapshot, t: Translate): string {
  const templates = LABEL_TEMPLATES[entry.kind];
  const sameKind = labels.items
    .filter((candidate) => candidate.kind === entry.kind)
    .sort((left, right) => left.index - right.index);
  const name = nameOf(entry);
  if (name === undefined) {
    const unnamed = sameKind.filter((candidate) => nameOf(candidate) === undefined);
    return t(templates.unnamed, unnamed.indexOf(entry) + 1);
  }
  const base = t(templates.named, name);
  const homonyms = sameKind.filter((candidate) => nameOf(candidate) === name);
  if (homonyms.length < 2) {
    return base;
  }
  const groupName = groupNameOf(entry, labels);
  const sameGroup = homonyms.filter((candidate) => groupNameOf(candidate, labels) === groupName);
  if (groupName !== undefined && sameGroup.length === 1) {
    return t(T.inGroup, base, groupName);
  }
  return t(T.occurrence, base, homonyms.indexOf(entry) + 1);
}

/** Labels a task, milestone, group, status, or unknown-kind item subject. */
function labelItem(
  subject: SubjectRef,
  kind: ItemKind | "item",
  labels: LabelSnapshot,
  t: Translate,
): string {
  const entry = findEntry(kind === "item" ? ENTITY_KINDS : [kind], subject, labels);
  if (entry !== undefined) {
    return labelEntry(entry, labels, t);
  }
  return t(kind === "item" ? T.missingItem : LABEL_TEMPLATES[kind].missing);
}

/** Labels a dependency by its endpoints and localized type. */
function labelDependency(subject: SubjectRef, labels: LabelSnapshot, t: Translate): string {
  const byId = labels.dependencies.filter((entry) => entry.id === subject.id);
  const entry =
    subject.id === undefined
      ? labels.dependencies.find((candidate) => candidate.index === subject.index)
      : (byId.find((candidate) => candidate.index === subject.index) ?? byId[0]);
  if (entry === undefined) {
    return subject.index === undefined
      ? t(T.missingDependency)
      : t(T.unnamedDependency, subject.index + 1);
  }
  const source = labelItem({ kind: "item", id: entry.sourceId }, "item", labels, t);
  const target = labelItem({ kind: "item", id: entry.targetId }, "item", labels, t);
  const type = entry.type === undefined ? T.typeUnknown : DEPENDENCY_TYPE_TEMPLATES[entry.type];
  return t(T.dependencyLabel, source, t(type), target);
}

/**
 * Renders one subject as a localized, label-safe phrase. Internal ids are
 * never substituted, even when no label is available.
 *
 * @param subject The subject to label.
 * @param labels The revision-, draft-, or proposal-specific label context.
 * @param t Translator for the current display language.
 * @returns The localized label.
 */
export function labelSubject(subject: SubjectRef, labels: LabelSnapshot, t: Translate): string {
  switch (subject.kind) {
    case "task":
    case "milestone":
    case "group":
    case "status":
    case "item":
      return labelItem(subject, subject.kind, labels, t);
    case "dependency":
      return labelDependency(subject, labels, t);
    case "holiday":
      return subject.index === undefined ? t(T.holiday) : t(T.holidayLabel, subject.index + 1);
    case "project":
      return t(T.project);
  }
}

/** Labels the primary subject, or the project when there is none. */
function primaryLabel(finding: GantteeFinding, labels: LabelSnapshot, t: Translate): string {
  const subject = finding.subjects[0];
  return subject === undefined ? t(T.project) : labelSubject(subject, labels, t);
}

/** Labels every subject and joins them with a localized separator. */
function joinSubjects(
  finding: GantteeFinding,
  labels: LabelSnapshot,
  t: Translate,
  separator: string,
): string {
  if (finding.subjects.length === 0) {
    return t(T.project);
  }
  return finding.subjects.map((subject) => labelSubject(subject, labels, t)).join(t(separator));
}

/** Returns the localized expectation phrase. */
function expectationOf(finding: GantteeFinding, t: Translate): string {
  const expectation = finding.args?.expectation;
  return t(expectation === undefined ? T.expectValid : EXPECTATION_TEMPLATES[expectation]);
}

/** Describes a field-level finding (`invalidField`, `invalidInput`, `unsupportedField`). */
function describeField(
  template: string,
  finding: GantteeFinding,
  labels: LabelSnapshot,
  t: Translate,
): string {
  return t(
    template,
    primaryLabel(finding, labels, t),
    finding.args?.field ?? "",
    expectationOf(finding, t),
  );
}

/** Describes a sequence mismatch by its problem kind. */
function describeSequence(finding: GantteeFinding, labels: LabelSnapshot, t: Translate): string {
  const owner = primaryLabel(finding, labels, t);
  switch (finding.args?.sequenceProblem) {
    case "duplicate":
      return t(T.sequenceDuplicate, owner);
    case "missing":
      return t(T.sequenceMissing, owner);
    default:
      return t(T.sequenceNotDirectChild, owner);
  }
}

/** Describes an over-constrained finding, naming duplicated endpoints when present. */
function describeOverConstrained(
  finding: GantteeFinding,
  labels: LabelSnapshot,
  t: Translate,
): string {
  const endpoints = finding.args?.duplicateEndpoints ?? [];
  if (endpoints.length > 0) {
    const names = endpoints.map((endpoint) =>
      t(endpoint === "start" ? T.endpointStart : T.endpointEnd),
    );
    return t(T.duplicateConstraint, primaryLabel(finding, labels, t), names.join(t(T.endpointAnd)));
  }
  return t(T.overConstrained, primaryLabel(finding, labels, t), finding.args?.count ?? 0);
}

/** Describes a scheduling failure by its structured reason. */
function describeSchedulingFailure(
  finding: GantteeFinding,
  labels: LabelSnapshot,
  t: Translate,
): string {
  const reason = finding.args?.reason;
  const detail =
    reason === undefined
      ? t(T.reasonUnexpected)
      : t(REASON_TEMPLATES[reason], primaryLabel(finding, labels, t));
  return t(T.schedulingFailed, detail);
}

/** Describes an invalid JSON finding, with its position when known. */
function describeInvalidJson(finding: GantteeFinding, t: Translate): string {
  const line = finding.args?.line;
  const column = finding.args?.column;
  return line !== undefined && column !== undefined
    ? t(T.invalidJsonAt, line, column)
    : t(T.invalidJson);
}

/**
 * Renders one finding as a localized, label-safe sentence.
 *
 * @param finding The finding to describe.
 * @param labels The label context of the finding's origin.
 * @param t Translator for the current display language.
 * @returns The localized message, without an origin descriptor.
 */
export function describeFinding(
  finding: GantteeFinding,
  labels: LabelSnapshot,
  t: Translate,
): string {
  const subject = (): string => primaryLabel(finding, labels, t);
  switch (finding.category) {
    case "invalidJson":
      return describeInvalidJson(finding, t);
    case "invalidRoot":
      return t(T.invalidRoot);
    case "invalidField":
      return describeField(T.invalidField, finding, labels, t);
    case "unsupportedField":
      return describeField(T.unsupportedField, finding, labels, t);
    case "invalidInput":
      return describeField(T.invalidInput, finding, labels, t);
    case "duplicateEntityId":
      return t(T.duplicateEntityId, subject());
    case "duplicateDependencyId":
      return t(T.duplicateDependencyId, subject());
    case "duplicateStatusId":
      return t(T.duplicateStatusId, subject());
    case "invalidTaskDateRange":
    case "invalidHolidayRange":
      return t(T.invalidDateRange, subject());
    case "groupSelfParent":
      return t(T.groupSelfParent, subject());
    case "unknownParentGroup":
      return t(T.unknownParentGroup, subject());
    case "groupParentCycle":
      return t(T.groupParentCycle, joinSubjects(finding, labels, t, T.cycleSeparator));
    case "unknownItemGroup":
      return t(T.unknownItemGroup, subject());
    case "sequenceMismatch":
      return describeSequence(finding, labels, t);
    case "unknownStatus":
      return t(T.unknownStatus, subject());
    case "invalidViewValue":
      return t(T.invalidViewValue, finding.args?.field ?? "", finding.args?.defaultValue ?? "");
    case "selfLoopDependency":
      return t(T.selfLoopDependency, subject());
    case "parallelDependency":
      return t(T.parallelDependency, subject());
    case "dependencyCycle":
      return t(T.dependencyCycle, joinSubjects(finding, labels, t, T.cycleSeparator));
    case "underConstrained":
      return t(T.underConstrained, subject(), finding.args?.count ?? 0);
    case "overConstrained":
      return describeOverConstrained(finding, labels, t);
    case "danglingDependency":
      return t(T.danglingDependency, subject());
    case "groupDependency":
      return t(T.groupDependency, subject());
    case "unanchoredComponent":
      return t(T.unanchoredComponent, joinSubjects(finding, labels, t, T.listSeparator));
    case "invalidWorkingCalendar":
      return t(T.invalidWorkingCalendar);
    case "schedulingFailed":
      return describeSchedulingFailure(finding, labels, t);
    case "cleanupRemoved":
      return t(T.cleanupRemoved, joinSubjects(finding, labels, t, T.listSeparator));
    case "cleanupFailed":
      return t(T.cleanupFailed);
    case "invalidDuration":
      return t(T.invalidDuration, subject());
    case "blankStatusName":
      return t(T.blankStatusName);
    case "exportFailed":
      return t(T.exportFailed);
    case "dependencyCycleRejected":
      return t(T.dependencyCycleRejected, subject());
    case "sortUnavailable":
      return t(T.sortUnavailable);
    case "unknownItem":
      return t(T.unknownItem, subject());
    case "editRejected":
      return t(T.editRejected, subject());
  }
}

/**
 * Renders a finding with its origin descriptor so draft, rejected-edit, and
 * operational findings are never mistaken for document source problems.
 *
 * @param finding The finding to describe.
 * @param labels The label context of the finding's origin.
 * @param t Translator for the current display language.
 * @returns The localized message.
 */
export function describeFindingWithOrigin(
  finding: GantteeFinding,
  labels: LabelSnapshot,
  t: Translate,
): string {
  const message = describeFinding(finding, labels, t);
  const template = ORIGIN_TEMPLATES[finding.origin];
  return template === undefined ? message : t(template, message);
}

/**
 * Renders the message of one related location.
 *
 * @param related The related location.
 * @param labels The label context of the finding's origin.
 * @param t Translator for the current display language.
 * @returns The localized related-information message.
 */
export function describeRelated(
  related: RelatedFindingLocation,
  labels: LabelSnapshot,
  t: Translate,
): string {
  return t(T.relatedSubject, labelSubject(related.subject, labels, t));
}
