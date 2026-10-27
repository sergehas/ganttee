/**
 * Reading and writing the on-disk `.ganttee` document.
 *
 * Parsing is a pipeline: migrate the raw payload, coerce it to the typed shape,
 * then assert the cross-entity rules. Each step lives in its own module; this
 * one only orders them.
 */

import { createEmptyDocument, ProjectDocument } from "@common/documents";
import { migrateDocument } from "@services/document/documentMigrationService";
import { assertDocumentRelations } from "@services/document/documentRelationValidationService";
import {
  GanttParseError,
  validateDocumentShape,
  ViewDefaultWarningListener,
} from "@services/document/documentShapeValidationService";

export {
  GanttParseError,
  type ViewDefaultWarning,
  type ViewDefaultWarningListener,
} from "@services/document/documentShapeValidationService";

/**
 * Parses raw file text into a validated document, applying schema migrations
 * for older versions. Empty input yields an empty document.
 *
 * @param text The file contents.
 * @param onWarning Receives each view value replaced by its default.
 * @returns The parsed document.
 * @throws {GanttParseError} When the text is not a valid document.
 */
export function parseDocument(
  text: string,
  onWarning?: ViewDefaultWarningListener,
): ProjectDocument {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return createEmptyDocument();
  }

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch (error) {
    throw new GanttParseError(`Invalid JSON in .ganttee file: ${(error as Error).message}`);
  }

  const projectDoc = validateDocumentShape(migrateDocument(raw), onWarning);
  assertDocumentRelations(projectDoc);
  return projectDoc;
}

/**
 * Serializes a document to pretty-printed JSON suitable for on-disk storage.
 *
 * @param projectDoc The document to write.
 */
export function serializeDocument(projectDoc: ProjectDocument): string {
  return `${JSON.stringify(projectDoc, undefined, 2)}\n`;
}
