---
applyTo: ".github/agents/*.agent.md"
---

# Agent Model Routing

Apply this rule when creating or updating custom agents for this repository.

## Routing Policy

- Reasoning-heavy tasks must run on a reasoning-capable model.
- Broad codebase scanning must be delegated to a cheaper scan-oriented model.
- Keep reasoning agents focused on synthesis, decisions, and final output.
- Keep scanner agents focused on discovery and evidence collection.

## Required Patterns

1. Reasoning agents must be structured for synthesis and decision work, not
   broad repository discovery.
2. Scanner agents must be structured for low-cost discovery and evidence
   collection only.
3. Reasoning agents must include explicit scan delegation guidance in their
   Constraints or Approach section.
4. Scanner agents must not make design or implementation decisions.
5. Use tool-minimalism: reasoning agents should avoid direct broad-search tools
   when a scanner agent can provide the same evidence.

## Delegation Contract

When a reasoning agent delegates scanning, request this output from the scanner:

- Goal summary
- Top candidate files with confidence
- Supporting matches
- Gaps and ambiguities
- Recommended next read order
