import { GantteeFinding, LabelSnapshot } from "@common/models";
import {
  decodeProblemItemArgument,
  encodeProblemItemArgument,
  hasProblemItem,
  problemItemRef,
} from "@services/diagnostics/problemNavigation";
import * as assert from "assert";

/** Labels of a revision holding one item of each kind. */
const LABELS: LabelSnapshot = {
  items: [
    { kind: "task", id: "t", index: 0 },
    { kind: "milestone", id: "m", index: 0 },
    { kind: "group", id: "g", index: 0 },
    { kind: "status", id: "s", index: 0 },
    { kind: "status", id: "shared", index: 1 },
    { kind: "group", id: "shared", index: 1 },
  ],
  dependencies: [{ id: "d", sourceId: "t", targetId: "m", index: 0 }],
};

/** Builds a finding about the given subjects. */
function finding(subjects: GantteeFinding["subjects"]): GantteeFinding {
  return { category: "unknownItem", severity: "warning", origin: "operation", subjects };
}

/** Hex-encodes text the way the command argument does. */
function hex(text: string): string {
  return [...text].map((char) => char.charCodeAt(0).toString(16).padStart(4, "0")).join("");
}

suite("problemNavigation", () => {
  suite("problemItemRef", () => {
    test("returns the primary task, milestone, or group", () => {
      assert.deepStrictEqual(problemItemRef(finding([{ kind: "task", id: "t" }]), LABELS), {
        kind: "task",
        id: "t",
      });
      assert.deepStrictEqual(
        problemItemRef(
          finding([
            { kind: "milestone", id: "m" },
            { kind: "task", id: "t" },
          ]),
          LABELS,
        ),
        { kind: "milestone", id: "m" },
      );
      assert.deepStrictEqual(problemItemRef(finding([{ kind: "group", id: "g" }]), LABELS), {
        kind: "group",
        id: "g",
      });
    });

    test("resolves an item of unknown kind, skipping statuses", () => {
      assert.deepStrictEqual(problemItemRef(finding([{ kind: "item", id: "m" }]), LABELS), {
        kind: "milestone",
        id: "m",
      });
      assert.deepStrictEqual(problemItemRef(finding([{ kind: "item", id: "shared" }]), LABELS), {
        kind: "group",
        id: "shared",
      });
    });

    test("returns nothing without an editable existing item", () => {
      for (const subjects of [
        [],
        [{ kind: "project" }],
        [{ kind: "task" }],
        [{ kind: "status", id: "s" }],
        [{ kind: "dependency", id: "d" }],
        [{ kind: "task", id: "missing" }],
        [{ kind: "task", id: "m" }],
      ] as GantteeFinding["subjects"][]) {
        assert.strictEqual(problemItemRef(finding(subjects), LABELS), undefined);
      }
    });
  });

  test("hasProblemItem matches kind and id", () => {
    assert.ok(hasProblemItem(LABELS, { kind: "task", id: "t" }));
    assert.ok(!hasProblemItem(LABELS, { kind: "group", id: "t" }));
    assert.ok(!hasProblemItem(LABELS, { kind: "task", id: "missing" }));
  });

  suite("command argument", () => {
    test("round-trips URIs and ids with characters URI decoding would change", () => {
      const target = {
        uri: "file:///d%3A/dev/plan%20%23one.ganttee",
        entity: { kind: "task" as const, id: 'ünï%20cødé"?#' },
      };
      const encoded = encodeProblemItemArgument(target);
      assert.match(encoded, /^[0-9a-f]+$/);
      assert.strictEqual(decodeURIComponent(encoded), encoded);
      assert.deepStrictEqual(decodeProblemItemArgument(encoded), target);
    });

    test("rejects malformed arguments", () => {
      for (const value of [
        undefined,
        42,
        "",
        "abc",
        "zzzz",
        "ABCD",
        "0".repeat(16_388),
        hex("not json"),
        hex("null"),
        hex("1"),
        hex(JSON.stringify({ uri: 1, kind: "task", id: "t" })),
        hex(JSON.stringify({ uri: "", kind: "task", id: "t" })),
        hex(JSON.stringify({ uri: "u", kind: "status", id: "t" })),
        hex(JSON.stringify({ uri: "u", kind: "task", id: 1 })),
        hex(JSON.stringify({ uri: "u", kind: "task", id: "" })),
      ]) {
        assert.strictEqual(decodeProblemItemArgument(value), undefined, String(value));
      }
    });

    test("accepts each editable kind", () => {
      for (const kind of ["task", "milestone", "group"] as const) {
        assert.deepStrictEqual(
          decodeProblemItemArgument(hex(JSON.stringify({ uri: "u", kind, id: "x" }))),
          { uri: "u", entity: { kind, id: "x" } },
        );
      }
    });
  });
});
