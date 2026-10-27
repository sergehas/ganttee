---
Status: Intent
Owner: Copilot
Last updated: 2026-09-18
---

# Feature: Scheduling holidays

> [!IMPORTANT] **For AI agents:** This document is context only, not an implementation
> specification. Do not implement from it, derive implementation tasks or acceptance criteria from
> it, or change code based on it. The Spec Implementer must act only on a corresponding reviewed
> feature specification.

![Status: Intent](https://img.shields.io/badge/status-Intent-ADB5BD?style=for-the-badge)

## Summary

Support project-level holidays as non-working calendar exceptions in the scheduling engine. A
holiday may be a single date or a date range. Scheduling must skip holidays in the same way it skips
configured days off, without changing the source document's entered dates.

## Goals

- Allow projects to define holidays or holiday periods that scheduling skips.
- Keep holiday handling consistent with configured days off and working intervals.
- Define how invalid calendar settings and overnight working intervals are handled.

## Non-goals

- Chart rendering or visibility controls for holidays and off-days.
- Detailed persistence, UI, protocol, or acceptance-criteria design; these belong in the reviewed
  feature specification.

## Issues

The review of `src/common/dates.ts` found these risks to address while defining the feature:

- 🔴 **High — Overnight intervals are skipped or misclassified.** — Working intervals that cross
  midnight are handled incorrectly. The documented settings allow `workingDayStart < 24` and
  `workingDayHours <= 24`, so an interval such as 20:00–04:00 is valid. The interval-search helpers
  only inspect the timestamp’s calendar day, causing 00:00–04:00 to be skipped. Either support
  overnight intervals in interval lookup or reject them during settings validation and update the
  documented contract.
- 🟡 **Medium — An empty working calendar can loop forever.** — Invalid settings such as all seven
  weekdays in `daysOff` cause the normalization and traversal loops to run forever. Validate
  settings at the boundary or make these functions throw a typed error for impossible calendars.
- 🟢 **Low — Test coverage** — add cases for overnight intervals and impossible calendars
