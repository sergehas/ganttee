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

/** Builds a task with the given optional constraints for a test case. */
function task(overrides: Partial<Task>): Task {
  return { id: "t1", name: "Task", ...overrides };
}

suite("taskConstraintService", () => {
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
  });

  test("treats multiple outgoing dependencies on one endpoint as one", () => {
    const validation = describeTaskConstraintValidation(
      task({ duration: 4 }),
      [
        { id: "s1", sourceId: "t1", targetId: "t2", type: "startAfter" },
        { id: "s2", sourceId: "t1", targetId: "t3", type: "startWith" },
      ],
    );

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
