import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { CURRENT_DOCUMENT_VERSION } from "../../common/models";
import {
  parseDocument,
  serializeDocument,
} from "../../services/ganttDocumentService";
import { FIXTURES_DIR } from "../testFixtures";

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), "utf-8");
}

/** Verifies that `parseDocument` handles all supported file versions and
 * that parsed output satisfies the webview `init` protocol shape. */
suite("documentLoad integration", () => {
  test("loads and migrates a v1 fixture to the current version", () => {
    const doc = parseDocument(readFixture("v1-minimal.ganttee"));

    assert.strictEqual(doc.version, CURRENT_DOCUMENT_VERSION);
    assert.strictEqual(doc.tasks.length, 2);
    assert.strictEqual(doc.tasks[0].name, "Analysis");
    assert.strictEqual(doc.tasks[1].name, "Development");
    assert.strictEqual(doc.milestones[0].name, "Kickoff");
    assert.strictEqual(doc.groups[0].id, "g1");
    assert.strictEqual(doc.groups[0].groupId, undefined);
  });

  /** Migration must correct the semantic direction of the dependency,
   *  not just rename the type.
   **/
  test("v1 fixture deps: direction swapped and finishWith renamed to endWith", () => {
    const doc = parseDocument(readFixture("v1-minimal.ganttee"));

    // finishWith → endWith, source/target direction swapped
    assert.strictEqual(doc.dependencies.length, 1);
    assert.strictEqual(doc.dependencies[0].type, "endWith");
    assert.strictEqual(doc.dependencies[0].sourceId, "t2");
    assert.strictEqual(doc.dependencies[0].targetId, "t1");
  });

  test("loads a v2 simple fixture with the expected entity counts", () => {
    const doc = parseDocument(readFixture("v2-simple.ganttee"));

    assert.strictEqual(doc.version, 2);
    assert.strictEqual(doc.tasks.length, 3);
    assert.strictEqual(doc.groups.length, 1);
    assert.strictEqual(doc.milestones.length, 1);
    assert.strictEqual(doc.dependencies.length, 0);
  });

  test("loads a v2 with-deps fixture with all four dependency types", () => {
    const doc = parseDocument(readFixture("v2-with-deps.ganttee"));

    const types = doc.dependencies.map((d) => d.type);
    assert.ok(types.includes("startAfter"), "missing startAfter");
    assert.ok(types.includes("startWith"), "missing startWith");
    assert.ok(types.includes("endWith"), "missing endWith");
    assert.ok(types.includes("endBefore"), "missing endBefore");
  });

  /** `serializeDocument → parseDocument` must be lossless for a document without dependencies. */
  test("round-trips v2-simple through serialize and parse", () => {
    const original = parseDocument(readFixture("v2-simple.ganttee"));
    const reparsed = parseDocument(serializeDocument(original));

    assert.deepStrictEqual(reparsed, original);
  });

  /** Same losslessness guarantee for a fixture that exercises all four dependency types. */
  test("round-trips v2-with-deps through serialize and parse", () => {
    const original = parseDocument(readFixture("v2-with-deps.ganttee"));
    const reparsed = parseDocument(serializeDocument(original));

    assert.deepStrictEqual(reparsed, original);
  });

  /** Guards against accidental removal of fields the host sends in the `{ type: "init", document }` message. */
  test("webview init payload shape: parsed document has required protocol fields", () => {
    const doc = parseDocument(readFixture("v2-simple.ganttee"));

    // These are the exact fields the host sends in { type: "init", document }
    assert.ok("version" in doc);
    assert.ok(Array.isArray(doc.tasks));
    assert.ok(Array.isArray(doc.groups));
    assert.ok(Array.isArray(doc.milestones));
    assert.ok(Array.isArray(doc.dependencies));
  });
});
