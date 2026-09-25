import {
  makeMultiUpdater,
  makeUpdater,
} from "@webview/features/entity-editor/hooks/useFieldUpdater";
import * as assert from "assert";

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

  test("applies multiple changed keys without mutating the original", () => {
    const original = {
      id: "t1",
      name: "Initial",
      start: "2026-01-01",
    };
    let updatedEntity = original;

    const updateFields = makeMultiUpdater(original, (updated) => {
      updatedEntity = updated;
    });

    updateFields({ name: "Renamed", start: "2026-02-01" });

    assert.deepStrictEqual(updatedEntity, {
      id: "t1",
      name: "Renamed",
      start: "2026-02-01",
    });
    assert.deepStrictEqual(original, {
      id: "t1",
      name: "Initial",
      start: "2026-01-01",
    });
    assert.notStrictEqual(updatedEntity, original);
  });
});
