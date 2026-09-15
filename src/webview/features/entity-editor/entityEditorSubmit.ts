import {
  Dependency,
  Group,
  Milestone,
  ProjectDocument,
  Task,
} from "@common/documents";
import { EditableEntityKind, EditableEntityMap } from "@common/protocol";
import { FormEvent } from "react";
import { TaskFormProps } from "./entityEditor.types";

/** Inputs required to route an entity editor form submission. */
export interface EntityEditorSubmitOptions {
  /** Current parsed document that supplies dependencies. */
  readonly document: ProjectDocument;
  /** Current task draft, when present. */
  readonly taskDraft: Task | null;
  /** Current milestone draft, when present. */
  readonly milestoneDraft: Milestone | null;
  /** Current group draft, when present. */
  readonly groupDraft: Group | null;
  /** Sends the edited entity through the shared workflow. */
  readonly onSave: TaskFormProps["onSave"];
}

/** Creates the form submit handler for the active entity draft. */
export function createEntityEditorSubmit(
  options: EntityEditorSubmitOptions,
): (event: FormEvent) => void {
  return (event) => {
    event.preventDefault();
    const entity = activeDraft(options);
    if (!entity) {
      return;
    }
    options.onSave(
      entity.kind,
      entity.value,
      undefined,
      options.document.dependencies,
    );
  };
}

/** Resolves the currently active draft to its editable entity kind and value. */
function activeDraft(options: EntityEditorSubmitOptions):
  | {
      kind: EditableEntityKind;
      value: EditableEntityMap[EditableEntityKind];
    }
  | undefined {
  if (options.taskDraft) {
    return { kind: "task", value: options.taskDraft };
  }
  if (options.milestoneDraft) {
    return { kind: "milestone", value: options.milestoneDraft };
  }
  if (options.groupDraft) {
    return { kind: "group", value: options.groupDraft };
  }
  return undefined;
}
