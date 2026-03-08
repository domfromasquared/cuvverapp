import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { useAppStore } from "../state/appStore";
import { PermissionHelper } from "../permissions/permissionHelper";
import { getShift, updateShift } from "../services/scheduleApi";
import type { Shift } from "../types/domain";
import { formatDateTime, toInputDateTime } from "../utils/dates";
import { buildRecurrenceRule, parseRecurrenceRule, toggleWeekday, type RecurrencePreset, type WeekdayCode, WEEKDAY_CODES } from "../utils/recurrence";
import { useUi } from "../app/providers";
import { debugBadge } from "../dev/uiDebug";

const WEEKDAY_LABEL: Record<WeekdayCode, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun"
};

function formatRecurrence(rule: string | null): string {
  if (!rule) return "One-time";
  if (rule === "FREQ=DAILY") return "Daily";
  if (rule === "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR") return "Weekdays";
  if (rule.startsWith("FREQ=WEEKLY;BYDAY=")) return `Weekly (${rule.replace("FREQ=WEEKLY;BYDAY=", "")})`;
  return rule;
}

export function ShiftDetailPage(): JSX.Element {
  const { shiftId } = useParams();
  const { household, role, members } = useAppStore();
  const { pushToast } = useUi();
  const [shift, setShift] = useState<Shift | null>(null);
  const [recurrencePreset, setRecurrencePreset] = useState<RecurrencePreset>("none");
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<WeekdayCode[]>(["MO"]);
  const [recurrenceCustom, setRecurrenceCustom] = useState("");

  useEffect(() => {
    if (!shiftId) return;
    void (async () => {
      const next = await getShift(shiftId);
      setShift(next);
      const recurrence = parseRecurrenceRule(next.recurrence_rule);
      setRecurrencePreset(recurrence.preset);
      setRecurrenceWeekdays(recurrence.weekdays.length > 0 ? recurrence.weekdays : ["MO"]);
      setRecurrenceCustom(recurrence.custom);
    })();
  }, [shiftId]);

  if (!household || !shiftId || !shift) {
    return (
      <Card data-ui="page-shift-detail-loading">
        {debugBadge("ShiftDetailPage", "src/pages/ShiftDetailPage.tsx")}
        <p>Loading shift...</p>
      </Card>
    );
  }

  const canEditShift = PermissionHelper.canEditShift(role);
  const caregiverOptions = members.filter((member) => member.role === "caregiver" || member.role === "editor" || member.role === "owner");
  const assignedMember = members.find((member) => member.user_id === shift.caregiver_user_id);

  if (!canEditShift) {
    return (
      <Card data-ui="page-shift-detail-readonly">
        {debugBadge("ShiftDetailPage", "src/pages/ShiftDetailPage.tsx")}
        <h2 className="section-title">{shift.title}</h2>
        <p className="caption">
          {formatDateTime(shift.start_datetime)} - {formatDateTime(shift.end_datetime)}
        </p>
        <p className="caption">Assignee: {assignedMember?.display_name || assignedMember?.email || "Unassigned"}</p>
        <p className="caption">Recurrence: {formatRecurrence(shift.recurrence_rule)}</p>
        <p>{shift.notes || "No notes."}</p>
        {PermissionHelper.canOpenDm(role, household.admin_controls) ? (
          <Link className="btn ghost" to={`/app/dm?context_type=shift&context_id=${shift.id}`}>
            Open context chat
          </Link>
        ) : null}
      </Card>
    );
  }

  return (
    <Card data-ui="page-shift-detail">
      {debugBadge("ShiftDetailPage", "src/pages/ShiftDetailPage.tsx")}
      <h2 className="section-title">Edit shift</h2>
      <form
        className="stack"
        data-ui="shift-detail-form"
        onSubmit={async (event) => {
          event.preventDefault();

          const form = event.currentTarget;
          const title = (form.elements.namedItem("title") as HTMLInputElement).value.trim();
          const start = (form.elements.namedItem("start") as HTMLInputElement).value;
          const end = (form.elements.namedItem("end") as HTMLInputElement).value;
          const notes = (form.elements.namedItem("notes") as HTMLTextAreaElement).value.trim();
          const caregiverUserId = (form.elements.namedItem("caregiver_user_id") as HTMLSelectElement).value || null;
          const recurrenceRule = buildRecurrenceRule({
            preset: recurrencePreset,
            weekdays: recurrenceWeekdays,
            custom: recurrenceCustom,
            startIso: start
          });

          try {
            const updated = await updateShift(shiftId, {
              title,
              caregiver_user_id: caregiverUserId,
              start_datetime: new Date(start).toISOString(),
              end_datetime: new Date(end).toISOString(),
              recurrence_rule: recurrenceRule,
              notes: notes || null
            });
            setShift(updated);
            pushToast("Shift updated.");
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Unable to update shift.");
          }
        }}
      >
        <div className="form-row">
          <label htmlFor="detail-title">Title</label>
          <input id="detail-title" name="title" className="input" defaultValue={shift.title} />
        </div>
        <div className="grid-2">
          <div className="form-row">
            <label htmlFor="detail-start">Start</label>
            <input id="detail-start" name="start" type="datetime-local" className="input" defaultValue={toInputDateTime(shift.start_datetime)} />
          </div>
          <div className="form-row">
            <label htmlFor="detail-end">End</label>
            <input id="detail-end" name="end" type="datetime-local" className="input" defaultValue={toInputDateTime(shift.end_datetime)} />
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="detail-assignee">Assignee</label>
          <select id="detail-assignee" name="caregiver_user_id" className="select" defaultValue={shift.caregiver_user_id ?? ""}>
            <option value="">Unassigned</option>
            {caregiverOptions.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.display_name || member.email || member.user_id}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>Recurrence</label>
          <div className="segmented">
            {([
              ["none", "None"],
              ["daily", "Daily"],
              ["weekdays", "Weekdays"],
              ["weekly", "Weekly"],
              ["custom", "Custom"]
            ] as Array<[RecurrencePreset, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`segment ${recurrencePreset === value ? "active" : ""}`.trim()}
                onClick={() => setRecurrencePreset(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {recurrencePreset === "weekly" ? (
          <div className="form-row">
            <label>Repeat on</label>
            <div className="chip-row">
              {WEEKDAY_CODES.map((day) => (
                <button
                  key={day}
                  type="button"
                  className={`chip-toggle ${recurrenceWeekdays.includes(day) ? "active" : ""}`.trim()}
                  onClick={() => setRecurrenceWeekdays((prev) => toggleWeekday(prev, day))}
                >
                  {WEEKDAY_LABEL[day]}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {recurrencePreset === "custom" ? (
          <div className="form-row">
            <label htmlFor="detail-recurrence-custom">Custom recurrence rule</label>
            <input
              id="detail-recurrence-custom"
              name="recurrence_custom"
              className="input"
              value={recurrenceCustom}
              onChange={(event) => setRecurrenceCustom(event.target.value)}
            />
          </div>
        ) : null}
        <div className="form-row">
          <label htmlFor="detail-notes">Notes</label>
          <textarea id="detail-notes" name="notes" className="textarea" defaultValue={shift.notes ?? ""} />
        </div>
        <div className="actions">
          <Button type="submit">Save</Button>
          {PermissionHelper.canOpenDm(role, household.admin_controls) ? (
            <Link className="btn ghost" to={`/app/dm?context_type=shift&context_id=${shift.id}`}>
              Open context chat
            </Link>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
