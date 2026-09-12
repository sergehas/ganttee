---
Status: accepted
---

# Remain on TypeScript 6 for ESLint Compatibility

## Context

The project currently uses TypeScript 6.x together with ESLint and `typescript-eslint` for the
type-aware linting pipeline. TypeScript 7.x offers meaningful performance improvements, but the
current ESLint integration does not expose or support the TypeScript API surface required to adopt
it reliably.

The lint and type-check pipeline is part of the project's normal validation path. The `compile`,
`package`, and test workflows depend on that pipeline remaining operational.

## Decision

Remain on the TypeScript 6.x major line until the project's ESLint integration officially supports
TypeScript 7.x.

The dependency range may receive compatible TypeScript 6.x updates, but the project must not migrate
to TypeScript 7.x as part of routine dependency updates. Any future TypeScript major-version
migration must preserve the existing type-check, lint, build, and test workflows.

## Considered Options

### Adopt TypeScript 7.x immediately

Rejected. The expected compiler performance improvements do not compensate for the current
incompatibility or missing API support in the ESLint integration. Adopting it now would make linting
unreliable or require disabling type-aware lint checks.

### Replace or bypass the current ESLint integration

Rejected for now. ESLint is part of the project's established quality gate, and replacing or
bypassing its TypeScript integration would create unnecessary tooling churn and could reduce
validation coverage.

### Remain on TypeScript 6.x

Selected. This preserves the working lint and type-check pipeline while still allowing compatible
TypeScript 6.x maintenance updates.

## Consequences

Positive consequences:

- ESLint and type-aware linting remain part of the normal validation pipeline.
- `npm run compile`, `npm test`, and packaging workflows retain their current toolchain assumptions.
- The project avoids a forced migration before the supporting ESLint ecosystem is ready.

Negative consequences:

- The project does not receive TypeScript 7.x compiler performance improvements.
- The TypeScript major version must be treated as intentionally constrained, rather than upgraded
  automatically.
- A future migration will still require a dedicated compatibility review and validation pass.

## Revisit Conditions

Revisit this decision when all of the following are true:

- The project's ESLint and `typescript-eslint` versions officially support the TypeScript 7.x API
  surface required by this repository.
- Type-aware linting works without compatibility workarounds.
- `npm run check-types`, `npm run lint`, `npm run compile`, and `npm test` complete successfully
  under TypeScript 7.x.
