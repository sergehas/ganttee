/** Project item collections searchable by the sidebar. */
export interface ProjectItemSource {
  /** Searchable groups. */
  readonly groups: readonly { readonly id: string; readonly name: string }[];
  /** Searchable tasks. */
  readonly tasks: readonly { readonly id: string; readonly name: string }[];
  /** Searchable milestones. */
  readonly milestones: readonly { readonly id: string; readonly name: string }[];
}

/** Returns ids of project items whose names contain a literal search term. */
export function filterProjectItemIds(project: ProjectItemSource, term: string): Set<string> {
  const normalizedTerm = term.toLocaleLowerCase();
  if (normalizedTerm.length === 0) {
    return new Set([
      ...project.groups.map((group) => group.id),
      ...project.tasks.map((task) => task.id),
      ...project.milestones.map((milestone) => milestone.id),
    ]);
  }

  return new Set(
    [...project.groups, ...project.tasks, ...project.milestones]
      .filter((item) => item.name.toLocaleLowerCase().includes(normalizedTerm))
      .map((item) => item.id),
  );
}
