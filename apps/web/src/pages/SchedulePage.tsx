import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { EmptyState } from "../components/common/EmptyState";
import { useAppStore } from "../state/appStore";
import { listShifts, createShift, listTimeEntries, clockIn, clockOut, approveTimeEntry } from "../services/scheduleApi";
import { createSystemEvent } from "../services/feedApi";
import { formatDateTime } from "../utils/dates";
import { isValidRange } from "../utils/validation";
import { PermissionHelper } from "../permissions/permissionHelper";
import type { Shift, TimeEntry } from "../types/domain";
import { useUi } from "../app/providers";
import { debugBadge } from "../dev/uiDebug";

export function SchedulePage(): JSX.Element {
  const { household, profile, role } = useAppStore();
  const { pushToast } = useUi();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    if (!household) return;
    void (async () => {
      setShifts(await listShifts(household.id));
      setTimeEntries(await listTimeEntries(household.id));
    })();
  }, [household]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Shift[]>();
    shifts.forEach((shift) => {
      const day = shift.start_datetime.slice(0, 10);
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)?.push(shift);
    });
    return [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  }, [shifts]);

  if (!household || !profile) return <div />;

  const canManageSchedule = PermissionHelper.canManageSchedule(role);
  const canTrackTime = PermissionHelper.canTrackTime(role);
  const canApproveTimeEntries = PermissionHelper.canApproveTimeEntries(role);
  const visibleTimeEntries = canApproveTimeEntries ? timeEntries : timeEntries.filter((entry) => entry.user_id === profile.id);
  const availableClockInShift = shifts.find((shift) => shift.caregiver_user_id === null || shift.caregiver_user_id === profile.id) ?? null;

  return (
    <div className="stack" data-ui="page-schedule">
      {debugBadge("SchedulePage", "src/pages/SchedulePage.tsx")}
      <Card data-ui="schedule-create-card">
        <h2 className="section-title">Schedule</h2>
        <p className="caption">{canManageSchedule ? "One-off and recurring shifts with feed transparency." : "View assigned and upcoming shifts."}</p>
        {canManageSchedule ? (
          <form
            className="stack"
            data-ui="schedule-create-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!canManageSchedule) {
                pushToast("Only owners and editors can create shifts.");
                return;
              }

              const form = event.currentTarget;
              const title = (form.elements.namedItem("title") as HTMLInputElement).value.trim();
              const start = (form.elements.namedItem("start") as HTMLInputElement).value;
              const end = (form.elements.namedItem("end") as HTMLInputElement).value;
              const recurrence = (form.elements.namedItem("recurrence") as HTMLInputElement).value.trim();
              const notes = (form.elements.namedItem("notes") as HTMLTextAreaElement).value.trim();

              if (!title || !isValidRange(start, end)) {
                pushToast("Please provide title and valid times.");
                return;
              }

              try {
                const shift = await createShift({
                  household_id: household.id,
                  caregiver_user_id: null,
                  title,
                  start_datetime: new Date(start).toISOString(),
                  end_datetime: new Date(end).toISOString(),
                  recurrence_rule: recurrence || null,
                  notes: notes || null
                });

                await createSystemEvent({
                  household_id: household.id,
                  author_user_id: profile.id,
                  title: "Schedule changed",
                  body: `Shift created: ${shift.title}`,
                  shift_id: shift.id,
                  is_critical: true
                });

                setShifts(await listShifts(household.id));
                pushToast("Shift created.");
                form.reset();
              } catch (error) {
                pushToast(error instanceof Error ? error.message : "Unable to create shift.");
              }
            }}
          >
            <div className="form-row">
              <label htmlFor="shift-title">Title</label>
              <input id="shift-title" name="title" className="input" required />
            </div>
            <div className="grid-2">
              <div className="form-row">
                <label htmlFor="shift-start">Start</label>
                <input id="shift-start" name="start" type="datetime-local" className="input" required />
              </div>
              <div className="form-row">
                <label htmlFor="shift-end">End</label>
                <input id="shift-end" name="end" type="datetime-local" className="input" required />
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="shift-recurrence">Recurrence rule</label>
              <input id="shift-recurrence" name="recurrence" className="input" placeholder="FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" />
            </div>
            <div className="form-row">
              <label htmlFor="shift-notes">Notes</label>
              <textarea id="shift-notes" name="notes" className="textarea" />
            </div>
            <Button type="submit">Create shift</Button>
          </form>
        ) : (
          <p className="caption">Owners and editors manage shift creation and assignment.</p>
        )}
      </Card>

      <section className="stack" data-ui="schedule-agenda-section">
        <h2 className="section-title">Agenda</h2>
        {grouped.length === 0 ? <EmptyState title="No shifts" body="Create a shift to begin coverage planning." /> : null}
        {grouped.map(([day, dayShifts]) => (
          <Card key={day} data-ui="schedule-agenda-day-card">
            <p className="kicker">{day}</p>
            <div className="list" data-ui="schedule-agenda-day-list">
              {dayShifts.map((shift) => (
                <div key={shift.id} className="list-item" data-ui="schedule-agenda-item">
                  <h3 className="title-tight">{shift.title}</h3>
                  <p className="caption">{formatDateTime(shift.start_datetime)} - {formatDateTime(shift.end_datetime)}</p>
                  <Link className="btn ghost" to={`/app/shift/${shift.id}`}>
                    Open shift
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </section>

      {canTrackTime || canApproveTimeEntries ? (
        <Card data-ui="schedule-time-clock-card">
          <h2 className="section-title">Time clock</h2>
          <div className="list" data-ui="schedule-time-clock-list">
            {visibleTimeEntries.map((entry) => (
              <div key={entry.id} className="list-item" data-ui="schedule-time-entry-item">
                <p className="text-reset">Shift: {entry.shift_id ?? "Unlinked"}</p>
                <p className="caption">Status: {entry.status}</p>
                <div className="actions">
                  {canTrackTime && entry.status === "open" && entry.user_id === profile.id ? (
                    <Button variant="secondary" onClick={async () => {
                      await clockOut(entry.id);
                      setTimeEntries(await listTimeEntries(household.id));
                    }}>Clock out</Button>
                  ) : null}
                  {canApproveTimeEntries && entry.status === "submitted" ? (
                    <Button variant="ghost" onClick={async () => {
                      await approveTimeEntry(entry.id);
                      setTimeEntries(await listTimeEntries(household.id));
                    }}>Approve</Button>
                  ) : null}
                </div>
              </div>
            ))}
            {visibleTimeEntries.length === 0 ? <p className="caption">No time entries yet.</p> : null}
            {canTrackTime ? (
              <Button
                variant="ghost"
                onClick={async () => {
                  if (!availableClockInShift) {
                    pushToast("No shift assigned to you for clock-in.");
                    return;
                  }
                  await clockIn(household.id, availableClockInShift.id, profile.id);
                  setTimeEntries(await listTimeEntries(household.id));
                }}
              >
                Clock in
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
