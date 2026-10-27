import { createDefaultGroup } from "@common/documents/project/group";
import * as assert from "assert";

suite("Group", () => {
  test("creates a default group", () => {
    const group = createDefaultGroup("New Group");

    assert.notStrictEqual(group.id, undefined);
    assert.notStrictEqual(group.id, "");
    assert.strictEqual(group.name, "New Group");
  });
});
