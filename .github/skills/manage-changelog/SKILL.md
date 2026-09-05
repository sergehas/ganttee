---
name: manage-changelog
description: >-
  Maintain doc/CHANGELOG.md in Keep a Changelog format. Use when: preparing a PR, release, tag, or
  changelog entry from Conventional Commit history.
argument-hint: "Optional: PR range, release version, or tag"
---

# Manage Changelog

Maintain [doc/CHANGELOG.md](../../../doc/CHANGELOG.md) using
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) headings.

## Workflow

1. Inspect the relevant Conventional Commit titles. Treat each title's ticket identifier as the
   entry reference; do not infer missing identifiers.
2. Group user-visible changes under `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, or
   `Security`. Omit empty groups and internal-only work.
3. For a PR, add concise entries under `## Unreleased`; preserve existing entries and do not create
   a version heading.
4. For a release or tag, move `Unreleased` entries into `## [<version>] - YYYY-MM-DD`, using the
   release date. **This file is in descending order**: append the new version heading at the
   beginning of the file, just below `## Unreleased`. Keep an empty `## Unreleased` at the top.
5. Verify entries are factual, imperative, consistently punctuated, and each appears only once.

## Template

Omit category headings that have no entries.

```md
# Changelog

## Unreleased

### Added

- [TICKET-123] Add concise user-visible change

### Changed

- [TICKET-234] Change concise user-visible behavior

### Fixed

- [TICKET-345] Fix concise user-visible defect

### Removed

- [TICKET-456] Remove concise obsolete capability

## [<version>] - YYYY-MM-DD

### Fixed

- [TICKET-456] Fix concise user-visible defect
```

Use the repository's Conventional Commit and gitflow rules for commit and tag context; do not
duplicate them here.
