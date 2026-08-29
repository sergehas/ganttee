import * as assert from "assert";
import {
  addDays,
  diffInDays,
  formatIsoDate,
  parseIsoDate,
} from "../common/dates";
import {
  CyclicDependencyError,
  GanttDocument,
  GroupEntity,
  MILESTONE_DURATION,
  MilestoneEntity,
  ParallelEdgeDependencyError,
  SelfLoopDependencyError,
  TaskEntity,
  UnresolvableScheduleError,
} from "../common/models";
import {
  parseDocument,
  serializeDocument,
} from "../services/ganttDocumentService";
import { hydrateDocument, toDocument } from "../services/ganttModelService";

/** A well-formed document exercising every entity kind and constraint combo. */
const SAMPLE_DOCUMENT: GanttDocument = {
  version: 2,
  tasks: [
    {
      id: "t1",
      name: "A",
      start: "2026-01-01",
      end: "2026-01-05",
      description: "line one\nline two",
      progress: 0.5,
      status: "inProgress",
      groupId: "g1",
    },
    { id: "t2", name: "B", start: "2026-01-02", duration: 3 },
  ],
  groups: [{ id: "g1", name: "Phase", collapsed: true }],
  milestones: [{ id: "m1", name: "M", date: "2026-01-10", groupId: "g1" }],
  dependencies: [
    { id: "d1", sourceId: "t2", targetId: "t1", type: "startAfter" },
  ],
};

suite("date helpers", () => {
  test("parses a date-only ISO string as UTC midnight", () => {
    const date = parseIsoDate("2026-03-15");
    assert.strictEqual(date.getTime(), Date.UTC(2026, 2, 15));
  });

  test("round-trips parse and format without timezone drift", () => {
    assert.strictEqual(formatIsoDate(parseIsoDate("2026-03-15")), "2026-03-15");
  });

  test("adds whole calendar days", () => {
    assert.strictEqual(
      formatIsoDate(addDays(parseIsoDate("2026-01-01"), 4)),
      "2026-01-05",
    );
  });

  test("subtracts calendar days for negative offsets", () => {
    assert.strictEqual(
      formatIsoDate(addDays(parseIsoDate("2026-01-05"), -4)),
      "2026-01-01",
    );
  });

  test("computes the decimal day difference", () => {
    assert.strictEqual(
      diffInDays(parseIsoDate("2026-01-01"), parseIsoDate("2026-01-05")),
      4,
    );
  });
});

suite("TaskEntity", () => {
  test("returns start and end as Date instances for a start+end task", () => {
    const task = new TaskEntity({
      id: "t",
      name: "T",
      start: parseIsoDate("2026-01-01"),
      end: parseIsoDate("2026-01-05"),
    });
    assert.ok(task.effectiveStart() instanceof Date);
    assert.ok(task.effectiveEnd() instanceof Date);
    assert.strictEqual(formatIsoDate(task.effectiveStart()), "2026-01-01");
    assert.strictEqual(formatIsoDate(task.effectiveEnd()), "2026-01-05");
    assert.strictEqual(task.effectiveDuration(), 4);
  });

  test("derives end and prefers user duration for a start+duration task", () => {
    const task = new TaskEntity({
      id: "t",
      name: "T",
      start: parseIsoDate("2026-01-01"),
      duration: 3,
    });
    assert.strictEqual(task.effectiveDuration(), 3);
    assert.strictEqual(formatIsoDate(task.effectiveEnd()), "2026-01-04");
  });

  test("derives start for an end+duration task", () => {
    const task = new TaskEntity({
      id: "t",
      name: "T",
      end: parseIsoDate("2026-01-05"),
      duration: 4,
    });
    assert.strictEqual(formatIsoDate(task.effectiveStart()), "2026-01-01");
  });

  test("throws when an under-constrained task cannot derive its end", () => {
    const task = new TaskEntity({
      id: "t",
      name: "T",
      start: parseIsoDate("2026-01-01"),
    });
    assert.throws(() => task.effectiveEnd(), UnresolvableScheduleError);
    assert.throws(() => task.effectiveDuration(), UnresolvableScheduleError);
  });

  test("throws when an under-constrained task cannot derive its start", () => {
    const task = new TaskEntity({
      id: "t",
      name: "T",
      end: parseIsoDate("2026-01-05"),
    });
    assert.throws(() => task.effectiveStart(), UnresolvableScheduleError);
  });
});

suite("MilestoneEntity", () => {
  test("aliases start and end to its date with zero duration", () => {
    const milestone = new MilestoneEntity({
      id: "m",
      name: "M",
      date: parseIsoDate("2026-01-10"),
    });
    assert.strictEqual(formatIsoDate(milestone.effectiveStart()), "2026-01-10");
    assert.strictEqual(formatIsoDate(milestone.effectiveEnd()), "2026-01-10");
    assert.strictEqual(milestone.effectiveDuration(), MILESTONE_DURATION);
  });
});

suite("GroupEntity", () => {
  test("uses a Unix-epoch placeholder with zero duration", () => {
    const group = new GroupEntity({ id: "g", name: "G" });
    assert.strictEqual(group.effectiveStart().getTime(), 0);
    assert.strictEqual(group.effectiveEnd().getTime(), 0);
    assert.strictEqual(group.effectiveDuration(), 0);
  });
});

suite("ganttModelService", () => {
  test("hydrates entities with Date-typed schedule fields", () => {
    const model = hydrateDocument(SAMPLE_DOCUMENT);
    assert.ok(model.tasks[0] instanceof TaskEntity);
    assert.ok(model.tasks[0].start instanceof Date);
    assert.ok(model.tasks[0].end instanceof Date);
    assert.ok(model.milestones[0].date instanceof Date);
    assert.strictEqual(model.version, 2);
    assert.strictEqual(model.dependencies.length, 1);
  });

  test("preserves collapsed and grouping metadata on hydration", () => {
    const model = hydrateDocument(SAMPLE_DOCUMENT);
    assert.strictEqual(model.groups[0].collapsed, true);
    assert.strictEqual(model.tasks[0].groupId, "g1");
    assert.strictEqual(model.milestones[0].groupId, "g1");
  });

  test("round-trips parse -> hydrate -> toDocument as a stable document", () => {
    const parsed = parseDocument(serializeDocument(SAMPLE_DOCUMENT));
    const roundTripped = toDocument(hydrateDocument(parsed));
    assert.deepStrictEqual(roundTripped, parsed);
    assert.strictEqual(
      serializeDocument(roundTripped),
      serializeDocument(parsed),
    );
  });

  test("preserves multi-line descriptions through hydration", () => {
    const roundTripped = toDocument(hydrateDocument(SAMPLE_DOCUMENT));
    assert.strictEqual(roundTripped.tasks[0].description, "line one\nline two");
  });

  test("carries reserved working-calendar configuration when present", () => {
    const withCalendar: GanttDocument = {
      ...SAMPLE_DOCUMENT,
      settings: { workingCalendar: { daysOff: [6, 7] }, workingDayHours: 8 },
    };
    const roundTripped = toDocument(hydrateDocument(withCalendar));
    assert.deepStrictEqual(roundTripped.settings, {
      workingCalendar: { daysOff: [6, 7] },
      workingDayHours: 8,
    });
  });
});

suite("ganttModelService DAG invariants", () => {
  test("builds a graph spanning every task, milestone, and group id", () => {
    const model = hydrateDocument(SAMPLE_DOCUMENT);
    assert.deepStrictEqual([...model.graph.nodes].sort(), [
      "g1",
      "m1",
      "t1",
      "t2",
    ]);
    assert.deepStrictEqual([...model.graph.successors("t2")], ["t1"]);
    assert.deepStrictEqual([...model.graph.predecessors("t1")], ["t2"]);
    assert.strictEqual(model.graph.hasCycle(), false);
  });

  test("orders the hydrated graph topologically over every entity", () => {
    const order = [...hydrateDocument(SAMPLE_DOCUMENT).graph.topologicalSort()];
    assert.deepStrictEqual([...order].sort(), ["g1", "m1", "t1", "t2"]);
    assert.ok(order.indexOf("t2") < order.indexOf("t1"));
  });

  test("hydrates a document whose entities form disconnected components", () => {
    const document: GanttDocument = {
      ...SAMPLE_DOCUMENT,
      dependencies: [],
    };
    const model = hydrateDocument(document);
    assert.strictEqual(model.graph.connectedComponents().length, 4);
  });

  test("rejects a self-referencing dependency", () => {
    const document: GanttDocument = {
      ...SAMPLE_DOCUMENT,
      dependencies: [
        { id: "d1", sourceId: "t1", targetId: "t1", type: "startAfter" },
      ],
    };
    assert.throws(() => hydrateDocument(document), SelfLoopDependencyError);
  });

  test("rejects two dependencies sharing the same source and target", () => {
    const document: GanttDocument = {
      ...SAMPLE_DOCUMENT,
      dependencies: [
        { id: "d1", sourceId: "t2", targetId: "t1", type: "startAfter" },
        { id: "d2", sourceId: "t2", targetId: "t1", type: "startWith" },
      ],
    };
    assert.throws(() => hydrateDocument(document), ParallelEdgeDependencyError);
  });

  test("rejects a dependency set that closes a cycle", () => {
    const document: GanttDocument = {
      ...SAMPLE_DOCUMENT,
      dependencies: [
        { id: "d1", sourceId: "t1", targetId: "t2", type: "startAfter" },
        { id: "d2", sourceId: "t2", targetId: "t1", type: "startAfter" },
      ],
    };
    assert.throws(
      () => hydrateDocument(document),
      (error: unknown) => {
        assert.ok(error instanceof CyclicDependencyError);
        assert.ok(error.cycle.includes("t1"));
        assert.ok(error.cycle.includes("t2"));
        return true;
      },
    );
  });
});
