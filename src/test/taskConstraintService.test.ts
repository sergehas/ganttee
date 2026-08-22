import * as assert from "assert";
import {
  effectiveDuration,
  effectiveEnd,
  effectiveStart,
  Milestone,
  MILESTONE_DURATION,
  milestoneEnd,
  milestoneStart,
  Task,
} from "../common/models";
import {
  describeMilestoneConstraintValidation,
  describeTaskConstraints,
  describeTaskConstraintValidation,
  getEffectiveTaskConstraintCount,
} from "../services/taskConstraintService";

type OutgoingConstraintGroup = "none" | "start" | "end" | "startAndEnd";

/** Builds dependencies that represent one outgoing endpoint-constraint group. */
function outgoingDependencies(group: OutgoingConstraintGroup) {
  const dependencies = [];
  if (group === "start" || group === "startAndEnd") {
    dependencies.push({
      id: "start",
      sourceId: "t1",
      targetId: "target-start",
      type: "startAfter" as const,
    });
  }
  if (group === "end" || group === "startAndEnd") {
    dependencies.push({
      id: "end",
      sourceId: "t1",
      targetId: "target-end",
      type: "endWith" as const,
    });
  }
  return dependencies;
}

/** Builds a task with the given optional constraints for a test case. */
function task(overrides: Partial<Task>): Task {
  return { id: "t1", name: "Task", ...overrides };
}

suite("taskConstraintService", () => {
  const taskRuleMatrix: ReadonlyArray<{
    name: string;
    task: Partial<Task>;
    outgoing: OutgoingConstraintGroup;
    expected: {
      count: number;
      duplicateStart: boolean;
      duplicateEnd: boolean;
      underConstrained: boolean;
      overConstrained: boolean;
      blocking: boolean;
    };
  }> = [
    {
      name: "none with no outgoing dependency",
      task: {},
      outgoing: "none",
      expected: {
        count: 0,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: true,
        overConstrained: false,
        blocking: true,
      },
    },
    {
      name: "none with start dependency",
      task: {},
      outgoing: "start",
      expected: {
        count: 1,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: true,
        overConstrained: false,
        blocking: true,
      },
    },
    {
      name: "none with end dependency",
      task: {},
      outgoing: "end",
      expected: {
        count: 1,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: true,
        overConstrained: false,
        blocking: true,
      },
    },
    {
      name: "none with start and end dependencies",
      task: {},
      outgoing: "startAndEnd",
      expected: {
        count: 2,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: false,
        blocking: false,
      },
    },
    {
      name: "start with no outgoing dependency",
      task: { start: "2026-01-01" },
      outgoing: "none",
      expected: {
        count: 1,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: true,
        overConstrained: false,
        blocking: true,
      },
    },
    {
      name: "start with start dependency",
      task: { start: "2026-01-01" },
      outgoing: "start",
      expected: {
        count: 1,
        duplicateStart: true,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: true,
        blocking: false,
      },
    },
    {
      name: "start with end dependency",
      task: { start: "2026-01-01" },
      outgoing: "end",
      expected: {
        count: 2,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: false,
        blocking: false,
      },
    },
    {
      name: "start with start and end dependencies",
      task: { start: "2026-01-01" },
      outgoing: "startAndEnd",
      expected: {
        count: 2,
        duplicateStart: true,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: true,
        blocking: false,
      },
    },
    {
      name: "duration with no outgoing dependency",
      task: { duration: 2 },
      outgoing: "none",
      expected: {
        count: 1,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: true,
        overConstrained: false,
        blocking: true,
      },
    },
    {
      name: "duration with start dependency",
      task: { duration: 2 },
      outgoing: "start",
      expected: {
        count: 2,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: false,
        blocking: false,
      },
    },
    {
      name: "duration with end dependency",
      task: { duration: 2 },
      outgoing: "end",
      expected: {
        count: 2,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: false,
        blocking: false,
      },
    },
    {
      name: "duration with start and end dependencies",
      task: { duration: 2 },
      outgoing: "startAndEnd",
      expected: {
        count: 3,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: true,
        blocking: true,
      },
    },
    {
      name: "end with no outgoing dependency",
      task: { end: "2026-01-02" },
      outgoing: "none",
      expected: {
        count: 1,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: true,
        overConstrained: false,
        blocking: true,
      },
    },
    {
      name: "end with start dependency",
      task: { end: "2026-01-02" },
      outgoing: "start",
      expected: {
        count: 2,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: false,
        blocking: false,
      },
    },
    {
      name: "end with end dependency",
      task: { end: "2026-01-02" },
      outgoing: "end",
      expected: {
        count: 1,
        duplicateStart: false,
        duplicateEnd: true,
        underConstrained: false,
        overConstrained: true,
        blocking: false,
      },
    },
    {
      name: "end with start and end dependencies",
      task: { end: "2026-01-02" },
      outgoing: "startAndEnd",
      expected: {
        count: 2,
        duplicateStart: false,
        duplicateEnd: true,
        underConstrained: false,
        overConstrained: true,
        blocking: false,
      },
    },
    {
      name: "start and duration with no outgoing dependency",
      task: { start: "2026-01-01", duration: 2 },
      outgoing: "none",
      expected: {
        count: 2,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: false,
        blocking: false,
      },
    },
    {
      name: "start and duration with start dependency",
      task: { start: "2026-01-01", duration: 2 },
      outgoing: "start",
      expected: {
        count: 2,
        duplicateStart: true,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: true,
        blocking: false,
      },
    },
    {
      name: "start and duration with end dependency",
      task: { start: "2026-01-01", duration: 2 },
      outgoing: "end",
      expected: {
        count: 3,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: true,
        blocking: true,
      },
    },
    {
      name: "start and duration with start and end dependencies",
      task: { start: "2026-01-01", duration: 2 },
      outgoing: "startAndEnd",
      expected: {
        count: 3,
        duplicateStart: true,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: true,
        blocking: true,
      },
    },
    {
      name: "start and end with no outgoing dependency",
      task: { start: "2026-01-01", end: "2026-01-02" },
      outgoing: "none",
      expected: {
        count: 2,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: false,
        blocking: false,
      },
    },
    {
      name: "start and end with start dependency",
      task: { start: "2026-01-01", end: "2026-01-02" },
      outgoing: "start",
      expected: {
        count: 2,
        duplicateStart: true,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: true,
        blocking: false,
      },
    },
    {
      name: "start and end with end dependency",
      task: { start: "2026-01-01", end: "2026-01-02" },
      outgoing: "end",
      expected: {
        count: 2,
        duplicateStart: false,
        duplicateEnd: true,
        underConstrained: false,
        overConstrained: true,
        blocking: false,
      },
    },
    {
      name: "start and end with start and end dependencies",
      task: { start: "2026-01-01", end: "2026-01-02" },
      outgoing: "startAndEnd",
      expected: {
        count: 2,
        duplicateStart: true,
        duplicateEnd: true,
        underConstrained: false,
        overConstrained: true,
        blocking: false,
      },
    },
    {
      name: "duration and end with no outgoing dependency",
      task: { duration: 2, end: "2026-01-02" },
      outgoing: "none",
      expected: {
        count: 2,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: false,
        blocking: false,
      },
    },
    {
      name: "duration and end with start dependency",
      task: { duration: 2, end: "2026-01-02" },
      outgoing: "start",
      expected: {
        count: 3,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: true,
        blocking: true,
      },
    },
    {
      name: "duration and end with end dependency",
      task: { duration: 2, end: "2026-01-02" },
      outgoing: "end",
      expected: {
        count: 2,
        duplicateStart: false,
        duplicateEnd: true,
        underConstrained: false,
        overConstrained: true,
        blocking: false,
      },
    },
    {
      name: "duration and end with start and end dependencies",
      task: { duration: 2, end: "2026-01-02" },
      outgoing: "startAndEnd",
      expected: {
        count: 3,
        duplicateStart: false,
        duplicateEnd: true,
        underConstrained: false,
        overConstrained: true,
        blocking: true,
      },
    },
    {
      name: "start, duration, and end with no outgoing dependency",
      task: { start: "2026-01-01", duration: 2, end: "2026-01-02" },
      outgoing: "none",
      expected: {
        count: 3,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: true,
        blocking: true,
      },
    },
    {
      name: "start, duration, and end with start dependency",
      task: { start: "2026-01-01", duration: 2, end: "2026-01-02" },
      outgoing: "start",
      expected: {
        count: 3,
        duplicateStart: true,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: true,
        blocking: true,
      },
    },
    {
      name: "start, duration, and end with end dependency",
      task: { start: "2026-01-01", duration: 2, end: "2026-01-02" },
      outgoing: "end",
      expected: {
        count: 3,
        duplicateStart: false,
        duplicateEnd: true,
        underConstrained: false,
        overConstrained: true,
        blocking: true,
      },
    },
    {
      name: "start, duration, and end with start and end dependencies",
      task: { start: "2026-01-01", duration: 2, end: "2026-01-02" },
      outgoing: "startAndEnd",
      expected: {
        count: 3,
        duplicateStart: true,
        duplicateEnd: true,
        underConstrained: false,
        overConstrained: true,
        blocking: true,
      },
    },
  ];

  for (const testCase of taskRuleMatrix) {
    test(`validates task constraints for ${testCase.name}`, () => {
      assert.deepStrictEqual(
        describeTaskConstraintValidation(
          task(testCase.task),
          outgoingDependencies(testCase.outgoing),
        ),
        testCase.expected,
      );
    });
  }

  const milestoneRuleMatrix: ReadonlyArray<{
    name: string;
    milestone: Milestone;
    outgoing: OutgoingConstraintGroup;
    expected: {
      count: number;
      duplicateStart: boolean;
      duplicateEnd: boolean;
      underConstrained: boolean;
      overConstrained: boolean;
      blocking: boolean;
    };
  }> = [
    {
      name: "date with no outgoing dependency",
      milestone: { id: "t1", name: "Milestone", date: "2026-01-01" },
      outgoing: "none",
      expected: {
        count: 2,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: false,
        blocking: false,
      },
    },
    {
      name: "date with start dependency",
      milestone: { id: "t1", name: "Milestone", date: "2026-01-01" },
      outgoing: "start",
      expected: {
        count: 2,
        duplicateStart: true,
        duplicateEnd: true,
        underConstrained: false,
        overConstrained: true,
        blocking: false,
      },
    },
    {
      name: "date with end dependency",
      milestone: { id: "t1", name: "Milestone", date: "2026-01-01" },
      outgoing: "end",
      expected: {
        count: 2,
        duplicateStart: true,
        duplicateEnd: true,
        underConstrained: false,
        overConstrained: true,
        blocking: false,
      },
    },
    {
      name: "date with start and end dependencies",
      milestone: { id: "t1", name: "Milestone", date: "2026-01-01" },
      outgoing: "startAndEnd",
      expected: {
        count: 2,
        duplicateStart: true,
        duplicateEnd: true,
        underConstrained: false,
        overConstrained: true,
        blocking: false,
      },
    },
    {
      name: "no date with no outgoing dependency",
      milestone: { id: "t1", name: "Milestone" },
      outgoing: "none",
      expected: {
        count: 0,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: true,
        overConstrained: false,
        blocking: true,
      },
    },
    {
      name: "no date with start dependency",
      milestone: { id: "t1", name: "Milestone" },
      outgoing: "start",
      expected: {
        count: 2,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: false,
        blocking: false,
      },
    },
    {
      name: "no date with end dependency",
      milestone: { id: "t1", name: "Milestone" },
      outgoing: "end",
      expected: {
        count: 2,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: false,
        blocking: false,
      },
    },
    {
      name: "no date with start and end dependencies",
      milestone: { id: "t1", name: "Milestone" },
      outgoing: "startAndEnd",
      expected: {
        count: 2,
        duplicateStart: false,
        duplicateEnd: false,
        underConstrained: false,
        overConstrained: true,
        blocking: true,
      },
    },
  ];

  for (const testCase of milestoneRuleMatrix) {
    test(`validates milestone constraints for ${testCase.name}`, () => {
      assert.deepStrictEqual(
        describeMilestoneConstraintValidation(
          testCase.milestone,
          outgoingDependencies(testCase.outgoing),
        ),
        testCase.expected,
      );
    });
  }

  test("classifies start + end as determinate", () => {
    const descriptor = describeTaskConstraints(
      task({ start: "2026-01-01", end: "2026-01-05" }),
    );
    assert.strictEqual(descriptor.status, "determinate");
    assert.strictEqual(descriptor.count, 2);
  });

  test("classifies start + duration as determinate", () => {
    const descriptor = describeTaskConstraints(
      task({ start: "2026-01-01", duration: 4 }),
    );
    assert.strictEqual(descriptor.status, "determinate");
  });

  test("classifies duration + end as determinate", () => {
    const descriptor = describeTaskConstraints(
      task({ duration: 4, end: "2026-01-05" }),
    );
    assert.strictEqual(descriptor.status, "determinate");
  });

  test("classifies all three constraints as hyperstatic", () => {
    const descriptor = describeTaskConstraints(
      task({ start: "2026-01-01", duration: 4, end: "2026-01-05" }),
    );
    assert.strictEqual(descriptor.status, "hyperstatic");
    assert.strictEqual(descriptor.count, 3);
  });

  test("classifies a single constraint as under-constrained", () => {
    const descriptor = describeTaskConstraints(task({ start: "2026-01-01" }));
    assert.strictEqual(descriptor.status, "underConstrained");
    assert.strictEqual(descriptor.count, 1);
  });

  test("classifies no constraints as under-constrained", () => {
    const descriptor = describeTaskConstraints(task({}));
    assert.strictEqual(descriptor.status, "underConstrained");
    assert.strictEqual(descriptor.count, 0);
  });

  test("reports which constraints are set", () => {
    const descriptor = describeTaskConstraints(
      task({ duration: 4, end: "2026-01-05" }),
    );
    assert.strictEqual(descriptor.hasStart, false);
    assert.strictEqual(descriptor.hasDuration, true);
    assert.strictEqual(descriptor.hasEnd, true);
  });

  test("counts a start dependency as an effective task constraint", () => {
    const count = getEffectiveTaskConstraintCount(task({ duration: 4 }), [
      {
        id: "d1",
        sourceId: "t1",
        targetId: "t2",
        type: "startAfter",
      },
    ]);

    assert.strictEqual(count, 2);
  });

  test("does not count a dependency-supplied endpoint set statically", () => {
    const count = getEffectiveTaskConstraintCount(
      task({ start: "2026-01-01", duration: 4 }),
      [
        {
          id: "d1",
          sourceId: "t1",
          targetId: "t2",
          type: "startWith",
        },
      ],
    );

    assert.strictEqual(count, 2);
  });

  test("reports duplicate start and end endpoint constraints", () => {
    const validation = describeTaskConstraintValidation(
      task({ start: "2026-01-01", duration: 4, end: "2026-01-05" }),
      [
        { id: "s", sourceId: "t1", targetId: "t2", type: "startWith" },
        { id: "e", sourceId: "t1", targetId: "t3", type: "endWith" },
      ],
    );

    assert.deepStrictEqual(validation, {
      count: 3,
      duplicateStart: true,
      duplicateEnd: true,
      underConstrained: false,
      overConstrained: true,
      blocking: true,
    });
  });

  test("prioritizes duplicate endpoint over under-constraint", () => {
    const validation = describeTaskConstraintValidation(
      task({ start: "2026-01-01" }),
      [{ id: "s", sourceId: "t1", targetId: "t2", type: "startAfter" }],
    );

    assert.strictEqual(validation.count, 1);
    assert.strictEqual(validation.underConstrained, false);
    assert.strictEqual(validation.overConstrained, true);
    assert.strictEqual(validation.duplicateStart, true);
    assert.strictEqual(validation.blocking, false);
  });

  test("blocks a mixed duplicate and ordinary over-constraint", () => {
    const validation = describeTaskConstraintValidation(
      task({ start: "2026-01-01", duration: 4, end: "2026-01-05" }),
      [{ id: "s", sourceId: "t1", targetId: "t2", type: "startAfter" }],
    );

    assert.strictEqual(validation.duplicateStart, true);
    assert.strictEqual(validation.overConstrained, true);
    assert.strictEqual(validation.blocking, true);
  });

  test("treats multiple outgoing dependencies on one endpoint as one", () => {
    const validation = describeTaskConstraintValidation(task({ duration: 4 }), [
      { id: "s1", sourceId: "t1", targetId: "t2", type: "startAfter" },
      { id: "s2", sourceId: "t1", targetId: "t3", type: "startWith" },
    ]);

    assert.strictEqual(validation.count, 2);
    assert.strictEqual(validation.underConstrained, false);
    assert.strictEqual(validation.overConstrained, false);
  });

  test("validates milestone date presence and dependency-defined dates", () => {
    const missing = describeMilestoneConstraintValidation(
      { id: "m1", name: "Milestone" },
      [],
    );
    const inferred = describeMilestoneConstraintValidation(
      { id: "m1", name: "Milestone" },
      [{ id: "d1", sourceId: "m1", targetId: "t1", type: "endWith" }],
    );
    const duplicate = describeMilestoneConstraintValidation(
      { id: "m1", name: "Milestone", date: "2026-01-01" },
      [{ id: "d1", sourceId: "m1", targetId: "t1", type: "startAfter" }],
    );

    assert.strictEqual(missing.underConstrained, true);
    assert.strictEqual(inferred.underConstrained, false);
    assert.strictEqual(inferred.overConstrained, false);
    assert.strictEqual(duplicate.overConstrained, true);
  });

  test("derives effectiveDuration from start and end", () => {
    assert.strictEqual(
      effectiveDuration(task({ start: "2026-01-01", end: "2026-01-05" })),
      4,
    );
  });

  test("prefers a user-set duration for effectiveDuration", () => {
    assert.strictEqual(
      effectiveDuration(task({ start: "2026-01-01", duration: 2.5 })),
      2.5,
    );
  });

  test("returns undefined effectiveDuration when under-constrained", () => {
    assert.strictEqual(
      effectiveDuration(task({ start: "2026-01-01" })),
      undefined,
    );
  });

  test("surfaces user-set effective start and end", () => {
    const value = task({ start: "2026-01-01", end: "2026-01-05" });
    assert.strictEqual(effectiveStart(value), "2026-01-01");
    assert.strictEqual(effectiveEnd(value), "2026-01-05");
  });

  test("returns undefined effective dates when not set", () => {
    const value = task({ duration: 3 });
    assert.strictEqual(effectiveStart(value), undefined);
    assert.strictEqual(effectiveEnd(value), undefined);
  });

  test("aliases milestone start and end to its date with zero duration", () => {
    const milestone: Milestone = {
      id: "m1",
      name: "Kickoff",
      date: "2026-01-01",
    };
    assert.strictEqual(milestoneStart(milestone), "2026-01-01");
    assert.strictEqual(milestoneEnd(milestone), "2026-01-01");
    assert.strictEqual(MILESTONE_DURATION, 0);
  });
});
