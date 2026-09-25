import { formatShortDate, parseIsoTimestamp } from "@common/dates";
import {
  diagnoseDeterminacy,
  validateTaskConstraints,
} from "@services/schedule/scheduleConstraintService";
import "@webview/components/Form.scss";
import { FormField } from "@webview/components/FormField";
import { TaskFieldsProps } from "@webview/features/entity-editor/entityEditor.types";
import { useTranslate, useWebviewL10n } from "@webview/l10n";

import { CommonTextFields } from "@webview/features/entity-editor/components/CommonTextFields";
import { DependencyFields } from "@webview/features/entity-editor/components/DependencyFields";
import "@webview/features/entity-editor/components/TaskFields.scss";
import { ValidationMessage } from "@webview/features/entity-editor/components/ValidationMessage";
import { taskValidationMessages } from "@webview/features/entity-editor/entityEditorPresentation";
import { makeUpdater } from "@webview/features/entity-editor/hooks/useFieldUpdater";

/** Renders task-specific fields plus dependency editing controls. */
export function TaskFields(props: TaskFieldsProps): React.JSX.Element {
  const { task, scheduledTask, onChange, ...depProps } = props;
  const { document } = depProps;
  const { locale } = useWebviewL10n();
  const t = useTranslate();
  const update = makeUpdater(task, onChange);

  const validation = validateTaskConstraints(task, document.dependencies);
  const diagnostic = diagnoseDeterminacy(task.id, validation);

  return (
    <div className="ganttee-form">
      <CommonTextFields
        item={task}
        groups={document.groups}
        statuses={document.settings.statuses}
        onChange={onChange}
      />
      <hr />
      <div className="ganttee-form__row">
        <FormField label={t("Start")}>
          <input
            type="date"
            value={task.start ?? ""}
            onChange={(event) => update("start", event.target.value || undefined)}
          />
          {scheduledTask?.effectiveStart && (
            <output>
              {formatShortDate(parseIsoTimestamp(scheduledTask.effectiveStart), locale)}
            </output>
          )}
        </FormField>
        <FormField label={t("End")}>
          <input
            type="date"
            min={task.start}
            value={task.end ?? ""}
            onChange={(event) => update("end", event.target.value || undefined)}
          />
          {scheduledTask?.effectiveEnd && (
            <output>
              {formatShortDate(parseIsoTimestamp(scheduledTask.effectiveEnd), locale)}
            </output>
          )}
        </FormField>
      </div>

      <div className="ganttee-form__row">
        <FormField label={t("Duration")}>
          <input
            type="number"
            min={0}
            step="any"
            value={task.duration ?? ""}
            onChange={(event) =>
              update("duration", event.target.value === "" ? undefined : Number(event.target.value))
            }
          />
          {scheduledTask?.effectiveDuration !== undefined && (
            <output>{scheduledTask.effectiveDuration}</output>
          )}
        </FormField>
        <FormField label={t("Progress")}>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((task.progress ?? 0) * 100)}
            onChange={(event) => update("progress", Number(event.target.value) / 100)}
          />
        </FormField>
      </div>
      {taskValidationMessages(diagnostic).map((message) => (
        <ValidationMessage severity={message.severity} key={message.source}>
          {t(message.source, ...(message.values ?? []))}
        </ValidationMessage>
      ))}

      <DependencyFields {...depProps} />
    </div>
  );
}
