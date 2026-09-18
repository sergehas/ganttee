import { generateId } from "@common/idFactory";
import * as assert from "assert";

suite("idFactory", () => {
  test("generateId returns unique UUIDs", () => {
    const firstId = generateId();
    const secondId = generateId();

    assert.match(firstId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.match(
      secondId,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    assert.notStrictEqual(firstId, secondId);
  });
});
