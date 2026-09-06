<!--
Pull request description template for create-pr skill.
Placeholders in {{double braces}} must be filled in before the PR is created.
-->

# {{PR short title}}

## Summary

{{2-4 bullet points describing what changed and why}}

## Related issues

{{Refs #123 / Closes #123, or "None"}}

## Changes

- {{bullet list of the main code/behavior changes, grouped by area}}

## Quality checks

- [ ] Lint passes (`npm run lint` / `mvn -q spotless:check` or equivalent)
- [ ] Type-check / compile passes (`tsc --noEmit` / `mvn compile` or equivalent)
- [ ] Unit tests pass (`npm test` / `mvn test` or equivalent)
- [ ] Build succeeds (`npm run build` / `mvn package` or equivalent)
- [ ] No new secrets, credentials, or debug logging left in the diff

## Testing

{{how this was verified: commands run, manual steps}}

## Reviewer notes

- [ ] Assigned at least one code reviewer
- [ ] Highlighted any risky or breaking changes below

{{call out anything a reviewer should pay special attention to, or "None"}}
