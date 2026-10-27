import { buildDependency } from "@services/editing/dependencyFactoryService";
import * as assert from "assert";

suite("dependencyFactoryService", () => {
  test("builds dependency only when owner and target are present", () => {
    const dependency = buildDependency("t1", "m1", "startAfter", () => "dep-test");
    const missingOwner = buildDependency(undefined, "m1", "startAfter", () => "dep-test");
    const missingTarget = buildDependency("t1", "", "startAfter", () => "dep-test");

    assert.deepStrictEqual(dependency, {
      id: "dep-test",
      sourceId: "t1",
      targetId: "m1",
      type: "startAfter",
    });
    assert.strictEqual(missingOwner, undefined);
    assert.strictEqual(missingTarget, undefined);
  });
});
