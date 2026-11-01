/**
 * Cross-entity rules a document must satisfy once every field has been coerced.
 *
 * These need the whole document, so they run after
 * `documentShapeValidationService` has produced the typed shape. Every rule
 * reports structured findings; the throwing entry point raises the first
 * error, while the collecting entry point returns all of them.
 */

import { ProjectDocument } from "@common/documents";
import {
  GantteeFinding,
  GantteeFindingCategory,
  GantteeFindingSeverity,
  ParallelEdgeDependencyError,
  RelatedFindingLocation,
  SelfLoopDependencyError,
  SourcePath,
  SubjectRef,
} from "@common/models";
import { createSchedulableGraph } from "@services/dependency-graph/dependencyGraphService";
import {
  AuthoredIndexMap,
  GanttParseError,
  ShapeArea,
  ShapeCollectionName,
} from "@services/document/documentShapeValidationService";

/** Options for collecting relation findings after collecting shape validation. */
export interface RelationCollectionOptions {
  /** Authored index of each kept record; identity when absent. */
  readonly authoredIndex?: AuthoredIndexMap;
  /** Areas from which shape validation dropped values. */
  readonly incomplete?: ReadonlySet<ShapeArea>;
}

/** When an issue applies: in both modes, only when throwing, or only when collecting. */
type IssueMode = "both" | "assertOnly" | "collectOnly";

/** One relation problem with its English log message. */
interface RelationIssue {
  /** English log message used by the throwing mode. */
  readonly message: string;
  /** Structured finding. */
  readonly finding: GantteeFinding;
  /** Which mode reports the issue. */
  readonly mode: IssueMode;
  /** Issues with the same key are reported once when collecting. */
  readonly key?: string;
}

/** Entity collections that hold items. */
type EntityCollection = "tasks" | "groups" | "milestones";

/** A subject together with its authored record path. */
interface RecordRef {
  /** The subject. */
  readonly subject: SubjectRef;
  /** Path of the authored record. */
  readonly path: SourcePath;
}

const ENTITY_KINDS = { tasks: "task", groups: "group", milestones: "milestone" } as const;

const EDGE_CATEGORIES: ReadonlySet<GantteeFindingCategory> = new Set([
  "duplicateDependencyId",
  "selfLoopDependency",
  "parallelDependency",
]);

/**
 * Asserts every cross-entity rule: unique ids, ordered task dates, a sound
 * group hierarchy, resolvable group references, and well-formed edges.
 * Unknown status references are cleared.
 *
 * @param projectDoc The document to check.
 * @throws {GanttParseError} When a rule is broken.
 */
export function assertDocumentRelations(projectDoc: ProjectDocument): void {
  const first = new RelationCollector(projectDoc, {})
    .collect()
    .find((issue) => issue.mode !== "collectOnly" && issue.finding.severity === "error");
  if (first !== undefined) {
    throw new GanttParseError(first.message, [first.finding]);
  }
}

/**
 * Collects every cross-entity problem as a finding. Unknown status references
 * are cleared, as in the throwing mode. Checks whose prerequisites were
 * dropped by shape validation are skipped so they cannot report false
 * problems.
 *
 * @param projectDoc The document to check.
 * @param options Authored indices and dropped areas from shape validation.
 * @returns The findings, in rule order.
 */
export function collectDocumentRelations(
  projectDoc: ProjectDocument,
  options: RelationCollectionOptions = {},
): readonly GantteeFinding[] {
  const seenKeys = new Set<string>();
  const findings: GantteeFinding[] = [];
  for (const issue of new RelationCollector(projectDoc, options).collect()) {
    if (issue.mode === "assertOnly") {
      continue;
    }
    if (issue.key !== undefined) {
      if (seenKeys.has(issue.key)) {
        continue;
      }
      seenKeys.add(issue.key);
    }
    findings.push(issue.finding);
  }
  return findings;
}

/** Runs every relation rule over one document. */
class RelationCollector {
  /** Issues found so far, in rule order. */
  private readonly issues: RelationIssue[] = [];
  /** Areas from which shape validation dropped values. */
  private readonly incomplete: ReadonlySet<ShapeArea>;

  /**
   * @param projectDoc The document to check.
   * @param options Authored indices and dropped areas.
   */
  constructor(
    private readonly projectDoc: ProjectDocument,
    private readonly options: RelationCollectionOptions,
  ) {
    this.incomplete = options.incomplete ?? new Set();
  }

  /** Runs every rule in the order the throwing mode reports them. */
  collect(): readonly RelationIssue[] {
    this.uniqueEntityIds();
    this.uniqueDependencyIds();
    this.taskDateOrder();
    this.groupHierarchy();
    this.groupReferences();
    if (!this.hasError()) {
      this.sequenceIntegrity();
    }
    this.uniqueStatusIds();
    this.statusReferences();
    this.graphIntegrity();
    return this.issues;
  }

  /** Returns the authored index of a kept record. */
  private authored(name: ShapeCollectionName, index: number): number {
    return this.options.authoredIndex?.[name][index] ?? index;
  }

  /** Returns the subject and record path of an entity. */
  private entity(name: EntityCollection, index: number): RecordRef {
    const authored = this.authored(name, index);
    const id = this.projectDoc[name][index].id;
    return { subject: { kind: ENTITY_KINDS[name], id, index: authored }, path: [name, authored] };
  }

  /** Returns the subject and record path of a dependency. */
  private dependency(index: number): RecordRef {
    const authored = this.authored("dependencies", index);
    return {
      subject: { kind: "dependency", id: this.projectDoc.dependencies[index].id, index: authored },
      path: ["dependencies", authored],
    };
  }

  /** Records an issue. */
  private push(
    message: string,
    category: GantteeFindingCategory,
    subjects: readonly SubjectRef[],
    path: SourcePath,
    extras: {
      severity?: GantteeFindingSeverity;
      args?: GantteeFinding["args"];
      related?: readonly RelatedFindingLocation[];
      mode?: IssueMode;
      key?: string;
    } = {},
  ): void {
    this.issues.push({
      message,
      mode: extras.mode ?? "both",
      key: extras.key,
      finding: {
        category,
        severity: extras.severity ?? "error",
        origin: "document",
        subjects,
        args: extras.args,
        location: { path },
        related: extras.related,
      },
    });
  }

  /** Returns whether an error matching the filter was recorded. */
  private hasError(categories?: ReadonlySet<GantteeFindingCategory>): boolean {
    return this.issues.some(
      (issue) =>
        issue.finding.severity === "error" &&
        (categories === undefined || categories.has(issue.finding.category)),
    );
  }

  /** Every entity across tasks, groups, then milestones. */
  private entities(): RecordRef[] {
    return (["tasks", "groups", "milestones"] as const).flatMap((name) =>
      this.projectDoc[name].map((_, index) => this.entity(name, index)),
    );
  }

  /** Reports entity ids reused across tasks, groups, and milestones. */
  private uniqueEntityIds(): void {
    const seen = new Map<string, RecordRef>();
    for (const ref of this.entities()) {
      const id = ref.subject.id ?? "";
      const first = seen.get(id);
      if (first === undefined) {
        seen.set(id, ref);
        continue;
      }
      this.push(
        `Entity id "${id}" must be unique across tasks, groups, and milestones.`,
        "duplicateEntityId",
        [ref.subject],
        [...ref.path, "id"],
        { related: [{ subject: first.subject, location: { path: [...first.path, "id"] } }] },
      );
    }
  }

  /** Reports reused dependency ids. */
  private uniqueDependencyIds(): void {
    const seen = new Map<string, RecordRef>();
    this.projectDoc.dependencies.forEach((dependency, index) => {
      const ref = this.dependency(index);
      const first = seen.get(dependency.id);
      if (first === undefined) {
        seen.set(dependency.id, ref);
        return;
      }
      this.push(
        `Dependency id "${dependency.id}" must be unique.`,
        "duplicateDependencyId",
        [ref.subject],
        [...ref.path, "id"],
        { related: [{ subject: first.subject, location: { path: [...first.path, "id"] } }] },
      );
    });
  }

  /** Reports tasks whose start follows their end. */
  private taskDateOrder(): void {
    this.projectDoc.tasks.forEach((task, index) => {
      if (task.start !== undefined && task.end !== undefined && task.start > task.end) {
        const ref = this.entity("tasks", index);
        this.push(
          `tasks[${ref.path[1]}] has an invalid date range: start must be on or before end.`,
          "invalidTaskDateRange",
          [ref.subject],
          [...ref.path, "end"],
        );
      }
    });
  }

  /** Reports group self-parent, missing parent, and ancestor-cycle problems. */
  private groupHierarchy(): void {
    const groups = this.projectDoc.groups;
    const groupById = new Map(groups.map((group) => [group.id, group]));
    const indexById = new Map<string, number>();
    groups.forEach((group, index) => {
      if (!indexById.has(group.id)) {
        indexById.set(group.id, index);
      }
    });
    groups.forEach((group, index) => {
      if (group.groupId === undefined) {
        return;
      }
      const ref = this.entity("groups", index);
      const label = `groups[${ref.path[1]}]`;
      const path = [...ref.path, "groupId"];
      if (group.groupId === group.id) {
        this.push(
          `${label} cannot reference itself as parent group.`,
          "groupSelfParent",
          [ref.subject],
          path,
        );
        return;
      }
      if (!groupById.has(group.groupId)) {
        if (!this.incomplete.has("groups")) {
          this.push(
            `${label}.groupId references an unknown group id.`,
            "unknownParentGroup",
            [ref.subject],
            path,
          );
        }
        return;
      }
      const visited: string[] = [group.id];
      let cursor: string | undefined = group.groupId;
      while (cursor !== undefined) {
        const repeat = visited.indexOf(cursor);
        if (repeat >= 0) {
          const members = visited.slice(repeat);
          this.push(
            `${label} creates a parent cycle in group hierarchy.`,
            "groupParentCycle",
            members.map((id) => this.entity("groups", indexById.get(id) ?? 0).subject),
            path,
            {
              mode: members.length === 1 ? "assertOnly" : "both",
              key: `groupCycle:${[...members].sort().join("\u0000")}`,
            },
          );
          return;
        }
        visited.push(cursor);
        cursor = groupById.get(cursor)?.groupId;
      }
    });
  }

  /** Reports tasks and milestones that reference a missing group. */
  private groupReferences(): void {
    if (this.incomplete.has("groups")) {
      return;
    }
    const groupIds = new Set(this.projectDoc.groups.map((group) => group.id));
    for (const name of ["tasks", "milestones"] as const) {
      this.projectDoc[name].forEach((item, index) => {
        if (item.groupId !== undefined && !groupIds.has(item.groupId)) {
          const ref = this.entity(name, index);
          this.push(
            `${name}[${ref.path[1]}].groupId references an unknown group id.`,
            "unknownItemGroup",
            [ref.subject],
            [...ref.path, "groupId"],
          );
        }
      });
    }
  }

  /**
   * Reports owner sequences that do not contain exactly their direct
   * children, each once. Sequence repair normally guarantees this; this is
   * the defensive backstop. Skipped when items or sequences were dropped.
   */
  private sequenceIntegrity(): void {
    if (
      (["tasks", "groups", "milestones", "sequence"] as const).some((a) => this.incomplete.has(a))
    ) {
      return;
    }
    this.ownerSequence(
      this.projectDoc.sequence ?? [],
      this.directChildrenOf(undefined),
      "sequence",
      { kind: "project" },
      ["sequence"],
    );
    this.projectDoc.groups.forEach((group, index) => {
      const ref = this.entity("groups", index);
      this.ownerSequence(
        group.sequence ?? [],
        this.directChildrenOf(group.id),
        `groups["${group.id}"].sequence`,
        ref.subject,
        [...ref.path, "sequence"],
      );
    });
  }

  /** Direct child ids of one owner scope across all three item kinds. */
  private directChildrenOf(ownerId: string | undefined): Set<string> {
    const owned = (entities: readonly { id: string; groupId?: string }[]): string[] =>
      entities.filter((entity) => entity.groupId === ownerId).map((entity) => entity.id);
    return new Set([
      ...owned(this.projectDoc.groups),
      ...owned(this.projectDoc.tasks),
      ...owned(this.projectDoc.milestones),
    ]);
  }

  /** Reports the first problem of one owner's sequence. */
  private ownerSequence(
    sequence: readonly string[],
    directChildren: ReadonlySet<string>,
    label: string,
    owner: SubjectRef,
    path: SourcePath,
  ): void {
    const report = (problem: "notDirectChild" | "duplicate" | "missing", text: string): void =>
      this.push(`${label} ${text}`, "sequenceMismatch", [owner], path, {
        args: { sequenceProblem: problem },
      });
    const seen = new Set<string>();
    for (const id of sequence) {
      if (!directChildren.has(id)) {
        report("notDirectChild", "contains an id that is not a direct child.");
        return;
      }
      if (seen.has(id)) {
        report("duplicate", "contains a duplicate id.");
        return;
      }
      seen.add(id);
    }
    if (seen.size !== directChildren.size) {
      report("missing", "is missing a direct child id.");
    }
  }

  /** Reports reused status ids. */
  private uniqueStatusIds(): void {
    const seen = new Map<string, RecordRef>();
    this.projectDoc.settings.statuses.forEach((status, index) => {
      const authored = this.authored("statuses", index);
      const ref: RecordRef = {
        subject: { kind: "status", id: status.id, index: authored },
        path: ["settings", "statuses", authored],
      };
      const first = seen.get(status.id);
      if (first === undefined) {
        seen.set(status.id, ref);
        return;
      }
      this.push(
        `Status id "${status.id}" must be unique.`,
        "duplicateStatusId",
        [ref.subject],
        [...ref.path, "id"],
        { related: [{ subject: first.subject, location: { path: [...first.path, "id"] } }] },
      );
    });
  }

  /**
   * Clears status references to unknown statuses and reports each as a
   * warning. Skipped when statuses were dropped, since the reference may be
   * to a dropped status.
   */
  private statusReferences(): void {
    if (this.incomplete.has("statuses")) {
      return;
    }
    const statusIds = new Set(this.projectDoc.settings.statuses.map((status) => status.id));
    for (const name of ["tasks", "groups", "milestones"] as const) {
      this.projectDoc[name].forEach((item, index) => {
        if (item.status !== undefined && !statusIds.has(item.status)) {
          const ref = this.entity(name, index);
          this.push(
            `${name}[${ref.path[1]}].status references an unknown status id and will be ignored.`,
            "unknownStatus",
            [ref.subject],
            [...ref.path, "status"],
            { severity: "warning" },
          );
          item.status = undefined;
        }
      });
    }
  }

  /**
   * Reports self-loops and parallel edges, then (collecting only) the first
   * dependency cycle when the edge set is well formed.
   */
  private graphIntegrity(): void {
    const seenPairs = new Map<string, RecordRef>();
    this.projectDoc.dependencies.forEach((dependency, index) => {
      const ref = this.dependency(index);
      if (dependency.sourceId === dependency.targetId) {
        this.push(
          new SelfLoopDependencyError(dependency.id).message,
          "selfLoopDependency",
          [ref.subject],
          ref.path,
        );
        return;
      }
      const pair = `${dependency.sourceId}\u0000${dependency.targetId}`;
      const first = seenPairs.get(pair);
      if (first === undefined) {
        seenPairs.set(pair, ref);
        return;
      }
      this.push(
        new ParallelEdgeDependencyError(dependency.sourceId, dependency.targetId).message,
        "parallelDependency",
        [ref.subject],
        ref.path,
        { related: [{ subject: first.subject, location: { path: first.path } }] },
      );
    });
    if (!this.hasError(EDGE_CATEGORIES)) {
      this.dependencyCycle();
    }
  }

  /** Reports the first dependency cycle, if any, with every participating edge. */
  private dependencyCycle(): void {
    const cycle = createSchedulableGraph(this.projectDoc).findCycle();
    if (cycle.length === 0) {
      return;
    }
    const items = new Map<string, SubjectRef>();
    for (const name of ["tasks", "milestones"] as const) {
      this.projectDoc[name].forEach((item, index) => {
        if (!items.has(item.id)) {
          items.set(item.id, this.entity(name, index).subject);
        }
      });
    }
    const edges: RecordRef[] = [];
    for (let step = 0; step < cycle.length - 1; step += 1) {
      const index = this.projectDoc.dependencies.findIndex(
        (dependency) =>
          dependency.targetId === cycle[step] && dependency.sourceId === cycle[step + 1],
      );
      if (index >= 0) {
        edges.push(this.dependency(index));
      }
    }
    const [primary, ...others] = edges;
    this.push(
      `Dependency cycle detected: ${cycle.join(" → ")}.`,
      "dependencyCycle",
      cycle.slice(0, -1).map((id) => items.get(id) ?? { kind: "item", id }),
      primary?.path ?? ["dependencies"],
      {
        mode: "collectOnly",
        related: others.map((edge) => ({ subject: edge.subject, location: { path: edge.path } })),
      },
    );
  }
}
