/** The type of a project item. */
export const PROJECT_ITEM_TYPES = ["task", "milestone", "group"] as const;

/** The type of a project item. */
export type ProjectItemType = (typeof PROJECT_ITEM_TYPES)[number];

export * from "@common/documents/project/dependency";
export * from "@common/documents/project/group";
export * from "@common/documents/project/milestone";
export * from "@common/documents/project/projectDocument";
export * from "@common/documents/project/projectItem";
export * from "@common/documents/project/projectSettings";
export * from "@common/documents/project/projectView";
export * from "@common/documents/project/task";
