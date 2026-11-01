# Feature tracker: Local Markdown

Feature ideas and specifications live in `docs/specs/`, with status tracked in
`docs/specs/ROADMAP.md`. See `docs/specs/README.md` for status definitions and ownership.

## Conventions

- One feature per directory: `docs/specs/<feature-slug>/`
- An early-stage feature may have an `INTENT.md`; it records context, not implementation
  requirements.
- A feature specification lives in `SPEC.md`. It can coexist with `INTENT.md` to preserve the
  original idea and context.
- The roadmap links each feature to its `INTENT.md` or `SPEC.md` and mirrors its status.
- Status changes update the spec front matter and badge, and the matching roadmap row in the same
  change.
- Implementation work is planned and tracked from the specification. This repository does not use
  separate per-ticket Markdown files or a `.scratch/` issue tracker.

## When a skill says "publish to the issue tracker"

For a feature idea, add or update the feature's `INTENT.md` under `docs/specs/<feature-slug>/` and
its roadmap row. For a specification, follow the feature-spec workflow to add or update `SPEC.md`
and keep the roadmap synchronized. Do not create a standalone ticket file.

This tracker does not define a separate location for incoming bug reports or requests. Ask the user
where to record them if one needs to be filed.

## When a skill says "fetch the relevant ticket"

Use the feature path or roadmap entry provided by the user to find its `INTENT.md` or `SPEC.md`.
When the user provides only a feature name, look it up in `docs/specs/ROADMAP.md`.
