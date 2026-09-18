# Feature Spec Prompts

These workspace prompts guide the Ganttee feature-spec lifecycle. They select the lifecycle owner,
enforce the expected state, and retain required explicit confirmation before a transition.

| Command           | Input                              | Expected status       | Result                                           |
| ----------------- | ---------------------------------- | --------------------- | ------------------------------------------------ |
| `/spec-intent`    | General feature idea               | New or `Intent`       | Roadmap Intent and Draft-ready handoff           |
| `/spec-draft`     | Requirements; optional Intent      | Intent or new feature | Draft spec and synchronized roadmap row          |
| `/spec-refine`    | Draft spec and refinements         | Draft                 | Approved Draft-content refinements only          |
| `/spec-review`    | Draft spec                         | Draft                 | Reviewed transition after confirmation           |
| `/spec-implement` | Reviewed spec; full or story scope | Reviewed              | Implementing delivery, with Test Planner handoff |

Use `/spec-implement` with story IDs only for a deliberately partial delivery. The feature remains
`Implementing` when that slice passes. Report the completed scope in chat and track durable delivery
progress through the normal issue or pull-request workflow. Only complete delivery can move the spec
to `Implemented`.

The commands are available from the chat slash-command menu and through `Chat: Run Prompt...`.
