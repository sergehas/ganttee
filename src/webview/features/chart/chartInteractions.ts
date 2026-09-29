import { BooleanViewField, Group, Milestone, ProjectView, Task } from "@common/documents";
import { EditableEntityRef } from "@common/protocol";
import { withViewField } from "@webview/features/chart/projectViewControls";

/** Chart reaction to a click on a series item. */
export type ChartClickAction =
  | { readonly kind: "toggleGroup"; readonly groupId: string }
  | { readonly kind: "edit"; readonly entity: EditableEntityRef }
  | { readonly kind: "none" };

/** Legend series names bound to a persisted view layer. */
export const LEGEND_LAYERS: ReadonlyMap<string, BooleanViewField> = new Map([
  ["dependencies", "showDependencies"],
  ["off-days", "showOffDays"],
  ["holidays", "showHolidays"],
]);

/** Extracts an editable entity reference from a chart event payload.
 * @param params ECharts event payload.
 * @returns The referenced entity, or `undefined` for non-entity series.
 */
export function entityFromChartEvent(params: unknown): EditableEntityRef | undefined {
  const event = params as {
    seriesName?: string;
    data?: { task?: Task; milestone?: Milestone; group?: Group };
  };
  if (event.seriesName === "tasks" && event.data?.task) {
    return { kind: "task", id: event.data.task.id };
  }
  if (event.seriesName === "milestones" && event.data?.milestone) {
    return { kind: "milestone", id: event.data.milestone.id };
  }
  if (event.seriesName === "groups" && event.data?.group) {
    return { kind: "group", id: event.data.group.id };
  }
  return undefined;
}

/**
 * Maps a chart click to its action: ctrl- or cmd-click on a group toggles its collapse state,
 * any other click on an entity edits it.
 * @param event ECharts click event.
 * @returns The action to run.
 */
export function resolveChartClick(event: unknown): ChartClickAction {
  const entity = entityFromChartEvent(event);
  if (entity === undefined) {
    return { kind: "none" };
  }
  if (entity.kind === "group" && isModifierClick(event)) {
    return { kind: "toggleGroup", groupId: entity.id };
  }
  return { kind: "edit", entity };
}

/**
 * Returns the legend selection matching the persisted view layers.
 * @param view Current view.
 * @returns Legend selection keyed by series name.
 */
export function legendSelection(view: ProjectView): Record<string, boolean> {
  return Object.fromEntries([...LEGEND_LAYERS].map(([name, field]) => [name, view[field]]));
}

/**
 * Applies an ECharts `legendselectchanged` event to the persisted view.
 * @param view Current view.
 * @param event Legend event with the toggled series name and the new selection.
 * @returns The proposed view, or `undefined` when the series is not a persisted layer.
 */
export function applyLegendSelection(
  view: ProjectView,
  event: { readonly name: string; readonly selected: Readonly<Record<string, boolean>> },
): ProjectView | undefined {
  const field = LEGEND_LAYERS.get(event.name);
  if (field === undefined) {
    return undefined;
  }
  return withViewField(view, field, event.selected[event.name] ?? !view[field]);
}

/** Returns whether a chart event was a ctrl- or cmd-click.
 * @param params ECharts event payload.
 * @returns Whether either modifier key was pressed.
 */
function isModifierClick(params: unknown): boolean {
  const event = params as {
    event?: {
      event?: {
        ctrlKey?: boolean;
        metaKey?: boolean;
      };
    };
  };
  return Boolean(event.event?.event?.ctrlKey || event.event?.event?.metaKey);
}
