import { CURRENT_DOCUMENT_VERSION, DependencyType } from "../common/models";

const LEGACY_DOCUMENT_VERSION = 1;

/**
 * Migrates raw parsed JSON into the latest schema shape before validation.
 *
 * Runs an always-on, idempotent field-rename pass (independent of the document
 * version) followed by the versioned v1 → current migration.
 */
export function migrateDocument(raw: unknown): unknown {
  if (!isRecord(raw)) {
    return raw;
  }

  return migrateVersion(hoistSettings(renameLegacyFields(raw)));
}

/**
 * Normalizes legacy field names on entity collections: `title` → `name` on
 * tasks and milestones, and `parentId` → `groupId` on groups.
 *
 * The pass is idempotent and runs regardless of document version. When both the
 * legacy and new keys are present the new value wins and the legacy key is
 * dropped, so documents self-heal on the next save without a version bump.
 */
function renameLegacyFields(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...raw };
  if (Array.isArray(result.tasks)) {
    result.tasks = result.tasks.map((entry) =>
      renameKey(entry, "title", "name"),
    );
  }
  if (Array.isArray(result.milestones)) {
    result.milestones = result.milestones.map((entry) =>
      renameKey(entry, "title", "name"),
    );
  }
  if (Array.isArray(result.groups)) {
    result.groups = result.groups.map((entry) =>
      renameKey(entry, "parentId", "groupId"),
    );
  }
  return result;
}

/**
 * Nests the reserved top-level scheduling fields (`workingCalendar` and
 * `workingDayHours`) under a single `settings` object.
 *
 * The pass is idempotent and runs regardless of document version. When a value
 * already exists on `settings` it wins over the legacy top-level key, and the
 * top-level keys are always dropped, so documents self-heal on the next save
 * without a version bump.
 */
function hoistSettings(raw: Record<string, unknown>): Record<string, unknown> {
  const hasLegacyCalendar = "workingCalendar" in raw;
  const hasLegacyHours = "workingDayHours" in raw;
  if (!hasLegacyCalendar && !hasLegacyHours) {
    return raw;
  }

  const {
    workingCalendar: legacyCalendar,
    workingDayHours: legacyHours,
    ...rest
  } = raw;
  const existing = isRecord(rest.settings) ? rest.settings : {};
  const settings: Record<string, unknown> = { ...existing };
  if (hasLegacyCalendar && !("workingCalendar" in settings)) {
    settings.workingCalendar = legacyCalendar;
  }
  if (hasLegacyHours && !("workingDayHours" in settings)) {
    settings.workingDayHours = legacyHours;
  }
  return { ...rest, settings };
}

/**
 * Applies the versioned v1 → current migration (dependency direction/type swap).
 */
function migrateVersion(raw: Record<string, unknown>): unknown {
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
 * Renames a legacy key to a new key on a record, preferring the new key's value
 * when both are present and dropping the legacy key.
 */
function renameKey(entry: unknown, legacyKey: string, newKey: string): unknown {
  if (!isRecord(entry) || !(legacyKey in entry)) {
    return entry;
  }

  const { [legacyKey]: legacyValue, ...rest } = entry;
  return newKey in entry ? rest : { ...rest, [newKey]: legacyValue };
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
 * Returns `undefined` for unsupported types, making them invalid at validation.
 */
function migrateDependencyType(type: unknown): DependencyType | undefined {
  switch (type) {
    case "startAfter":
    case "startWith":
      return type;
    case "finishWith":
      return "endWith";
    case "finishAfter":
      // endBefore is no longer supported; return undefined to make it invalid
      return undefined;
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
