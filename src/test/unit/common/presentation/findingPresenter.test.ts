import {
  GANTTEE_FINDING_CATEGORIES,
  GantteeFinding,
  GantteeFindingCategory,
  LabelSnapshot,
} from "@common/models";
import {
  describeFinding,
  describeFindingWithOrigin,
  describeRelated,
  FINDING_TEMPLATES,
  labelSubject,
  Translate,
} from "@common/presentation/diagnostics";
import * as assert from "assert";
import * as englishBundle from "../../../../../l10n/bundle.l10n.json";
import * as frenchBundle from "../../../../../l10n/bundle.l10n.fr.json";

/** English translator that substitutes `{n}` placeholders. */
const t: Translate = (message, ...args) =>
  message.replace(/\{(\d+)\}/g, (_, index: string) => String(args[Number(index)]));

/** Labels used across tests; ids are sentinels that must never be rendered. */
const LABELS: LabelSnapshot = {
  items: [
    { kind: "task", id: "ID_TASK_A", name: "Design", index: 0, groupId: "ID_GROUP_1" },
    { kind: "task", id: "ID_TASK_B", name: "Design", index: 1, groupId: "ID_GROUP_2" },
    { kind: "task", id: "ID_TASK_C", name: "  ", index: 2 },
    { kind: "task", id: "ID_TASK_D", name: "Build", index: 3 },
    { kind: "task", id: "ID_TASK_E", name: "Build", index: 4 },
    { kind: "milestone", id: "ID_MS", name: "Launch", index: 0 },
    { kind: "group", id: "ID_GROUP_1", name: "Phase 1", index: 0 },
    { kind: "group", id: "ID_GROUP_2", name: "Phase 2", index: 1 },
    { kind: "status", id: "ID_STATUS", index: 0 },
  ],
  dependencies: [
    { id: "ID_DEP", sourceId: "ID_TASK_D", targetId: "ID_MS", type: "startAfter", index: 0 },
    { id: "ID_DEP_U", sourceId: "ID_GONE", targetId: "ID_MS", index: 1 },
  ],
};

const BUILD = 'Task "Build" (occurrence 1)';

/** Builds a finding for tests. */
function finding(
  category: GantteeFindingCategory,
  extras: Partial<GantteeFinding> = {},
): GantteeFinding {
  return {
    category,
    severity: "error",
    origin: "document",
    subjects: [{ kind: "task", id: "ID_TASK_D", index: 3 }],
    ...extras,
  };
}

suite("findingPresenter", () => {
  test("every template exists in both localization bundles", () => {
    const english = englishBundle as unknown as Record<string, string>;
    const french = frenchBundle as unknown as Record<string, string>;
    for (const template of Object.values(FINDING_TEMPLATES)) {
      assert.ok(template in english, `missing English key: ${template}`);
      assert.ok(template in french, `missing French key: ${template}`);
    }
  });

  test("labels subjects without ever rendering internal ids", () => {
    const label = (id: string | undefined, kind: "task" | "item" = "task", index?: number) =>
      labelSubject({ kind, id, index }, LABELS, t);
    assert.strictEqual(label("ID_TASK_A"), 'Task "Design" in group "Phase 1"');
    assert.strictEqual(label("ID_TASK_C"), "unnamed task #1");
    assert.strictEqual(label("ID_TASK_E"), 'Task "Build" (occurrence 2)');
    assert.strictEqual(label("ID_GONE"), "missing task");
    assert.strictEqual(label("ID_GONE", "item"), "missing item");
    assert.strictEqual(label("ID_MS", "item"), 'Milestone "Launch"');
    assert.strictEqual(label(undefined, "task", 3), BUILD);
    assert.strictEqual(label(undefined, "item", 3), "missing item");
    assert.strictEqual(
      labelSubject({ kind: "status", id: "ID_STATUS" }, LABELS, t),
      "unnamed status #1",
    );
    assert.strictEqual(
      labelSubject({ kind: "dependency", id: "ID_DEP" }, LABELS, t),
      `dependency ${BUILD} starts after Milestone "Launch"`,
    );
    assert.strictEqual(
      labelSubject({ kind: "dependency", index: 1 }, LABELS, t),
      'dependency missing item is linked to Milestone "Launch"',
    );
    assert.strictEqual(labelSubject({ kind: "dependency", index: 6 }, LABELS, t), "dependency #7");
    assert.strictEqual(labelSubject({ kind: "dependency" }, LABELS, t), "missing dependency");
    assert.strictEqual(labelSubject({ kind: "holiday", index: 0 }, LABELS, t), "holiday #1");
    assert.strictEqual(labelSubject({ kind: "holiday" }, LABELS, t), "holiday");
    assert.strictEqual(labelSubject({ kind: "project" }, LABELS, t), "the project");
  });

  test("uses occurrence numbers when homonyms share a group", () => {
    const labels: LabelSnapshot = {
      items: [
        { kind: "task", id: "x", name: "Same", index: 0, groupId: "g" },
        { kind: "task", id: "y", name: "Same", index: 1, groupId: "g" },
        { kind: "group", id: "g", name: "G", index: 0 },
      ],
      dependencies: [],
    };
    assert.strictEqual(
      labelSubject({ kind: "task", id: "y" }, labels, t),
      'Task "Same" (occurrence 2)',
    );
  });

  test("describes every category without leaking sentinel ids", () => {
    for (const category of GANTTEE_FINDING_CATEGORIES) {
      const message = describeFinding(
        finding(category, {
          subjects: [
            { kind: "task", id: "ID_TASK_A" },
            { kind: "dependency", id: "ID_DEP" },
          ],
          args: { field: "name" },
        }),
        LABELS,
        t,
      );
      assert.ok(message.length > 0, category);
      assert.doesNotMatch(message, /ID_/, `${category}: ${message}`);
      assert.doesNotMatch(message, /\{\d\}/, `${category}: ${message}`);
    }
  });

  const cases: readonly [string, GantteeFinding, string][] = [
    [
      "invalid JSON with a position",
      finding("invalidJson", { subjects: [], args: { line: 3, column: 7 } }),
      "The document is not valid JSON (line 3, column 7).",
    ],
    ["invalid JSON", finding("invalidJson", { subjects: [] }), "The document is not valid JSON."],
    [
      "an invalid field",
      finding("invalidField", { args: { field: "start", expectation: "isoDate" } }),
      `Invalid value for "start" in ${BUILD}: expected a date in YYYY-MM-DD format.`,
    ],
    [
      "an invalid field without an expectation",
      finding("invalidField", { subjects: [], args: { field: "x" } }),
      'Invalid value for "x" in the project: expected a valid value.',
    ],
    [
      "an invalid field without arguments",
      finding("unsupportedField", { subjects: [] }),
      'Unsupported field "" in the project.',
    ],
    [
      "a dependency cycle",
      finding("dependencyCycle", {
        subjects: [
          { kind: "task", id: "ID_TASK_D" },
          { kind: "milestone", id: "ID_MS" },
        ],
      }),
      `Dependencies form a cycle: ${BUILD} → Milestone "Launch".`,
    ],
    [
      "an unanchored component without subjects",
      finding("unanchoredComponent", { subjects: [] }),
      "Items without an absolute date anchor: the project.",
    ],
    [
      "a duplicate sequence entry",
      finding("sequenceMismatch", {
        subjects: [{ kind: "project" }],
        args: { sequenceProblem: "duplicate" },
      }),
      "The order of the project lists an item more than once.",
    ],
    [
      "a missing sequence entry",
      finding("sequenceMismatch", { args: { sequenceProblem: "missing" } }),
      `The order of ${BUILD} omits one of its items.`,
    ],
    [
      "a duplicate constraint",
      finding("overConstrained", { args: { duplicateEndpoints: ["start", "end"] } }),
      `${BUILD} has a duplicate start and end constraint.`,
    ],
    [
      "an over-constrained item",
      finding("overConstrained", { args: { count: 3 } }),
      `${BUILD} is over-constrained (3 constraints, need 2).`,
    ],
    [
      "an over-constrained item without arguments",
      finding("overConstrained"),
      `${BUILD} is over-constrained (0 constraints, need 2).`,
    ],
    [
      "an under-constrained item without a count",
      finding("underConstrained"),
      `${BUILD} is under-constrained (0 constraints, need 2).`,
    ],
    [
      "a scheduling failure with a reason",
      finding("schedulingFailed", { args: { reason: "invalidDuration" } }),
      `The schedule cannot be computed: ${BUILD} has an invalid duration.`,
    ],
    [
      "a scheduling failure without a reason",
      finding("schedulingFailed", { subjects: [] }),
      "The schedule cannot be computed: an unexpected scheduling error occurred.",
    ],
    [
      "an invalid view value",
      finding("invalidViewValue", {
        severity: "warning",
        args: { field: "zoomLevel", defaultValue: "week" },
      }),
      'View setting "zoomLevel" is invalid; the default value week is used.',
    ],
    [
      "an invalid view value without arguments",
      finding("invalidViewValue"),
      'View setting "" is invalid; the default value  is used.',
    ],
  ];
  for (const [name, input, expected] of cases) {
    test(`describes ${name}`, () => {
      assert.strictEqual(describeFinding(input, LABELS, t), expected);
    });
  }

  test("prefixes non-document origins and labels related locations", () => {
    const base = finding("unknownItem");
    assert.strictEqual(describeFindingWithOrigin(base, LABELS, t), `${BUILD} no longer exists.`);
    assert.strictEqual(
      describeFindingWithOrigin({ ...base, origin: "draft" }, LABELS, t),
      `Unsaved draft: ${BUILD} no longer exists.`,
    );
    assert.match(
      describeFindingWithOrigin({ ...base, origin: "rejectedEdit" }, LABELS, t),
      /^Rejected edit: /,
    );
    assert.match(
      describeFindingWithOrigin({ ...base, origin: "operation" }, LABELS, t),
      /^Operation: /,
    );
    assert.strictEqual(
      describeRelated({ subject: { kind: "milestone", id: "ID_MS" }, location: {} }, LABELS, t),
      'Also affects Milestone "Launch"',
    );
  });
});
