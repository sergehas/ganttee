import { createEmptyDocument, ProjectContent } from "@common/documents";
import {
  draftLabelSnapshot,
  entityDraftFindings,
  exportFailedFinding,
  settingsDraftFindings,
} from "@services/diagnostics/draftFindings";
import * as assert from "assert";

/** Builds a document with one task, one milestone, and one group. */
function documentWithItems(): ProjectContent {
  return {
    ...createEmptyDocument(),
    tasks: [{ id: "t-sentinel", name: "Design" }],
    milestones: [{ id: "m-sentinel", name: "Launch", date: "2025-01-10" }],
    groups: [{ id: "g-sentinel", name: "Phase" }],
  };
}

suite("draftFindings", () => {
  suite("entityDraftFindings", () => {
    test("returns no findings for a determinate task", () => {
      const findings = entityDraftFindings(
        "task",
        { id: "t", name: "Task", start: "2025-01-01", end: "2025-01-03" },
        [],
      );
      assert.deepStrictEqual(findings, []);
    });

    test("reports a blank name, reversed dates, and invalid duration as draft errors", () => {
      const findings = entityDraftFindings(
        "task",
        { id: "t", name: "  ", start: "2025-01-05", end: "2025-01-01", duration: -1 },
        [],
      );
      assert.deepStrictEqual(
        findings.map((finding) => [finding.category, finding.severity, finding.origin]),
        [
          ["invalidInput", "error", "draft"],
          ["invalidTaskDateRange", "error", "draft"],
          ["invalidDuration", "error", "draft"],
          ["overConstrained", "error", "draft"],
        ],
      );
      assert.deepStrictEqual(findings[0].args, { field: "name", expectation: "nonEmptyString" });
      assert.deepStrictEqual(findings[1].subjects, [{ kind: "task", id: "t" }]);
      assert.ok(findings.every((finding) => finding.location === undefined));
    });

    test("treats a non-finite duration as invalid", () => {
      const findings = entityDraftFindings(
        "task",
        { id: "t", name: "Task", start: "2025-01-01", duration: Number.NaN },
        [],
      );
      assert.ok(findings.some((finding) => finding.category === "invalidDuration"));
    });

    test("reports an under-constrained task with its constraint count", () => {
      const [finding] = entityDraftFindings("task", { id: "t", name: "Task" }, []);
      assert.strictEqual(finding.category, "underConstrained");
      assert.strictEqual(finding.severity, "error");
      assert.deepStrictEqual(finding.args, { count: 0 });
    });

    test("reports an over-constrained task with duplicate endpoints", () => {
      const [finding] = entityDraftFindings(
        "task",
        { id: "t", name: "Task", start: "2025-01-01", end: "2025-01-02", duration: 2 },
        [{ id: "d", sourceId: "x", targetId: "t", type: "startAfter" }],
      );
      assert.strictEqual(finding.category, "overConstrained");
      assert.ok(Array.isArray(finding.args?.duplicateEndpoints));
    });

    test("reports a milestone without a date or outgoing dependency", () => {
      const [finding] = entityDraftFindings("milestone", { id: "m", name: "M" }, []);
      assert.strictEqual(finding.category, "underConstrained");
      assert.deepStrictEqual(finding.subjects, [{ kind: "milestone", id: "m" }]);
    });

    test("accepts a dated milestone", () => {
      assert.deepStrictEqual(
        entityDraftFindings("milestone", { id: "m", name: "M", date: "2025-01-01" }, []),
        [],
      );
    });

    test("reports a group that names itself as parent", () => {
      const findings = entityDraftFindings("group", { id: "g", name: "G", groupId: "g" }, []);
      assert.deepStrictEqual(
        findings.map((finding) => finding.category),
        ["groupSelfParent"],
      );
      assert.deepStrictEqual(entityDraftFindings("group", { id: "g", name: "G" }, []), []);
    });
  });

  suite("settingsDraftFindings", () => {
    test("returns nothing when the settings form has no blocking condition", () => {
      assert.deepStrictEqual(
        settingsDraftFindings({ invalidHolidayRange: false, blankStatusName: false }, 2),
        [],
      );
    });

    test("locates the new holiday after existing ranges and reports a blank status", () => {
      const findings = settingsDraftFindings(
        { invalidHolidayRange: true, blankStatusName: true },
        2,
      );
      assert.deepStrictEqual(findings, [
        {
          category: "invalidHolidayRange",
          severity: "error",
          origin: "draft",
          subjects: [{ kind: "holiday", index: 2 }],
          args: undefined,
        },
        {
          category: "blankStatusName",
          severity: "error",
          origin: "draft",
          subjects: [{ kind: "status" }],
          args: undefined,
        },
      ]);
    });
  });

  suite("draftLabelSnapshot", () => {
    test("uses an unsaved task rename while keeping other labels", () => {
      const labels = draftLabelSnapshot(documentWithItems(), "task", {
        id: "t-sentinel",
        name: "Renamed",
      });
      const names = labels.items.map((item) => `${item.kind}:${item.name}`);
      assert.deepStrictEqual(names, ["task:Renamed", "milestone:Launch", "group:Phase"]);
    });

    test("appends a new milestone draft and replaces a group draft", () => {
      const document = documentWithItems();
      const milestoneLabels = draftLabelSnapshot(document, "milestone", {
        id: "m-new",
        name: "Beta",
      });
      assert.deepStrictEqual(
        milestoneLabels.items
          .filter((item) => item.kind === "milestone")
          .map((item) => [item.name, item.index]),
        [
          ["Launch", 0],
          ["Beta", 1],
        ],
      );
      const groupLabels = draftLabelSnapshot(document, "group", {
        id: "g-sentinel",
        name: "Stage",
      });
      assert.ok(groupLabels.items.some((item) => item.kind === "group" && item.name === "Stage"));
      assert.ok(!groupLabels.items.some((item) => item.name === "Phase"));
    });
  });

  test("exportFailedFinding is an operation error without subjects", () => {
    assert.deepStrictEqual(exportFailedFinding(), {
      category: "exportFailed",
      severity: "error",
      origin: "operation",
      subjects: [],
    });
  });
});
