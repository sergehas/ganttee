import * as assert from "assert";
import { makeUpdater } from "../webview/hooks/useFieldUpdater";

suite("useFieldUpdater", () => {
  test("applies changed key while preserving other fields", () => {
    const original = {
      id: "t1",
      name: "Initial",
      start: "2026-01-01",
    };
    let updatedEntity = original;

    const updateField = makeUpdater(original, (updated) => {
      updatedEntity = updated;
    });

    updateField("name", "Renamed");

    assert.deepStrictEqual(updatedEntity, {
      id: "t1",
      name: "Renamed",
      start: "2026-01-01",
    });
    assert.notStrictEqual(updatedEntity, original);
  });
});
