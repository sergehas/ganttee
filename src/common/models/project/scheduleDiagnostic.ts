/** Whether a diagnostic prevents persistence or only warrants a warning. */
export type ScheduleDiagnosticSeverity = "blocking" | "warning";

/** A schedulable endpoint that a diagnostic refers to. */
export type ScheduleEndpoint = "start" | "end";

/** A semantic problem found in a project schedule. */
export type ScheduleDiagnostic =
  | {
      kind: "underConstrained";
      severity: "blocking";
      entityId: string;
      count: number;
    }
  | {
      kind: "overConstrained";
      severity: ScheduleDiagnosticSeverity;
      entityId: string;
      count: number;
      duplicateEndpoints: readonly ScheduleEndpoint[];
    }
  | {
      kind: "danglingDependency";
      severity: "blocking";
      dependencyId: string;
      sourceId: string;
      targetId: string;
    }
  | {
      kind: "groupDependency";
      severity: "blocking";
      dependencyId: string;
      sourceId: string;
      targetId: string;
    }
  | {
      kind: "unanchoredComponent";
      severity: "blocking";
      entityIds: readonly string[];
    }
  | {
      kind: "invalidWorkingCalendar";
      severity: "blocking";
    };

/** The diagnostic kinds a determinacy verdict can produce. */
export type DeterminacyDiagnostic = Extract<
  ScheduleDiagnostic,
  { kind: "underConstrained" } | { kind: "overConstrained" }
>;

/**
 * Normalizes any diagnostic's affected entities to a flat, order-agnostic
 * list, for generic id-membership checks (filtering, summarizing) that don't
 * need to know how each kind stores its subject(s).
 *
 * @param diagnostic The diagnostic to inspect.
 * @returns Every entity id the diagnostic concerns; possibly empty.
 */
export function scheduleDiagnosticEntityIds(diagnostic: ScheduleDiagnostic): readonly string[] {
  switch (diagnostic.kind) {
    case "underConstrained":
    case "overConstrained":
      return [diagnostic.entityId];
    case "danglingDependency":
    case "groupDependency":
      return [diagnostic.sourceId, diagnostic.targetId];
    case "unanchoredComponent":
      return diagnostic.entityIds;
    case "invalidWorkingCalendar":
      return [];
  }
}
