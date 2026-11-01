import { nodeAt, positionAt, scanJson } from "@services/document/jsonSourceMapService";
import * as assert from "assert";

suite("jsonSourceMapService", () => {
  test("maps object properties and array items to offsets in the untrimmed text", () => {
    const text = '\n  {"tasks": [{"id": "a", "n": 1.5e3}, true], "x": null}  \n';
    const scan = scanJson(text);
    assert.ok(scan.ok);
    const id = nodeAt(scan.root, ["tasks", 0, "id"]);
    assert.ok(id);
    assert.strictEqual(text.slice(id.start, id.end), '"a"');
    const number = nodeAt(scan.root, ["tasks", 0, "n"]);
    assert.ok(number);
    assert.strictEqual(text.slice(number.start, number.end), "1.5e3");
    const literal = nodeAt(scan.root, ["tasks", 1]);
    assert.ok(literal);
    assert.strictEqual(text.slice(literal.start, literal.end), "true");
    assert.strictEqual(nodeAt(scan.root, ["x"])?.type, "value");
    assert.strictEqual(nodeAt(scan.root, []), scan.root);
  });

  test("returns undefined for missing paths and wrong container kinds", () => {
    const scan = scanJson('{"a": [1], "b": {}}');
    assert.ok(scan.ok);
    assert.strictEqual(nodeAt(scan.root, ["missing"]), undefined);
    assert.strictEqual(nodeAt(scan.root, ["a", 4]), undefined);
    assert.strictEqual(nodeAt(scan.root, ["a", "key"]), undefined);
    assert.strictEqual(nodeAt(scan.root, ["b", 0]), undefined);
  });

  test("lets the last duplicate key win like JSON.parse", () => {
    const text = '{"a": 1, "a": 22}';
    const scan = scanJson(text);
    assert.ok(scan.ok);
    const node = nodeAt(scan.root, ["a"]);
    assert.ok(node);
    assert.strictEqual(text.slice(node.start, node.end), "22");
  });

  test("accepts escapes, empty containers, and a byte order mark", () => {
    const scan = scanJson('\uFEFF{"s": "q\\"\\n\\u00e9\\/", "e": [], "o": {}, "n": -0}');
    assert.ok(scan.ok);
    assert.strictEqual(scan.root.properties?.get("e")?.items?.length, 0);
    assert.strictEqual(scan.root.properties?.get("o")?.properties?.size, 0);
  });

  const invalid: readonly [string, string, number][] = [
    ["trailing comma in object", '{"a": 1,}', 8],
    ["trailing comma in array", "[1,]", 3],
    ["unquoted key", "{a: 1}", 1],
    ["missing colon", '{"a" 1}', 5],
    ["unterminated string", '{"a": "b', 8],
    ["control character in string", '"a\u0001"', 2],
    ["bad escape", '"\\x"', 1],
    ["bad unicode escape", '"\\u12"', 1],
    ["leading zero number", "01", 1],
    ["bare word", "nope", 0],
    ["trailing content", "{} {}", 3],
    ["missing array close", "[1 2]", 3],
    ["missing object close", '{"a": 1 "b": 2}', 8],
  ];
  for (const [name, text, offset] of invalid) {
    test(`reports the error offset for ${name}`, () => {
      const scan = scanJson(text);
      assert.deepStrictEqual(scan, { ok: false, errorOffset: offset });
    });
  }

  test("reports an empty text as an error at its start", () => {
    assert.deepStrictEqual(scanJson("   "), { ok: false, errorOffset: 3 });
  });

  test("computes one-based line and column positions", () => {
    const text = '{\n  "a": x\n}';
    assert.deepStrictEqual(positionAt(text, 0), { line: 1, column: 1 });
    assert.deepStrictEqual(positionAt(text, text.indexOf("x")), { line: 2, column: 8 });
    assert.deepStrictEqual(positionAt(text, -5), { line: 1, column: 1 });
    assert.deepStrictEqual(positionAt(text, 999), { line: 3, column: 2 });
  });
});
