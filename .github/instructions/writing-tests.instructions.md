---
description: Ganttee test writing guidelines — unit tests, integration tests, snapshot tests, and clean teardown patterns. Reference when writing or updating tests.
applyTo: "{src/**/test/**,src/**/*.test.ts,src/**/*.integrationTest.ts}"
---

# Writing Tests

Canonical reference: https://github.com/microsoft/vscode/wiki/Writing-Tests

## Coverage (mandatory)

**Branch coverage MUST stay ≥ 90%.** Every new branch (conditionals, ternaries, `switch` cases,
error paths, early returns) needs a covering test. A change that drops branch coverage below 90%
is not mergeable — add tests for the missing branches or justify and adjust the change.

## Writing Unit Tests

Tests use Mocha's BDD interface (`suite`/`test`) with the `assert` module and `sinon` for mocks.

### Clean Teardown

Always use `ensureNoDisposablesAreLeakedInTestSuite()` to catch disposal leaks:

```typescript
suite("myTests", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();

  test("example", () => {
    const disposable = store.add(new MyDisposable());
    // ...
  });
});
```

Always call `sinon.restore()` in `teardown` to avoid leaking mocks.

### Best Practices

- Minimize assertions per test — prefer one `assert.deepStrictEqual` snapshot over many fine-grained assertions
- Don't add tests to the wrong suite — find the relevant `suite` block
- Follow existing patterns (`describe`/`test` or `suite`/`test`) consistently within a file
- Don't stub globals (e.g., `(mainWindow as any).X = ...`) — make dependencies injectable instead

### Snapshot Testing

Use `assertSnapshot` for Jest-like snapshot tests. Snapshots are written to a `__snapshots__` directory beside the test file on first run — verify the output is correct, then subsequent runs compare against it.
