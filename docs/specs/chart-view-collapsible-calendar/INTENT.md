---
Status: Intent
Owner: Copilot
Last updated: 2026-09-18
---

# Feature: Make off-days and holidays collapsible in chart view

> [!IMPORTANT] **For AI agents:** This document is context only, not an implementation
> specification. Do not implement from it, derive implementation tasks or acceptance criteria from
> it, or change code based on it. The Spec Implementer must act only on a corresponding reviewed
> feature specification.

![Status: Intent](https://img.shields.io/badge/status-Intent-ADB5BD?style=for-the-badge)

## Summary

Let users collapse off-days and holidays in the chart view. This includes hiding the corresponding
calendar layers and removing their related time spans from the displayed timeline, so the chart can
focus on working time without showing empty calendar periods.

## Goals

- Provide a chart-view control for collapsing configured off-days and holidays.
- Keep the calendar-layer visibility and timeline time-span behavior consistent.
- Preserve a clear way to understand the compressed timeline.

## Non-goals

- Defining or persisting holiday data; that belongs to the scheduling-holidays intent.
- Detailed chart interaction, layout, protocol, or acceptance-criteria design; these belong in the
  reviewed feature specification.
