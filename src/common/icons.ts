/** Names of the custom monochrome SVG icons shipped with the extension. */
export type IconName =
  | "task"
  | "group"
  | "milestone"
  | "dependency"
  | "startAfter"
  | "startWith"
  | "endWith"
  | "holidays"
  | "off-days"
  | "path";

/** Returns whether a value identifies a bundled custom icon. */
export function isIconName(value: string): value is IconName {
  return customIconNames.has(value);
}

const customIconNames: ReadonlySet<string> = new Set<IconName>([
  "task",
  "group",
  "milestone",
  "dependency",
  "startAfter",
  "startWith",
  "endWith",
  "holidays",
  "off-days",
  "path",
]);
