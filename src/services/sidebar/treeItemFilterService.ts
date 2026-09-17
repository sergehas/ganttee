import { ProjectDocument } from "@common/documents";

/** Returns ids of project items whose names contain a literal search term. */
export function filterProjectItemIds(document: ProjectDocument, term: string): Set<string> {
  const normalizedTerm = term.toLocaleLowerCase();
  if (normalizedTerm.length === 0) {
    return new Set([
      ...document.groups.map((group) => group.id),
      ...document.tasks.map((task) => task.id),
      ...document.milestones.map((milestone) => milestone.id),
    ]);
  }

  return new Set(
    [...document.groups, ...document.tasks, ...document.milestones]
      .filter((item) => item.name.toLocaleLowerCase().includes(normalizedTerm))
      .map((item) => item.id),
  );
}
