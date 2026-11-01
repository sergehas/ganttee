/**
 * Pure helpers behind the Problems code link that opens an item's edit form.
 *
 * The link target is a `command:` URI. VS Code decodes a command URI query more
 * than once on its way to the command, which corrupts percent-escaped document
 * URIs. The argument is therefore carried as a hexadecimal string that no URI
 * decoding step can change.
 */

import { GantteeFinding, LabelSnapshot } from "@common/models";
import { EditableEntityRef } from "@common/protocol";

/** Hidden command opening the edit form of a finding's primary item. */
export const OPEN_PROBLEM_ITEM_COMMAND = "ganttee.openProblemItem";

/** Navigation target of one diagnostic code link. */
export interface ProblemItemTarget {
  /** The document URI string. */
  readonly uri: string;
  /** The item to edit. */
  readonly entity: EditableEntityRef;
}

/** Upper bound of an encoded argument, so untrusted input stays cheap to decode. */
const MAX_ENCODED_LENGTH = 16_384;

/**
 * Returns the editable item a finding is primarily about, when that item exists
 * in the given labels. Statuses, dependencies, holidays, and project-level
 * findings have no item form.
 *
 * @param finding The finding.
 * @param labels Labels of the current document revision.
 * @returns The item reference, or `undefined` when there is no editable item.
 */
export function problemItemRef(
  finding: GantteeFinding,
  labels: LabelSnapshot,
): EditableEntityRef | undefined {
  const subject = finding.subjects[0];
  if (subject?.id === undefined) {
    return undefined;
  }
  for (const item of labels.items) {
    if (
      item.id === subject.id &&
      item.kind !== "status" &&
      (subject.kind === "item" || item.kind === subject.kind)
    ) {
      return { kind: item.kind, id: item.id };
    }
  }
  return undefined;
}

/**
 * Returns whether an item exists in the given labels.
 *
 * @param labels Labels of the current document revision.
 * @param entity The item reference.
 */
export function hasProblemItem(labels: LabelSnapshot, entity: EditableEntityRef): boolean {
  return labels.items.some((item) => item.kind === entity.kind && item.id === entity.id);
}

/**
 * Encodes a navigation target as a URI-safe command argument.
 *
 * @param target The navigation target.
 * @returns A lowercase hexadecimal string of UTF-16 code units.
 */
export function encodeProblemItemArgument(target: ProblemItemTarget): string {
  const json = JSON.stringify({ uri: target.uri, kind: target.entity.kind, id: target.entity.id });
  let hex = "";
  for (let index = 0; index < json.length; index++) {
    hex += json.charCodeAt(index).toString(16).padStart(4, "0");
  }
  return hex;
}

/**
 * Decodes and validates an untrusted command argument.
 *
 * @param value The received argument.
 * @returns The navigation target, or `undefined` when the argument is malformed.
 */
export function decodeProblemItemArgument(value: unknown): ProblemItemTarget | undefined {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_ENCODED_LENGTH ||
    value.length % 4 !== 0 ||
    !/^[0-9a-f]+$/.test(value)
  ) {
    return undefined;
  }
  let json = "";
  for (let index = 0; index < value.length; index += 4) {
    json += String.fromCharCode(parseInt(value.slice(index, index + 4), 16));
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return undefined;
  }
  const { uri, kind, id } = parsed as Record<string, unknown>;
  if (
    typeof uri !== "string" ||
    uri.length === 0 ||
    typeof id !== "string" ||
    id.length === 0 ||
    (kind !== "task" && kind !== "milestone" && kind !== "group")
  ) {
    return undefined;
  }
  return { uri, entity: { kind, id } };
}
