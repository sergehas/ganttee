import { createEmptyDocument, ProjectDocument } from "@common/documents";
import { GantteeFinding } from "@common/models";
import {
  assertDocumentRelations,
  collectDocumentRelations,
} from "@services/document/documentRelationValidationService";
import { GanttParseError } from "@services/document/documentShapeValidationService";
import * as assert from "assert";

/** Returns a compact view of findings for assertions. */
function summary(findings: readonly GantteeFinding[]): string[] {
  return findings.map(
    (finding) =>
      `${finding.severity}:${finding.category}:${(finding.location?.path ?? []).join(".")}`,
  );
}

/** Builds a document from partial collections, with consistent sequences. */
function documentWith(parts: Partial<ProjectDocument>): ProjectDocument {
  const document = { ...createEmptyDocument(), ...parts };
  if (parts.sequence === undefined) {
    document.sequence = [...document.groups, ...document.tasks, ...document.milestones]
      .filter((entity) => entity.groupId === undefined)
      .map((entity) => entity.id);
  }
  return document;
}

suite("documentRelationValidationService collecting mode", () => {
  test("returns no findings for a valid document", () => {
    assert.deepStrictEqual(collectDocumentRelations(createEmptyDocument()), []);
  });

  test("collects several independent problems in rule order", () => {
    const document = documentWith({
      tasks: [
        { id: "a", name: "A", start: "2026-01-05", end: "2026-01-01" },
        { id: "a", name: "A2" },
        { id: "b", name: "B", groupId: "missing", status: "nope" },
      ],
      dependencies: [
        { id: "d", sourceId: "a", targetId: "b", type: "startAfter" },
        { id: "d", sourceId: "b", targetId: "b", type: "startAfter" },
      ],
    });
    assert.deepStrictEqual(summary(collectDocumentRelations(document)), [
      "error:duplicateEntityId:tasks.1.id",
      "error:duplicateDependencyId:dependencies.1.id",
      "error:invalidTaskDateRange:tasks.0.end",
      "error:unknownItemGroup:tasks.2.groupId",
      "warning:unknownStatus:tasks.2.status",
      "error:selfLoopDependency:dependencies.1",
    ]);
    assert.strictEqual(document.tasks[2].status, undefined);
  });

  test("points duplicates at the first occurrence as related information", () => {
    const document = documentWith({
      tasks: [{ id: "x", name: "T" }],
      milestones: [{ id: "x", name: "M" }],
    });
    const [finding] = collectDocumentRelations(document);
    assert.deepStrictEqual(finding.subjects, [{ kind: "milestone", id: "x", index: 0 }]);
    assert.deepStrictEqual(finding.related, [
      { subject: { kind: "task", id: "x", index: 0 }, location: { path: ["tasks", 0, "id"] } },
    ]);
  });

  test("maps kept positions back to authored indices", () => {
    const document = documentWith({ tasks: [{ id: "a", name: "A", groupId: "g" }] });
    const findings = collectDocumentRelations(document, {
      authoredIndex: {
        tasks: [3],
        groups: [],
        milestones: [],
        dependencies: [],
        statuses: [],
        holidays: [],
      },
    });
    assert.deepStrictEqual(summary(findings), ["error:unknownItemGroup:tasks.3.groupId"]);
  });

  test("reports group self-parent, unknown parent, and a deduplicated parent cycle", () => {
    const document = documentWith({
      groups: [
        { id: "self", name: "S", groupId: "self" },
        { id: "orphan", name: "O", groupId: "ghost" },
        { id: "p", name: "P", groupId: "q" },
        { id: "q", name: "Q", groupId: "p" },
      ],
    });
    const findings = collectDocumentRelations(document);
    assert.deepStrictEqual(summary(findings), [
      "error:groupSelfParent:groups.0.groupId",
      "error:unknownParentGroup:groups.1.groupId",
      "error:groupParentCycle:groups.2.groupId",
    ]);
    assert.deepStrictEqual(
      findings[2].subjects.map((subject) => subject.id),
      ["p", "q"],
    );
  });

  test("keeps a one-member parent cycle out of collected findings", () => {
    const document = documentWith({
      groups: [
        { id: "a", name: "A", groupId: "b" },
        { id: "b", name: "B", groupId: "b" },
      ],
    });
    assert.deepStrictEqual(summary(collectDocumentRelations(document)), [
      "error:groupSelfParent:groups.1.groupId",
    ]);
  });

  test("skips group and status reference checks when those collections are incomplete", () => {
    const document = documentWith({
      groups: [{ id: "g", name: "G", groupId: "dropped" }],
      milestones: [{ id: "m", name: "M", groupId: "dropped", status: "dropped" }],
    });
    const findings = collectDocumentRelations(document, {
      incomplete: new Set(["groups", "statuses"]),
    });
    assert.deepStrictEqual(findings, []);
    assert.strictEqual(document.milestones[0].status, "dropped");
  });

  test("reports the first sequence problem of each owner", () => {
    const document = documentWith({
      groups: [{ id: "g", name: "G", sequence: ["c", "c"] }],
      tasks: [
        { id: "a", name: "A" },
        { id: "c", name: "C", groupId: "g" },
      ],
      sequence: ["g", "ghost"],
    });
    const findings = collectDocumentRelations(document);
    assert.deepStrictEqual(summary(findings), [
      "error:sequenceMismatch:sequence",
      "error:sequenceMismatch:groups.0.sequence",
    ]);
    assert.deepStrictEqual(findings[0].args, { sequenceProblem: "notDirectChild" });
    assert.deepStrictEqual(findings[1].args, { sequenceProblem: "duplicate" });
    assert.deepStrictEqual(findings[1].subjects, [{ kind: "group", id: "g", index: 0 }]);
  });

  test("reports a missing sequence child", () => {
    const document = documentWith({ tasks: [{ id: "a", name: "A" }], sequence: [] });
    const findings = collectDocumentRelations(document);
    assert.deepStrictEqual(findings[0].args, { sequenceProblem: "missing" });
    assert.deepStrictEqual(findings[0].subjects, [{ kind: "project" }]);
  });

  test("skips sequence checks after another error or when items were dropped", () => {
    const afterError = documentWith({
      tasks: [
        { id: "a", name: "A" },
        { id: "a", name: "B" },
      ],
      sequence: [],
    });
    assert.deepStrictEqual(summary(collectDocumentRelations(afterError)), [
      "error:duplicateEntityId:tasks.1.id",
    ]);
    const dropped = documentWith({ tasks: [{ id: "a", name: "A" }], sequence: [] });
    assert.deepStrictEqual(
      collectDocumentRelations(dropped, { incomplete: new Set(["tasks"]) }),
      [],
    );
  });

  test("reports duplicate status ids", () => {
    const document = documentWith({});
    document.settings = {
      ...document.settings,
      statuses: [
        { id: "s", name: "S", color: "#000", state: "open" },
        { id: "s", name: "S2", color: "#fff", state: "closed" },
      ],
    };
    assert.deepStrictEqual(summary(collectDocumentRelations(document)), [
      "error:duplicateStatusId:settings.statuses.1.id",
    ]);
  });

  test("reports parallel dependencies with the first edge as related", () => {
    const document = documentWith({
      tasks: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
      dependencies: [
        { id: "d1", sourceId: "a", targetId: "b", type: "startAfter" },
        { id: "d2", sourceId: "a", targetId: "b", type: "endWith" },
      ],
    });
    const findings = collectDocumentRelations(document);
    assert.deepStrictEqual(summary(findings), ["error:parallelDependency:dependencies.1"]);
    assert.deepStrictEqual(findings[0].related?.[0].location.path, ["dependencies", 0]);
  });

  test("collects a dependency cycle with every edge but never throws it", () => {
    const document = documentWith({
      tasks: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
      milestones: [{ id: "m", name: "M" }],
      dependencies: [
        { id: "ab", sourceId: "a", targetId: "b", type: "startAfter" },
        { id: "bm", sourceId: "b", targetId: "m", type: "startAfter" },
        { id: "ma", sourceId: "m", targetId: "a", type: "startAfter" },
      ],
    });
    const findings = collectDocumentRelations(document);
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].category, "dependencyCycle");
    assert.deepStrictEqual([...findings[0].subjects.map((subject) => subject.id)].sort(), [
      "a",
      "b",
      "m",
    ]);
    assert.strictEqual((findings[0].related ?? []).length, 2);
    assert.doesNotThrow(() => assertDocumentRelations(document));
  });

  test("does not look for cycles when edges are malformed", () => {
    const document = documentWith({
      tasks: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
      dependencies: [
        { id: "ab", sourceId: "a", targetId: "b", type: "startAfter" },
        { id: "ba", sourceId: "b", targetId: "a", type: "startAfter" },
        { id: "aa", sourceId: "a", targetId: "a", type: "startAfter" },
      ],
    });
    assert.deepStrictEqual(summary(collectDocumentRelations(document)), [
      "error:selfLoopDependency:dependencies.2",
    ]);
  });

  test("throwing mode attaches the finding of the first error", () => {
    const document = documentWith({
      tasks: [{ id: "a", name: "A", status: "ghost", groupId: "none" }],
    });
    try {
      assertDocumentRelations(document);
      assert.fail("expected a parse error");
    } catch (error) {
      assert.ok(error instanceof GanttParseError);
      assert.deepStrictEqual(summary(error.findings), ["error:unknownItemGroup:tasks.0.groupId"]);
    }
  });
});
