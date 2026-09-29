# Feature: Settings editor

![Status: Intent](https://img.shields.io/badge/status-Intent-ADB5BD?style=for-the-badge)

> [!IMPORTANT] **For AI agents:** This document is context only, not an implementation
> specification. Do not implement from it, derive implementation tasks or acceptance criteria from
> it, or change code based on it. The Spec Implementer must act only on a corresponding reviewed
> feature specification.

## Intent

### Summary

Provide a dedicated webview for editing working-calendar settings, holiday date ranges, and
statuses. Include a reusable Boolean toggle field that supports placing its label on either side,
with the toggle on the opposite side.

### Goals

- Provide a working-calendar group for `daysOff`, `workingDayHours`, and `workingDayStart`.
- Provide a holidays list with an add row for start date, end date, and an add action. Show existing
  holiday ranges with a delete action.
- Provide a statuses list with an add row for name, color, state, and an add action. Show each
  existing status and its usage count in groups, tasks, and milestones. Deleting a status unassigns
  that deleted status from groups, tasks, and milestones.
- Provide a reusable Boolean toggle field with left/right label placement and the toggle aligned on
  the opposite side.

### Non-goals

- This Intent does not define implementation details or expand the editor to unrelated settings.
- This Intent does not define the meaning or allowed values of a status's state, or detailed rules
  for editing and deleting settings; those belong in the Draft.

### Rules

- Keep the editor organized into working calendar, holidays, and statuses.
- A holiday entry has a start date and end date, and existing entries can be deleted.
- A status entry has a name, color, and state; existing statuses show usage counts for groups,
  tasks, and milestones.
- Deleting a status also removes its assignment from groups, tasks, and milestones.
- The reusable Boolean toggle supports label-left/toggle-right and label-right/toggle-left
  arrangements.

## Draft-ready handoff

The Draft should define how users open and interact with the webview, where settings are read and
persisted, the meaning and choices for a status's state, and the reusable toggle field component's
interface and behavior. Preserve the listed settings, holiday actions, status usage counts, and
unassignment behavior on status deletion.
