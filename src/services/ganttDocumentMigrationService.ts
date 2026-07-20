import { CURRENT_DOCUMENT_VERSION, DependencyType } from "../common/models";

const LEGACY_DOCUMENT_VERSION = 1;

/**
 * Migrates raw parsed JSON into the latest schema shape before validation.
 */
export function migrateDocument(raw: unknown): unknown {
  if (!isRecord(raw)) {
    return raw;
  }

  const version = raw.version;
  if (version !== LEGACY_DOCUMENT_VERSION) {
    return raw;
  }

  const dependencies = Array.isArray(raw.dependencies)
    ? raw.dependencies.map(migrateDependency)
    : raw.dependencies;

  return {
    ...raw,
    version: CURRENT_DOCUMENT_VERSION,
    dependencies,
  };
}

/**
 * Migrates a single v1 dependency to the current shape.
 */
function migrateDependency(raw: unknown): unknown {
  if (!isRecord(raw)) {
    return raw;
  }

  const migratedType = migrateDependencyType(raw.type);
  if (!migratedType) {
    return raw;
  }

  return {
    ...raw,
    sourceId: raw.targetId,
    targetId: raw.sourceId,
    type: migratedType,
  };
}

/**
 * Maps a persisted v1 dependency type string to the current vocabulary.
 */
function migrateDependencyType(type: unknown): DependencyType | undefined {
  switch (type) {
    case "startAfter":
    case "startWith":
      return type;
    case "finishWith":
      return "endWith";
    case "finishAfter":
      return "endBefore";
    default:
      return undefined;
  }
}

/**
 * Returns whether the input is a plain object record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
