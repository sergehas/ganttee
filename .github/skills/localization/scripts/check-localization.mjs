import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/** Adds one stable diagnostic with an optional source location. */
function report(diagnostics, severity, file, message, node) {
  const position = node?.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
  diagnostics.push({
    severity,
    file,
    line: position === undefined ? undefined : position.line + 1,
    message,
  });
}

/** Reads a flat catalog while retaining duplicate-property diagnostics. */
export function readCatalog(file, diagnostics) {
  const text = readFileSync(file, "utf8");
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    report(diagnostics, "error", file, `Invalid JSON: ${error.message}`);
    return undefined;
  }
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    report(diagnostics, "error", file, "Catalog must be a flat object of strings.");
    return undefined;
  }
  const syntax = ts.createSourceFile(file, text, ts.ScriptTarget.JSON, true, ts.ScriptKind.JSON);
  const seen = new Set();
  for (const property of syntax.statements[0].expression.properties) {
    const key = property.name.text;
    if (seen.has(key)) {
      report(diagnostics, "error", file, `Duplicate key ${JSON.stringify(key)}.`, property);
    }
    seen.add(key);
  }
  for (const [key, translation] of Object.entries(value)) {
    if (typeof translation !== "string" || translation.trim().length === 0) {
      report(diagnostics, "error", file, `Key ${JSON.stringify(key)} needs a nonempty string.`);
    } else if (/[{}]/.test(translation.replace(/\{\d+\}/g, ""))) {
      report(diagnostics, "error", file, `Unsupported placeholder for ${JSON.stringify(key)}.`);
    }
  }
  return value;
}

/** Returns sorted placeholder tokens, including repeated occurrences. */
function placeholders(value) {
  return [...value.matchAll(/\{[^{}]*\}/g)].map(([token]) => token).sort();
}

/** Checks exact key and placeholder parity without pretending to assess language quality. */
export function compareCatalogs(reference, localized, file, diagnostics) {
  for (const key of Object.keys(reference)) {
    if (!Object.hasOwn(localized, key)) {
      report(diagnostics, "error", file, `Missing key ${JSON.stringify(key)}.`);
      continue;
    }
    const source = reference[key];
    const target = localized[key];
    if (typeof source !== "string" || typeof target !== "string") {
      continue;
    }
    const sourceTokens = placeholders(source);
    const targetTokens = placeholders(target);
    if (JSON.stringify(sourceTokens) !== JSON.stringify(targetTokens)) {
      report(diagnostics, "error", file, `Placeholder mismatch for ${JSON.stringify(key)}.`);
    }
    if ([...sourceTokens, ...targetTokens].some((token) => !/^\{\d+\}$/.test(token))) {
      report(diagnostics, "error", file, `Unsupported placeholder for ${JSON.stringify(key)}.`);
    }
    if (target === source) {
      report(diagnostics, "warning", file, `Review unchanged English for ${JSON.stringify(key)}.`);
    }
  }
  for (const key of Object.keys(localized)) {
    if (!Object.hasOwn(reference, key)) {
      report(diagnostics, "error", file, `Extra key ${JSON.stringify(key)}.`);
    }
  }
}

/** Collects manifest placeholders only from actual JSON string values. */
export function manifestKeys(manifest) {
  const result = new Set();
  const visit = (value) => {
    if (typeof value === "string") {
      for (const [, key] of value.matchAll(/%([^%\s]+)%/g)) {
        result.add(key);
      }
    } else if (value !== null && typeof value === "object") {
      Object.values(value).forEach(visit);
    }
  };
  visit(manifest);
  return result;
}

/** Visits production TypeScript and TSX files, excluding tests and declaration files. */
function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return ["test", "tests", "__tests__", "node_modules"].includes(entry.name)
          ? []
          : sourceFiles(file);
      }
      return /(?<!\.d)\.tsx?$/.test(entry.name) &&
        !/\.(?:test|integrationTest|spec)\.tsx?$/.test(entry.name)
        ? [file]
        : [];
    });
}

/** Follows imported aliases to their declarations. */
function symbolOf(checker, node) {
  const symbol = checker.getSymbolAtLocation(node);
  return symbol?.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

/** Maximum number of keys one expression may resolve to before it is treated as unbounded. */
const MAX_KEYS = 512;

/** Collects a finite string union; `never` contributes no keys, any open constituent fails. */
function finiteType(type) {
  if (type.flags & ts.TypeFlags.Never) {
    return [];
  }
  if (type.isStringLiteral()) {
    return [type.value];
  }
  if (type.isUnion()) {
    const members = type.types.map(finiteType);
    return members.every((member) => member !== undefined) ? members.flat() : undefined;
  }
  return undefined;
}

/** Recognizes the repository's typed translator aliases and inline webview callbacks. */
function isTranslatorType(type) {
  if (["WebviewTranslator", "Translate"].includes(type?.aliasSymbol?.name)) {
    return true;
  }
  return type?.getCallSignatures().some((signature) => {
    const declaration = signature.declaration;
    const parent = declaration?.parent;
    return (
      declaration !== undefined &&
      ts.isFunctionTypeNode(declaration) &&
      (ts.isParameter(parent) || ts.isPropertySignature(parent)) &&
      parent.name.getText() === "translate" &&
      declaration.getSourceFile().fileName.replaceAll("\\", "/").includes("/src/webview/")
    );
  });
}

/** Returns the first declaration of the symbol named by a node, following import aliases. */
function declarationOf(checker, node) {
  if (ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node) {
    return checker.getShorthandAssignmentValueSymbol(node.parent)?.declarations?.[0];
  }
  return symbolOf(checker, node)?.declarations?.[0];
}

/** Removes expression wrappers that do not change a string value. */
function unwrap(node) {
  let current = node;
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isNonNullExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

/** Returns whether a variable declaration is `const`. */
function isConst(declaration) {
  return (
    ts.isVariableDeclaration(declaration) &&
    ts.isVariableDeclarationList(declaration.parent) &&
    (declaration.parent.flags & ts.NodeFlags.Const) !== 0
  );
}

/** Returns the function implementation behind a callable declaration. */
function functionOf(declaration) {
  if (declaration === undefined) {
    return undefined;
  }
  if (
    (ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration)) &&
    declaration.body
  ) {
    return declaration;
  }
  if (isConst(declaration) || ts.isPropertyAssignment(declaration)) {
    const initializer = unwrap(declaration.initializer);
    if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
      return initializer;
    }
  }
  return undefined;
}

/** Returns the named declaration through which a function is called, if it has one. */
function callableOf(fn) {
  if (ts.isFunctionDeclaration(fn) || ts.isMethodDeclaration(fn)) {
    return fn;
  }
  const parent = fn.parent;
  return (ts.isVariableDeclaration(parent) && isConst(parent)) || ts.isPropertyAssignment(parent)
    ? parent
    : undefined;
}

/** Returns the expressions a function can return, excluding nested functions. */
function returnExpressions(fn) {
  if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) {
    return [fn.body];
  }
  const result = [];
  const visit = (node) => {
    if (ts.isReturnStatement(node)) {
      if (node.expression) {
        result.push(node.expression);
      }
    } else if (!ts.isFunctionLike(node)) {
      ts.forEachChild(node, visit);
    }
  };
  ts.forEachChild(fn.body, visit);
  return result;
}

/** Appends a value to a multimap. */
function push(map, key, value) {
  if (key !== undefined) {
    map.set(key, [...(map.get(key) ?? []), value]);
  }
}

/** Returns whether an identifier only names a callee, a declaration, or an import/export. */
function isPassiveReference(node) {
  const parent = node.parent;
  if (
    (ts.isCallExpression(parent) && parent.expression === node) ||
    (ts.isPropertyAccessExpression(parent) &&
      parent.name === node &&
      ts.isCallExpression(parent.parent) &&
      parent.parent.expression === parent) ||
    ts.isImportSpecifier(parent) ||
    ts.isImportClause(parent) ||
    ts.isNamespaceImport(parent) ||
    ts.isExportSpecifier(parent)
  ) {
    return true;
  }
  return "name" in parent && parent.name === node && !ts.isPropertyAccessExpression(parent);
}

/**
 * Indexes the production program once: call sites per callable, escaped callables, object-literal
 * values per declared property, and assignment targets that make a value mutable.
 */
function indexProgram(checker, sources) {
  const calls = new Map();
  const escaped = new Set();
  const literals = new Map();
  const written = new Set();
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      push(calls, declarationOf(checker, node.expression), node);
    } else if (ts.isObjectLiteralExpression(node)) {
      const contextual = checker.getContextualType(node);
      const types =
        contextual === undefined ? [] : contextual.isUnion() ? contextual.types : [contextual];
      for (const property of node.properties) {
        if (
          (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) &&
          !ts.isComputedPropertyName(property.name)
        ) {
          const value = ts.isPropertyAssignment(property) ? property.initializer : property.name;
          for (const type of types) {
            const target = type.getProperty(property.name.text)?.declarations?.[0];
            if (target !== undefined && target !== property) {
              push(literals, target, value);
            }
          }
        }
      }
    } else if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      const target = unwrap(node.left);
      if (ts.isPropertyAccessExpression(target)) {
        written.add(declarationOf(checker, target.name));
      } else if (ts.isElementAccessExpression(target)) {
        written.add(declarationOf(checker, unwrap(target.expression)));
      } else if (ts.isIdentifier(target)) {
        written.add(declarationOf(checker, target));
      }
    } else if (ts.isIdentifier(node) && !isPassiveReference(node)) {
      const declaration = declarationOf(checker, node);
      if (functionOf(declaration) !== undefined) {
        escaped.add(declaration);
      }
    }
    ts.forEachChild(node, visit);
  };
  sources.forEach(visit);
  written.delete(undefined);
  return { calls, escaped, literals, written };
}

/** Applies a supported side-effect-free string method to resolved receivers. */
function stringMethod(name, receivers, args) {
  const numbers = args.map((arg) => (ts.isNumericLiteral(arg) ? Number(arg.text) : undefined));
  if (numbers.some((value) => value === undefined)) {
    return undefined;
  }
  const methods = {
    toUpperCase: (value) => value.toUpperCase(),
    toLowerCase: (value) => value.toLowerCase(),
    trim: (value) => value.trim(),
    charAt: (value) => value.charAt(...numbers),
    slice: (value) => value.slice(...numbers),
    substring: (value) => value.substring(...numbers),
  };
  return Object.hasOwn(methods, name) ? receivers.map(methods[name]) : undefined;
}

/** Unions resolved value lists; any unresolved part or an oversized result is unbounded. */
function union(parts) {
  if (parts.some((part) => part === undefined)) {
    return undefined;
  }
  const result = [...new Set(parts.flat())];
  return result.length <= MAX_KEYS ? result : undefined;
}

/**
 * Creates a bounded resolver for translation arguments. It follows const values, object
 * registries, function returns, parameter call sites, and typed object-literal properties, and it
 * refuses anything mutable, escaped, or open-ended rather than guessing.
 */
function createResolver(checker, index) {
  /** Resolves the possible values of an object-literal property. */
  const propertyValues = (objects, names, env, visiting) =>
    union(
      objects.flatMap((object) =>
        names.map((name) => {
          const property = object.properties.find(
            (item) =>
              (ts.isPropertyAssignment(item) || ts.isShorthandPropertyAssignment(item)) &&
              !ts.isComputedPropertyName(item.name) &&
              item.name.text === name,
          );
          if (property === undefined) {
            return object.properties.some(ts.isSpreadAssignment) ? undefined : [];
          }
          const value = ts.isPropertyAssignment(property) ? property.initializer : property.name;
          return strings(value, env, visiting);
        }),
      ),
    );

  /** Resolves property names selected by an element access, or every name when open. */
  const selectedNames = (objects, argument, env, visiting) =>
    strings(argument, env, visiting) ??
    objects.flatMap((object) =>
      object.properties
        .filter((item) => item.name !== undefined && !ts.isComputedPropertyName(item.name))
        .map((item) => item.name.text),
    );

  /** Resolves an expression to the object literals it may denote. */
  const objects = (node, env, visiting) => {
    node = unwrap(node);
    if (node === undefined || visiting.has(node)) {
      return undefined;
    }
    const next = new Set(visiting).add(node);
    if (ts.isObjectLiteralExpression(node)) {
      return [node];
    }
    if (ts.isConditionalExpression(node)) {
      const parts = [objects(node.whenTrue, env, next), objects(node.whenFalse, env, next)];
      return parts.every(Boolean) ? parts.flat() : undefined;
    }
    if (ts.isIdentifier(node)) {
      const declaration = declarationOf(checker, node);
      return declaration && isConst(declaration) && !index.written.has(declaration)
        ? objects(declaration.initializer, env, next)
        : undefined;
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const written = ts.isPropertyAccessExpression(node)
        ? index.written.has(declarationOf(checker, node.name))
        : index.written.has(declarationOf(checker, unwrap(node.expression)));
      const bases = written ? undefined : objects(node.expression, env, next);
      if (bases === undefined) {
        return undefined;
      }
      const names = ts.isPropertyAccessExpression(node)
        ? [node.name.text]
        : selectedNames(bases, node.argumentExpression, env, next);
      const values = bases.flatMap((base) =>
        names.map((name) => {
          const property = base.properties.find(
            (item) => ts.isPropertyAssignment(item) && item.name.text === name,
          );
          return property === undefined ? [] : objects(property.initializer, env, next);
        }),
      );
      return values.every(Boolean) ? values.flat() : undefined;
    }
    return undefined;
  };

  /** Resolves a declared property from every object literal typed against it. */
  const declaredProperty = (declaration, visiting) => {
    if (declaration === undefined || index.written.has(declaration)) {
      return undefined;
    }
    const values = [
      ...("initializer" in declaration && declaration.initializer ? [declaration.initializer] : []),
      ...(index.literals.get(declaration) ?? []),
    ];
    return values.length === 0
      ? undefined
      : union(values.map((value) => strings(value, new Map(), visiting)));
  };

  /** Resolves a parameter from every call site of a function that never escapes as a value. */
  const parameter = (declaration, visiting) => {
    const fn = declaration.parent;
    const callable = callableOf(fn);
    const position = fn.parameters.indexOf(declaration);
    const calls = callable === undefined ? [] : (index.calls.get(callable) ?? []);
    if (declaration.dotDotDotToken || calls.length === 0 || index.escaped.has(callable)) {
      return undefined;
    }
    return union(
      calls.map((call) => {
        const spread = call.arguments.findIndex(ts.isSpreadElement);
        const argument = call.arguments[position] ?? declaration.initializer;
        return (spread >= 0 && spread <= position) || argument === undefined
          ? undefined
          : strings(argument, new Map(), visiting);
      }),
    );
  };

  /** Resolves an identifier through its declaration. */
  const identifier = (node, visiting) => {
    const declaration = declarationOf(checker, node);
    if (declaration === undefined) {
      return undefined;
    }
    if (ts.isVariableDeclaration(declaration)) {
      return isConst(declaration) && !index.written.has(declaration)
        ? strings(declaration.initializer, new Map(), visiting)
        : undefined;
    }
    if (ts.isParameter(declaration) && ts.isIdentifier(declaration.name)) {
      return parameter(declaration, visiting);
    }
    if (ts.isBindingElement(declaration) && ts.isObjectBindingPattern(declaration.parent)) {
      const name = (declaration.propertyName ?? declaration.name).getText();
      const property = checker.getTypeAtLocation(declaration.parent).getProperty(name);
      return declaredProperty(property?.declarations?.[0], visiting);
    }
    return undefined;
  };

  /** Resolves a call through a string method or the called function's return values. */
  const call = (node, env, visiting) => {
    const callee = unwrap(node.expression);
    if (ts.isPropertyAccessExpression(callee)) {
      const receivers = strings(callee.expression, env, visiting);
      const result = receivers && stringMethod(callee.name.text, receivers, node.arguments);
      if (result !== undefined) {
        return result;
      }
    }
    const fn = functionOf(declarationOf(checker, callee));
    const returns = fn === undefined ? [] : returnExpressions(fn);
    return returns.length === 0
      ? undefined
      : union(returns.map((value) => strings(value, new Map(), visiting)));
  };

  /** Resolves concatenations, binding repeated variables to one value at a time. */
  const concatenation = (node, env, visiting) => {
    const uses = new Map();
    const collect = (child) => {
      if (ts.isIdentifier(child)) {
        const declaration = declarationOf(checker, child);
        if (declaration !== undefined && !env.has(declaration)) {
          uses.set(declaration, [...(uses.get(declaration) ?? []), child]);
        }
      } else if (ts.isPropertyAccessExpression(child)) {
        collect(child.expression);
      } else if (!ts.isFunctionLike(child)) {
        ts.forEachChild(child, collect);
      }
    };
    collect(node);
    let bindings = [env];
    for (const [declaration, nodes] of uses) {
      if (nodes.length > 1) {
        const values = strings(nodes[0], env, visiting);
        if (values === undefined) {
          return undefined;
        }
        bindings = bindings.flatMap((binding) =>
          values.map((value) => new Map(binding).set(declaration, value)),
        );
        if (bindings.length > MAX_KEYS) {
          return undefined;
        }
      }
    }
    return union(bindings.map((binding) => concatenate(node, binding, visiting)));
  };

  /** Builds every concatenation of independently resolved parts. */
  const concatenate = (node, env, visiting) => {
    const parts = ts.isBinaryExpression(node)
      ? [node.left, node.right]
      : [node.head, ...node.templateSpans.flatMap((span) => [span.expression, span.literal])];
    let results = [""];
    for (const part of parts) {
      const values =
        ts.isTemplateHead(part) || ts.isTemplateMiddle(part) || ts.isTemplateTail(part)
          ? [part.text]
          : strings(part, env, visiting);
      if (values === undefined || results.length * values.length > MAX_KEYS) {
        return undefined;
      }
      results = results.flatMap((prefix) => values.map((value) => prefix + value));
    }
    return results;
  };

  /** Resolves every string an expression may evaluate to, or `undefined` when unbounded. */
  const strings = (node, env, visiting) => {
    node = unwrap(node);
    if (node === undefined || visiting.has(node)) {
      return undefined;
    }
    const next = new Set(visiting).add(node);
    if (ts.isStringLiteralLike(node)) {
      return [node.text];
    }
    if (ts.isConditionalExpression(node)) {
      return union([strings(node.whenTrue, env, next), strings(node.whenFalse, env, next)]);
    }
    if (
      (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) ||
      ts.isTemplateExpression(node)
    ) {
      return concatenation(node, env, next);
    }
    if (ts.isIdentifier(node)) {
      const declaration = declarationOf(checker, node);
      if (env.has(declaration)) {
        return [env.get(declaration)];
      }
    }
    const typed = finiteType(checker.getTypeAtLocation(node));
    if (typed !== undefined) {
      return typed;
    }
    if (ts.isIdentifier(node)) {
      return identifier(node, next);
    }
    if (ts.isCallExpression(node)) {
      return call(node, env, next);
    }
    if (ts.isElementAccessExpression(node) && ts.isNumericLiteral(node.argumentExpression)) {
      const position = Number(node.argumentExpression.text);
      const receivers = strings(node.expression, env, next);
      return receivers?.every((value) => position < value.length)
        ? receivers.map((value) => value[position])
        : undefined;
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const declaration = ts.isPropertyAccessExpression(node)
        ? declarationOf(checker, node.name)
        : undefined;
      if (declaration !== undefined && index.written.has(declaration)) {
        return undefined;
      }
      const bases = objects(node.expression, env, next);
      if (bases !== undefined) {
        const names = ts.isPropertyAccessExpression(node)
          ? [node.name.text]
          : selectedNames(bases, node.argumentExpression, env, next);
        return propertyValues(bases, names, env, next);
      }
      return declaredProperty(declaration, next);
    }
    return undefined;
  };

  return (node) => {
    const result = strings(node, new Map(), new Set());
    return result?.length ? result : undefined;
  };
}

/** Determines the message argument of known localization APIs by symbol and signature. */
function translationArgument(checker, call) {
  const signature = checker.getResolvedSignature(call);
  const declaration = signature?.declaration;
  const source = declaration?.getSourceFile().fileName.replaceAll("\\", "/");
  if (
    declaration?.name?.getText() === "t" &&
    source?.endsWith("/@types/vscode/index.d.ts") &&
    declaration.parent?.parent?.name?.getText() === "l10n"
  ) {
    return 0;
  }
  const symbol = symbolOf(checker, call.expression);
  if (
    symbol?.name === "translate" &&
    symbol.declarations?.some((item) =>
      item.getSourceFile().fileName.replaceAll("\\", "/").endsWith("/webview/l10n.ts"),
    )
  ) {
    return 1;
  }
  if (isTranslatorType(checker.getTypeAtLocation(call.expression))) {
    return 0;
  }
  return undefined;
}

/** Recognizes catalog plumbing, which must never establish real string usage. */
function isCatalogBridge(node) {
  const file = node.getSourceFile().fileName.replaceAll("\\", "/");
  let owner = node.parent;
  while (owner && !ts.isFunctionDeclaration(owner)) {
    owner = owner.parent;
  }
  return (
    (file.endsWith("/views/editor/webviewL10n.ts") &&
      owner?.name?.text === "createWebviewL10nCatalog") ||
    (file.endsWith("/webview/l10n.ts") && owner?.name?.text === "useTranslate")
  );
}

/** Skips only direct typed translator forwarding; consumers are checked at their own callsites. */
function isTranslatorForwarder(checker, call, argument) {
  if (!ts.isIdentifier(argument)) {
    return false;
  }
  const parameter = symbolOf(checker, argument)?.declarations?.find(ts.isParameter);
  const owner = parameter?.parent;
  if (!owner || !ts.isArrowFunction(owner) || owner.body !== call) {
    return false;
  }
  if (
    isTranslatorType(checker.getTypeAtLocation(owner)) ||
    isTranslatorType(checker.getContextualType(owner))
  ) {
    return true;
  }
  if (ts.isCallExpression(owner.parent)) {
    const target = symbolOf(checker, owner.parent.expression);
    return (
      target?.name === "createWebviewL10nCatalog" &&
      target.declarations?.some((item) =>
        item
          .getSourceFile()
          .fileName.replaceAll("\\", "/")
          .endsWith("/views/editor/webviewL10n.ts"),
      )
    );
  }
  return false;
}

/** Repository-relative location of reviewed keys for genuinely runtime-derived arguments. */
export const EVIDENCE_FILE = ".github/skills/localization/dynamic-keys.json";

/** Normalizes source text so evidence survives reformatting. */
function normalizeSource(text) {
  return text.replace(/\s+/g, " ").trim();
}

/** Reads optional dynamic-key evidence, reporting malformed entries instead of trusting them. */
export function readEvidence(root, diagnostics) {
  const file = path.join(root, ...EVIDENCE_FILE.split("/"));
  let value;
  try {
    value = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      report(diagnostics, "error", file, `Invalid evidence: ${error.message}`);
    }
    return [];
  }
  const entries = Array.isArray(value?.entries) ? value.entries : undefined;
  if (entries === undefined) {
    report(diagnostics, "error", file, 'Evidence must be an object with an "entries" array.');
    return [];
  }
  return entries.flatMap((entry, position) => {
    const valid =
      typeof entry?.file === "string" &&
      typeof entry.argument === "string" &&
      typeof entry.reason === "string" &&
      entry.reason.trim().length > 0 &&
      Array.isArray(entry.keys) &&
      entry.keys.length > 0 &&
      entry.keys.every((key) => typeof key === "string" && key.length > 0);
    if (!valid) {
      report(
        diagnostics,
        "error",
        file,
        `Evidence entry ${position} needs file, argument, reason, and nonempty string keys.`,
      );
      return [];
    }
    return [{ ...entry, argument: normalizeSource(entry.argument), evidenceFile: file }];
  });
}

/** Audits actual runtime consumers across both host and browser TypeScript projects. */
export function runtimeKeys(root, diagnostics, evidence = []) {
  const files = sourceFiles(path.join(root, "src"));
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    resolveJsonModule: true,
    skipLibCheck: true,
    paths: {
      "@common/*": [path.join(root, "src", "common", "*")],
      "@services/*": [path.join(root, "src", "services", "*")],
      "@webview/*": [path.join(root, "src", "webview", "*")],
      "@views/*": [path.join(root, "src", "views", "*")],
      "@src/*": [path.join(root, "src", "*")],
      "@themes/*": [path.join(root, "media", "themes", "*")],
    },
  };
  const program = ts.createProgram(files, options);
  const checker = program.getTypeChecker();
  const resolve = createResolver(
    checker,
    indexProgram(
      checker,
      files.map((file) => program.getSourceFile(file)),
    ),
  );
  const matched = new Set();
  const used = new Map();
  for (const file of files) {
    const source = program.getSourceFile(file);
    const relative = path.relative(root, file).replaceAll("\\", "/");
    for (const error of source.parseDiagnostics) {
      report(
        diagnostics,
        "error",
        file,
        `Cannot audit source: ${ts.flattenDiagnosticMessageText(error.messageText, " ")}`,
      );
    }
    const visit = (node) => {
      if (ts.isCallExpression(node) && !isCatalogBridge(node)) {
        const index = translationArgument(checker, node);
        if (index !== undefined) {
          let argument = node.arguments[index];
          if (argument && ts.isObjectLiteralExpression(argument)) {
            argument = argument.properties.find(
              (property) => ts.isPropertyAssignment(property) && property.name.text === "message",
            )?.initializer;
          }
          if (argument === undefined || !isTranslatorForwarder(checker, node, argument)) {
            const proof =
              argument === undefined
                ? undefined
                : evidence.find(
                    (entry) =>
                      entry.file === relative &&
                      entry.argument === normalizeSource(argument.getText()),
                  );
            const resolved = argument === undefined ? undefined : resolve(argument);
            if (proof !== undefined && resolved === undefined) {
              matched.add(proof);
            }
            const keys = resolved ?? proof?.keys;
            if (keys === undefined) {
              report(
                diagnostics,
                "error",
                file,
                `Unresolved translation call: ${node.getText()}`,
                node,
              );
            } else {
              for (const key of keys) {
                used.set(key, { file, node });
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  for (const entry of evidence) {
    if (!matched.has(entry)) {
      report(
        diagnostics,
        "error",
        entry.evidenceFile,
        `Stale evidence for ${entry.file} argument ${JSON.stringify(entry.argument)}: no unresolved call matches it.`,
      );
    }
  }
  return used;
}

/** Compares real consumers with a reference, reporting both directions. */
function checkUsage(reference, used, file, diagnostics) {
  for (const key of used.keys()) {
    if (!Object.hasOwn(reference, key)) {
      const location = used.get(key);
      report(
        diagnostics,
        "error",
        location?.file ?? file,
        `Missing reference key ${JSON.stringify(key)}.`,
        location?.node,
      );
    }
  }
  for (const key of Object.keys(reference)) {
    if (!used.has(key)) {
      report(diagnostics, "error", file, `Unused key ${JSON.stringify(key)}.`);
    }
  }
}

/** Audits catalog parity and source usage without modifying the repository. */
export function audit(root) {
  const diagnostics = [];
  const families = [
    { directory: root, stem: "package.nls" },
    { directory: path.join(root, "l10n"), stem: "bundle.l10n" },
  ];
  const catalogs = families.map(({ directory, stem }) => {
    const referenceFile = path.join(directory, `${stem}.json`);
    const reference = readCatalog(referenceFile, diagnostics);
    const locales = new Map();
    for (const name of readdirSync(directory).sort()) {
      if (name.startsWith(`${stem}.`) && name.endsWith(".json") && name !== `${stem}.json`) {
        const file = path.join(directory, name);
        const locale = name.slice(stem.length + 1, -5).toLowerCase();
        if (locales.has(locale)) {
          report(diagnostics, "error", file, `Duplicate locale ${locale}.`);
        }
        locales.set(locale, file);
        const localized = readCatalog(file, diagnostics);
        if (reference && localized) {
          compareCatalogs(reference, localized, file, diagnostics);
        }
      }
    }
    return { reference, referenceFile, locales };
  });
  for (const [index, catalog] of catalogs.entries()) {
    for (const locale of catalog.locales.keys()) {
      if (!catalogs[1 - index].locales.has(locale)) {
        report(
          diagnostics,
          "error",
          catalog.locales.get(locale),
          `Locale ${locale} needs a catalog in both families.`,
        );
      }
    }
  }
  if (catalogs[0].reference) {
    const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    checkUsage(
      catalogs[0].reference,
      new Map([...manifestKeys(manifest)].map((key) => [key, undefined])),
      catalogs[0].referenceFile,
      diagnostics,
    );
  }
  if (catalogs[1].reference) {
    checkUsage(
      catalogs[1].reference,
      runtimeKeys(root, diagnostics, readEvidence(root, diagnostics)),
      catalogs[1].referenceFile,
      diagnostics,
    );
  }
  return diagnostics.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      (a.line ?? 0) - (b.line ?? 0) ||
      a.message.localeCompare(b.message),
  );
}

/** Runs the read-only CLI with an explicit failure for filesystem or analysis errors. */
export function main(root, output = console) {
  try {
    const diagnostics = audit(root);
    for (const diagnostic of diagnostics) {
      const location = path.relative(root, diagnostic.file);
      output[diagnostic.severity === "error" ? "error" : "warn"](
        `${diagnostic.severity.toUpperCase()} ${location}${diagnostic.line ? `:${diagnostic.line}` : ""}: ${diagnostic.message}`,
      );
    }
    const errors = diagnostics.filter((item) => item.severity === "error").length;
    const warnings = diagnostics.length - errors;
    output.log(`Localization audit: ${errors} error(s), ${warnings} review warning(s).`);
    return errors === 0 ? 0 : 1;
  } catch (error) {
    output.error(`Localization audit could not complete: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
  if (process.argv.length > 2) {
    console.error("Usage: node .github/skills/localization/scripts/check-localization.mjs");
    process.exitCode = 1;
  } else {
    process.exitCode = main(root);
  }
}
