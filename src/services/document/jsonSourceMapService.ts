/**
 * Maps authored JSON paths to offsets in the original, untrimmed text.
 *
 * The scanner is a strict JSON reader that records where each value starts and
 * ends. It accepts the same leading and trailing whitespace that the document
 * parser trims, so offsets always refer to the text the user sees.
 */

import { SourcePath } from "@common/models/diagnostics";

/** A scanned JSON value and its span in the original text. */
export interface JsonSourceNode {
  /** Structural kind of the value. */
  readonly type: "object" | "array" | "value";
  /** Offset of the first character of the value. */
  readonly start: number;
  /** Offset just after the last character of the value. */
  readonly end: number;
  /** Object properties; the last duplicate key wins, as in `JSON.parse`. */
  readonly properties?: ReadonlyMap<string, JsonSourceNode>;
  /** Array elements. */
  readonly items?: readonly JsonSourceNode[];
}

/** Result of scanning a text: a root node, or the offset of the first syntax error. */
export type JsonScanResult =
  | { readonly ok: true; readonly root: JsonSourceNode }
  | { readonly ok: false; readonly errorOffset: number };

/** One-based line and column of an offset. */
export interface TextPosition {
  /** One-based line. */
  readonly line: number;
  /** One-based column (UTF-16 units). */
  readonly column: number;
}

/** Internal signal for a syntax error at an offset. */
class JsonSyntaxError extends Error {
  /**
   * @param offset Offset of the unexpected character.
   */
  constructor(readonly offset: number) {
    super("JSON syntax error");
  }
}

const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const LITERALS = ["true", "false", "null"] as const;
const ESCAPES = new Set(['"', "\\", "/", "b", "f", "n", "r", "t"]);
const HEX = /^[0-9a-fA-F]{4}$/;

/** Strict JSON scanner over one text. */
class JsonScanner {
  /** Current offset. */
  private offset: number;

  /**
   * @param text The text to scan.
   * @param start Offset of the first non-whitespace character.
   * @param end Offset just after the last non-whitespace character.
   */
  constructor(
    private readonly text: string,
    start: number,
    private readonly end: number,
  ) {
    this.offset = start;
  }

  /** Scans the single top-level value and requires nothing after it. */
  scanDocument(): JsonSourceNode {
    const root = this.value();
    this.skipWhitespace();
    if (this.offset !== this.end) {
      throw new JsonSyntaxError(this.offset);
    }
    return root;
  }

  /** Scans any JSON value. */
  private value(): JsonSourceNode {
    this.skipWhitespace();
    const char = this.peek();
    if (char === "{") {
      return this.object();
    }
    if (char === "[") {
      return this.array();
    }
    if (char === '"') {
      const start = this.offset;
      this.string();
      return { type: "value", start, end: this.offset };
    }
    return this.scalar();
  }

  /** Scans an object. */
  private object(): JsonSourceNode {
    const start = this.offset;
    this.offset += 1;
    const properties = new Map<string, JsonSourceNode>();
    this.skipWhitespace();
    if (this.peek() === "}") {
      this.offset += 1;
      return { type: "object", start, end: this.offset, properties };
    }
    for (;;) {
      this.skipWhitespace();
      if (this.peek() !== '"') {
        throw new JsonSyntaxError(this.offset);
      }
      const key = this.string();
      this.skipWhitespace();
      this.expect(":");
      properties.set(key, this.value());
      this.skipWhitespace();
      if (this.peek() === ",") {
        this.offset += 1;
        continue;
      }
      this.expect("}");
      return { type: "object", start, end: this.offset, properties };
    }
  }

  /** Scans an array. */
  private array(): JsonSourceNode {
    const start = this.offset;
    this.offset += 1;
    const items: JsonSourceNode[] = [];
    this.skipWhitespace();
    if (this.peek() === "]") {
      this.offset += 1;
      return { type: "array", start, end: this.offset, items };
    }
    for (;;) {
      items.push(this.value());
      this.skipWhitespace();
      if (this.peek() === ",") {
        this.offset += 1;
        continue;
      }
      this.expect("]");
      return { type: "array", start, end: this.offset, items };
    }
  }

  /** Scans a string and returns its decoded value. */
  private string(): string {
    const start = this.offset;
    this.offset += 1;
    while (this.offset < this.end) {
      const char = this.text[this.offset];
      if (char === '"') {
        this.offset += 1;
        return JSON.parse(this.text.slice(start, this.offset)) as string;
      }
      if (char.charCodeAt(0) < 0x20) {
        throw new JsonSyntaxError(this.offset);
      }
      if (char === "\\") {
        this.escape();
        continue;
      }
      this.offset += 1;
    }
    throw new JsonSyntaxError(this.offset);
  }

  /** Validates one escape sequence starting at the backslash. */
  private escape(): void {
    const next = this.text[this.offset + 1];
    if (next === "u" && HEX.test(this.text.slice(this.offset + 2, this.offset + 6))) {
      this.offset += 6;
      return;
    }
    if (next !== undefined && ESCAPES.has(next)) {
      this.offset += 2;
      return;
    }
    throw new JsonSyntaxError(this.offset);
  }

  /** Scans a number or literal. */
  private scalar(): JsonSourceNode {
    const start = this.offset;
    for (const literal of LITERALS) {
      if (this.text.startsWith(literal, start)) {
        this.offset += literal.length;
        return { type: "value", start, end: this.offset };
      }
    }
    NUMBER.lastIndex = start;
    const match = NUMBER.exec(this.text);
    if (match === null || match[0].length === 0) {
      throw new JsonSyntaxError(start);
    }
    this.offset += match[0].length;
    return { type: "value", start, end: this.offset };
  }

  /** Requires one character. */
  private expect(char: string): void {
    if (this.peek() !== char) {
      throw new JsonSyntaxError(this.offset);
    }
    this.offset += 1;
  }

  /** Returns the current character, or an empty string at the end. */
  private peek(): string {
    return this.offset < this.end ? this.text[this.offset] : "";
  }

  /** Skips JSON whitespace. */
  private skipWhitespace(): void {
    while (this.offset < this.end && " \t\n\r".includes(this.text[this.offset])) {
      this.offset += 1;
    }
  }
}

/**
 * Scans a document text into a source map.
 *
 * @param text The untrimmed document text.
 * @returns The root node, or the offset of the first syntax error.
 */
export function scanJson(text: string): JsonScanResult {
  const start = text.length - text.trimStart().length;
  const end = text.trimEnd().length;
  try {
    return { ok: true, root: new JsonScanner(text, start, Math.max(start, end)).scanDocument() };
  } catch (error) {
    if (error instanceof JsonSyntaxError) {
      return { ok: false, errorOffset: error.offset };
    }
    throw error;
  }
}

/**
 * Finds the node at a path.
 *
 * @param root The scanned root.
 * @param path Object keys and array indices.
 * @returns The node, or `undefined` when the path does not exist.
 */
export function nodeAt(root: JsonSourceNode, path: SourcePath): JsonSourceNode | undefined {
  let node: JsonSourceNode | undefined = root;
  for (const segment of path) {
    node = typeof segment === "number" ? node?.items?.[segment] : node?.properties?.get(segment);
    if (node === undefined) {
      return undefined;
    }
  }
  return node;
}

/**
 * Returns the one-based line and column of an offset.
 *
 * @param text The text.
 * @param offset The offset, clamped into the text.
 */
export function positionAt(text: string, offset: number): TextPosition {
  const clamped = Math.min(Math.max(0, offset), text.length);
  let line = 1;
  let lineStart = 0;
  for (let index = 0; index < clamped; index += 1) {
    if (text[index] === "\n") {
      line += 1;
      lineStart = index + 1;
    }
  }
  return { line, column: clamped - lineStart + 1 };
}
