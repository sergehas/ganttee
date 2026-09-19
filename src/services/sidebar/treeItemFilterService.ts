import { ProjectDocument } from "@common/documents";

/** Returns ids of project items whose names contain a literal search term. */
export function filterProjectItemIds(projectDoc: ProjectDocument, term: string): Set<string> {
  const normalizedTerm = term.toLocaleLowerCase();
  if (normalizedTerm.length === 0) {
    return new Set([
      ...projectDoc.groups.map((group) => group.id),
      ...projectDoc.tasks.map((task) => task.id),
      ...projectDoc.milestones.map((milestone) => milestone.id),
    ]);
  }

  return new Set(
    [...projectDoc.groups, ...projectDoc.tasks, ...projectDoc.milestones]
      .filter((item) => item.name.toLocaleLowerCase().includes(normalizedTerm))
      .map((item) => item.id),
  );
}
