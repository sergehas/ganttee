---
description:
  Ganttee test rules — runner choice, coverage gate, file layout, and test style. Use when writing
  or updating tests.
applyTo: "src/test/**"
---

# Writing Tests

## Coverage Gate

- Keep branch **and** function coverage ≥ 90% **per file**. Check with
  `npm run test:coverage-check`.
- The gate applies to every `.ts` file under `src/` that a unit test imports.
- Exclude `.tsx` files from the gate. The test setup has no DOM or React renderer, so `.tsx`
  components cannot be tested.
- Keep `.tsx` components thin. Move logic into a `.ts` module (`*Presentation.ts`, hook `make*`
  helpers, renderers) and unit-test that module.
- Do not add a new test runner or framework (Vitest, Jest, Testing Library, jsdom). Runner changes
  belong to roadmap item 18 (`docs/specs/vitest-test-backbone/`).

## Choose the Runner

All runners use Mocha with the `tdd` interface (`suite`/`test`, `suiteSetup`/`teardown`) and Node
`assert`. Never use `describe`/`it`.

| Test kind   | Location                                       | Runner                                         | Use for                                                                                                                  |
| ----------- | ---------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Unit        | `src/test/unit/<mirror of src path>/*.test.ts` | `npm run test:unit` (`vscode-test`)            | Every branch of `common/`, `services/`, webview `.ts` logic, and `vscode`-free classes in `views/`. Counts for coverage. |
| Integration | `src/test/integration/*.integration.test.ts`   | `npm run test:integration` (plain Mocha, Node) | Multi-service flows on real `.ganttee` files from `src/test/fixtures/` (parse, migrate, hydrate). No `vscode` import.    |
| Smoke       | `src/test/smoke/*.smoke.test.ts`               | `npm run test:smoke` (`vscode-test`)           | Wiring checks in a real Extension Host: activation, registered commands and views, editor opens a fixture.               |

- Put branch coverage in unit tests. Do not use integration or smoke tests to reach coverage.
- Add a smoke test only for new `package.json` contributions or activation wiring.

## Run

- Compile first: `npm run compile:tests`.
- Iterate on one suite: `npx vscode-test --grep "<suite>"` (unit) or
  `npx mocha --config .mocharc.integration.json --grep "<suite>"` (integration).
- After you rename or delete a test file, delete `out/`. Stale compiled tests keep running.
- Run `npm test` before you commit.

## Write

- Name the suite after the unit under test (`suite("DocumentEditQueue", …)`).
- Name each test as the expected behavior:
  `"rejects a queued proposal after an earlier edit advances the revision"`.
- Test one behavior per test. Prefer one `assert.deepStrictEqual` on the whole result over many
  field assertions.
- Use the `@common/*`, `@services/*`, `@webview/*`, `@views/*`, `@src/*` import aliases.
- Load fixtures through `FIXTURES_DIR` from `@src/test/testFixtures`. Add a new fixture file instead
  of an inline JSON string when the document has more than a few items.
- Use hand-written fakes and callbacks (see `styles/fakeRenderApi.ts`). Do not stub globals; make
  the dependency injectable.
- Write the behavior test first, implement, then add tests for the remaining edge-case branches.
- Test shared rules once at the workflow or service level. Test UI `.ts` helpers only for the
  mapping from interaction to workflow.
- Close editors and restore state in `teardown` in smoke tests.
