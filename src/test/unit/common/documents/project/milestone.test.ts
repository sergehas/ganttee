import { createDefaultMilestone } from "@common/documents/project/milestone";
import * as assert from "assert";

suite("Milestone", () => {
  test("creates a default milestone for today", () => {
    const milestone = createDefaultMilestone("New Milestone");

    assert.notStrictEqual(milestone.id, undefined);
    assert.notStrictEqual(milestone.id, "");
    assert.match(milestone.date ?? "", /^\d{4}-\d{2}-\d{2}$/);
    assert.strictEqual(milestone.name, "New Milestone");
  });
});
