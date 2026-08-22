/**
 * Reading and writing the on-disk `.ganttee` document.
 *
 * Parsing is a pipeline: migrate the raw payload, coerce it to the typed shape,
 * then assert the cross-entity rules. Each step lives in its own module; this
 * one only orders them.
 */

import { createEmptyDocument, GanttDocument } from "../common/models";
import { assertDocumentRelations } from "./documentRelationValidationService";
import {
  GanttParseError,
  validateDocumentShape,
} from "./documentShapeValidationService";
import { migrateDocument } from "./ganttDocumentMigrationService";

export { GanttParseError } from "./documentShapeValidationService";

/**
 * Parses raw file text into a validated document, applying schema migrations
 * for older versions. Empty input yields an empty document.
 *
 * @param text The file contents.
 * @returns The parsed document.
 * @throws {GanttParseError} When the text is not a valid document.
 */
export function parseDocument(text: string): GanttDocument {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return createEmptyDocument();
  }

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch (error) {
    throw new GanttParseError(
      `Invalid JSON in .ganttee file: ${(error as Error).message}`,
    );
  }

  const document = validateDocumentShape(migrateDocument(raw));
  assertDocumentRelations(document);
  return document;
}

/**
 * Serializes a document to pretty-printed JSON suitable for on-disk storage.
 *
 * @param document The document to write.
 */
export function serializeDocument(document: GanttDocument): string {
  return `${JSON.stringify(document, undefined, 2)}\n`;
}
