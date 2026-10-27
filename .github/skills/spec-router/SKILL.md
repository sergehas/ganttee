---
name: spec-router
description:
  "Detect which spec-lifecycle agent a request needs (drafting, reviewing, implementing, or test
  planning a feature spec) and suggest the handoff — never acts without confirmation. Use whenever a
  message mentions a spec/feature-spec file, a roadmap status, or spec review/implementation/
  draft/test-plan intent, even without an explicit @agent mention."
---

# Spec Router

Point a spec-related request at the right agent, without ever moving it there yourself.

## When to Use

- The user's request is about a feature spec (draft, review, implement, test-plan, status, roadmap)
  but does not explicitly `@mention` one of the spec agents.
- Ambiguous phrasing like "let's start on this spec" or "is this ready to build".

## Procedure

1. Identify the target spec. If a file/slug is named, use it; otherwise ask which spec (or read
   `docs/specs/ROADMAP.md` for candidates if the request implies "the current one").
2. Read the spec's front matter `Status` (or the ROADMAP row if there is no spec file yet — an
   `Intent` entry).
3. Map `Status` to the next step using the lifecycle in
   [docs/specs/README.md](../../../docs/specs/README.md):
   - `Intent` → drafting is done in general chat first; **Spec Writer** once there is enough to
     write down.
   - `Draft` → **Spec Reviewer** (or **Spec Implementer** directly, if the user wants to skip
     review).
   - `Reviewed` → **Spec Implementer**.
   - `Implementing` / `Implemented` → **Spec Implementer** (continuing work) or **Test Planner**
     (coverage check).
   - `Blocked` / `On Hold` → surface the paused state; ask whether to resume first.
4. State the recommended agent and the transition it would perform, then ask for confirmation
   through the ask-questions tool — always include an option to _not_ hand off (e.g. "just answer in
   chat instead").
5. On confirmation, invoke the named agent as a subagent with the spec path/slug and the user's
   original request as context.

## Constraints

- DO NOT edit any file — routing only.
- DO NOT change a spec's status or ROADMAP row.
- DO NOT skip the confirmation step, even when the mapping in step 3 is unambiguous.
- If subagent invocation is unavailable in the current surface, state the recommended agent name and
  let the user invoke it directly instead.
