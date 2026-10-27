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

/**
 * Determines whether a value identifies a bundled custom icon.
 *
 * When this function returns `true`, TypeScript narrows `value` to {@link IconName}.
 *
 * @param value The value to check against the registered icon names.
 * @returns `true` when `value` is a supported custom icon name.
 */
export function isIconName(value: string): value is IconName {
  return customIconNames.has(value);
}

/** The registry used by {@link isIconName} to validate custom icon names. */
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
