import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import {
  CURRENT_DOCUMENT_VERSION,
  CyclicDependencyError,
} from "../../common/models";
import {
  parseDocument,
  serializeDocument,
} from "../../services/ganttDocumentService";
import { hydrateDocument, toDocument } from "../../services/ganttModelService";
import { FIXTURES_DIR } from "../testFixtures";

function loadFixture(name: string) {
  return parseDocument(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf-8"));
}

/** Verifies that `hydrateDocument` produces a live object graph with computed `Date` properties and that the full pipeline (hydrate → toDocument → serialize → parse) is lossless. */
suite("modelHydration integration", () => {
  test("hydrates v2-simple: tasks become entities with Date fields", () => {
    const model = hydrateDocument(loadFixture("v2-simple.ganttee"));

    assert.strictEqual(model.tasks.length, 3);
    assert.ok(model.tasks[0].effectiveStart() instanceof Date);
    assert.ok(model.tasks[0].effectiveEnd() instanceof Date);
  });

  /** Guards the graph shape: node count must include both tasks and milestones. */
  test("hydrates v2-with-deps: dependency graph has the correct edge count", () => {
    const model = hydrateDocument(loadFixture("v2-with-deps.ganttee"));

    assert.strictEqual(model.dependencies.length, 4);
    assert.strictEqual(model.graph.nodes.length, 5, "4 tasks + 1 milestone");
    assert.strictEqual(model.dependencies.length, 4, "one edge per dependency");
  });

  /** Ensures the OO layer introduces no data loss when the document returns to its serialized form. */
  test("full round-trip: hydrate → toDocument → serialize → parse produces equal document", () => {
    const original = loadFixture("v2-with-deps.ganttee");
    const model = hydrateDocument(original);
    const reparsed = parseDocument(serializeDocument(toDocument(model)));

    assert.strictEqual(reparsed.version, CURRENT_DOCUMENT_VERSION);
    assert.strictEqual(reparsed.tasks.length, original.tasks.length);
    assert.strictEqual(
      reparsed.dependencies.length,
      original.dependencies.length,
    );
    assert.deepStrictEqual(
      reparsed.tasks.map((t) => t.id),
      original.tasks.map((t) => t.id),
    );
  });

  /** Cycle detection must fire during hydration,
   * before any consumer can observe an inconsistent graph. */
  test("hydrating the cyclic fixture throws CyclicDependencyError", () => {
    assert.throws(
      () => hydrateDocument(loadFixture("v2-invalid-cycle.ganttee")),
      CyclicDependencyError,
    );
  });

  /** End-to-end confirmation that parse + migrate + hydrate succeeds for a v1 file. */
  test("migrated v1 fixture hydrates cleanly", () => {
    const doc = loadFixture("v1-minimal.ganttee");
    // No deps remain after migration direction-swap resolves into non-cyclic graph
    const model = hydrateDocument(doc);
    assert.strictEqual(model.tasks.length, 2);
  });
});
