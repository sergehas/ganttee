# Host-Owned Hydration and Scheduling

The `.ganttee` TextDocument is the single persisted source of truth. Parsing, migration, structural
and semantic validation, model hydration, and canonical scheduling are owned by the host; the
webview sends edit intents and consumes plain document and schedule projections. This prevents host
and webview schedule divergence and keeps host-only `GanttModel` and `Date`-typed derived state out
of the protocol, at the cost of a host round trip after accepted edits. Failed reparses retain the
last valid host model.
