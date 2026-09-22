/** Whether a diagnostic prevents persistence or only warrants a warning. */
export type ScheduleDiagnosticSeverity = "blocking" | "warning";

/** A schedulable endpoint that a diagnostic refers to. */
export type ScheduleEndpoint = "start" | "end";

/** A semantic problem found in a project schedule. */
export type ScheduleDiagnostic =
  | {
      kind: "underConstrained";
      severity: "blocking";
      entityIds: readonly string[];
      count: number;
    }
  | {
      kind: "overConstrained";
      severity: ScheduleDiagnosticSeverity;
      entityIds: readonly string[];
      count: number;
      duplicateEndpoints: readonly ScheduleEndpoint[];
    }
  | {
      kind: "danglingDependency";
      severity: "blocking";
      entityIds: readonly string[];
      dependencyId: string;
    }
  | {
      kind: "groupDependency";
      severity: "blocking";
      entityIds: readonly string[];
      dependencyId: string;
    }
  | {
      kind: "unanchoredComponent";
      severity: "blocking";
      entityIds: readonly string[];
    };
