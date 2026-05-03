import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { EmptyState } from "../components/common/EmptyState";
import { AssignmentBadge } from "../components/schedule/AssignmentBadge";
import { useAppStore } from "../state/appStore";
import { listShifts, createShift, assignShift, listTimeEntries, clockIn, clockOut, approveTimeEntry, listAssignmentsForShift } from "../services/scheduleApi";
import { createSystemEvent } from "../services/feedApi";
import { formatDateTime } from "../utils/dates";
import { isValidRange } from "../utils/validation";
import { PermissionHelper } from "../permissions/permissionHelper";
import { buildRecurrenceRule, toggleWeekday, type RecurrencePreset, type WeekdayCode, WEEKDAY_CODES } from "../utils/recurrence";
import type { Shift, ShiftAssignment, TimeEntry } from "../types/domain";
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
  if (rule.startsWith("FREQ=WEEKLY;BYDAY=")) {
    const days = rule
      .replace("FREQ=WEEKLY;BYDAY=", "")
      .split(",")
      .map((day) => WEEKDAY_LABEL[day as WeekdayCode] ?? day);
    return `Weekly (${days.join(", ")})`;
  }
  return "Custom recurrence";
}

function badgeClass(status: TimeEntry["status"]): string {
  return `status-chip status-${status}`.trim();
}

export function SchedulePage(): JSX.Element {
  const { household, profile, role, members } = useAppStore();
  const { pushToast } = useUi();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignmentsByShift, setAssignmentsByShift] = useState<Map<string, ShiftAssignment>>(new Map());
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [recurrencePreset, setRecurrencePreset] = useState<RecurrencePreset>("none");
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<WeekdayCode[]>(["MO"]);
  const [recurrenceCustom, setRecurrenceCustom] = useState("");
  const [clockInShiftId, setClockInShiftId] = useState<string>("");

  useEffect(() => {
    if (!household || !role) return;
    void (async () => {
      setLoading(true);
      const [nextShifts, nextEntries] = await Promise.all([
        listShifts(household.id),
        PermissionHelper.canTrackTime(role) || PermissionHelper.canApproveTimeEntries(role)
          ? listTimeEntries(household.id)
          : Promise.resolve([] as TimeEntry[])
      ]);
      setShifts(nextShifts);
      setTimeEntries(nextEntries);

      // Load the most recent assignment for each shift so we can show status badges.
      const assignmentMap = new Map<string, ShiftAssignment>();
      await Promise.all(
        nextShifts.map(async (shift) => {
          const rows = await listAssignmentsForShift(shift.id);
          if (rows.length > 0) assignmentMap.set(shift.id, rows[0]);
        })
      );
      setAssignmentsByShift(assignmentMap);

      setLoading(false);
    })();
  }, [household, role]);

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((member) => {
      map.set(member.user_id, member.display_name || member.email || member.user_id);
    });
    map.set(profile?.id ?? "", profile?.display_name || profile?.email || "You");
    return map;
  }, [members, profile]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Shift[]>();
    shifts.forEach((shift) => {
      const day = shift.start_datetime.slice(0, 10);
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)?.push(shift);
    });
    return [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  }, [shifts]);

  if (!household || !profile || !PermissionHelper.canViewSchedule(role)) return <div />;

  const canManageSchedule = PermissionHelper.canManageSchedule(role);
  const canTrackTime = PermissionHelper.canTrackTime(role);
  const canApproveTimeEntries = PermissionHelper.canApproveTimeEntries(role);
  // Caregiver picker shows only caregiver-role members for the assignment workflow.
  const caregiverOptions = members.filter((member) => member.role === "caregiver");
  const now = Date.now();

  const activeMyEntry = timeEntries.find((entry) => entry.user_id === profile.id && entry.status === "open") ?? null;
  const myEntries = timeEntries.filter((entry) => entry.user_id === profile.id);
  const submittedEntries = timeEntries.filter((entry) => entry.status === "submitted");
  const availableClockInShifts = shifts.filter((shift) => {
    const notEnded = new Date(shift.end_datetime).getTime() >= now;
    if (!notEnded) return false;
    return shift.caregiver_user_id === null || shift.caregiver_user_id === profile.id;
  });

  const selectedClockInShift =
    availableClockInShifts.find((shift) => shift.id === clockInShiftId) ??
    availableClockInShifts[0] ??
    null;

  return (
    <div className="stack" data-ui="page-schedule">
      {debugBadge("SchedulePage", "src/pages/SchedulePage.tsx")}

      <Card data-ui="schedule-summary-card">
        <h2 className="section-title">Schedule</h2>
        <p className="caption">
          {canManageSchedule
            ? "Manage shift coverage and approve submitted time."
            : canTrackTime
              ? "See upcoming shifts and track your time."
              : "Monitor upcoming shifts and coverage status."}
        </p>
      </Card>

      <section className="stack" data-ui="schedule-upcoming-section">
        <div className="section-row">
          <h2 className="section-title">Upcoming shifts</h2>
          <span className="badge">{shifts.length} total</span>
        </div>
        {loading ? <p className="caption">Loading schedule...</p> : null}
        {!loading && grouped.length === 0 ? <EmptyState title="No shifts" body="No shifts have been scheduled yet." /> : null}
        {grouped.map(([day, dayShifts]) => (
          <Card key={day} data-ui="schedule-day-card">
            <p className="kicker">{day}</p>
            <div className="timeline-list">
              {dayShifts.map((shift) => {
                const assignment = assignmentsByShift.get(shift.id);
                return (
                  <article key={shift.id} className="timeline-row" data-ui="schedule-shift-row">
                    <div className="timeline-main">
                      <div className="chip-row">
                        <h3 className="title-tight">{shift.title}</h3>
                        {assignment ? <AssignmentBadge status={assignment.status} /> : null}
                      </div>
                      <p className="caption">
                        {formatDateTime(shift.start_datetime)} - {formatDateTime(shift.end_datetime)}
                      </p>
                      <div className="chip-row">
                        <span className="badge">{formatRecurrence(shift.recurrence_rule)}</span>
                        <span className="badge">
                          {shift.caregiver_user_id ? memberNameById.get(shift.caregiver_user_id) ?? "Assigned" : "Unassigned"}
                        </span>
                      </div>
                    </div>
                    <Link className="btn ghost" to={`/app/shift/${shift.id}`}>
                      Open
                    </Link>
                  </article>
                );
              })}
            </div>
          </Card>
        ))}
      </section>

      {canManageSchedule ? (
        <Card data-ui="schedule-create-card">
          <h2 className="section-title">Create shift</h2>
          <form
            className="stack"
            data-ui="schedule-create-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const title = (form.elements.namedItem("title") as HTMLInputElement).value.trim();
              const start = (form.elements.namedItem("start") as HTMLInputElement).value;
              const end = (form.elements.namedItem("end") as HTMLInputElement).value;
              const notes = (form.elements.namedItem("notes") as HTMLTextAreaElement).value.trim();
              const caregiverUserId = (form.elements.namedItem("caregiver_user_id") as HTMLSelectElement).value || null;

              if (!title || !isValidRange(start, end)) {
                pushToast("Please provide a title and valid time range.");
                return;
              }

              const recurrenceRule = buildRecurrenceRule({
                preset: recurrencePreset,
                weekdays: recurrenceWeekdays,
                custom: recurrenceCustom,
                startIso: start
              });

              try {
                // Create the shift without setting caregiver_user_id directly.
                // The assignShift edge function sets it after creating the assignment row.
                const shift = await createShift({
                  household_id: household.id,
                  caregiver_user_id: null,
                  title,
                  start_datetime: new Date(start).toISOString(),
                  end_datetime: new Date(end).toISOString(),
                  recurrence_rule: recurrenceRule,
                  notes: notes || null
                });

                if (caregiverUserId) {
                  await assignShift(household.id, shift.id, caregiverUserId);
                }

                await createSystemEvent({
                  household_id: household.id,
                  author_user_id: profile.id,
                  title: "Schedule updated",
                  body: `Shift created: ${shift.title}`,
                  shift_id: shift.id,
                  is_critical: true
                });

                const refreshedShifts = await listShifts(household.id);
                setShifts(refreshedShifts);

                const assignmentMap = new Map<string, ShiftAssignment>(assignmentsByShift);
                if (caregiverUserId) {
                  const rows = await listAssignmentsForShift(shift.id);
                  if (rows.length > 0) assignmentMap.set(shift.id, rows[0]);
                }
                setAssignmentsByShift(assignmentMap);

                pushToast("Shift created.");
                form.reset();
                setRecurrencePreset("none");
                setRecurrenceWeekdays(["MO"]);
                setRecurrenceCustom("");
              } catch (error) {
                pushToast(error instanceof Error ? error.message : "Unable to create shift.");
              }
            }}
          >
            <div className="form-row">
              <label htmlFor="shift-title">Shift title</label>
              <input id="shift-title" name="title" className="input" required placeholder="Morning coverage" />
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
              <label htmlFor="shift-assignee">Assignee</label>
              <select id="shift-assignee" name="caregiver_user_id" className="select" defaultValue="">
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
                <label htmlFor="shift-recurrence-custom">Custom recurrence rule</label>
                <input
                  id="shift-recurrence-custom"
                  name="recurrence_custom"
                  className="input"
                  placeholder="FREQ=WEEKLY;BYDAY=MO,WE"
                  value={recurrenceCustom}
                  onChange={(event) => setRecurrenceCustom(event.target.value)}
                />
              </div>
            ) : null}

            <div className="form-row">
              <label htmlFor="shift-notes">Notes</label>
              <textarea id="shift-notes" name="notes" className="textarea" placeholder="Optional handoff notes" />
            </div>
            <Button type="submit">Create shift</Button>
          </form>
        </Card>
      ) : null}

      {canTrackTime ? (
        <Card data-ui="schedule-time-clock-card">
          <h2 className="section-title">Time clock</h2>
          {activeMyEntry ? (
            <div className="list-item">
              <p className="caption">Current entry</p>
              <p className="text-reset">{formatDateTime(activeMyEntry.clock_in)}</p>
              <p className={badgeClass(activeMyEntry.status)}>{activeMyEntry.status}</p>
              <div className="actions actions-spaced">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await clockOut(activeMyEntry.id);
                    setTimeEntries(await listTimeEntries(household.id));
                  }}
                >
                  Clock out
                </Button>
              </div>
            </div>
          ) : (
            <div className="stack">
              <div className="form-row">
                <label htmlFor="clock-in-shift">Choose shift</label>
                <select
                  id="clock-in-shift"
                  className="select"
                  value={selectedClockInShift?.id ?? ""}
                  onChange={(event) => setClockInShiftId(event.target.value)}
                >
                  {availableClockInShifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.title} - {formatDateTime(shift.start_datetime)}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                disabled={!selectedClockInShift}
                onClick={async () => {
                  if (!selectedClockInShift) return;
                  await clockIn(household.id, selectedClockInShift.id, profile.id);
                  setTimeEntries(await listTimeEntries(household.id));
                }}
              >
                Clock in
              </Button>
            </div>
          )}
          <div className="list">
            {myEntries.slice(0, 4).map((entry) => (
              <div key={entry.id} className="list-item">
                <p className="caption">Clocked in {formatDateTime(entry.clock_in)}</p>
                <p className={badgeClass(entry.status)}>{entry.status}</p>
              </div>
            ))}
            {myEntries.length === 0 ? <p className="caption">No entries yet.</p> : null}
          </div>
        </Card>
      ) : null}

      {canApproveTimeEntries ? (
        <Card data-ui="schedule-approvals-card">
          <h2 className="section-title">Time approvals</h2>
          <div className="list">
            {submittedEntries.map((entry) => {
              const shift = shifts.find((candidate) => candidate.id === entry.shift_id);
              return (
                <div key={entry.id} className="list-item">
                  <h3 className="title-tight">{shift?.title ?? "Shift entry"}</h3>
                  <p className="caption">
                    {memberNameById.get(entry.user_id) ?? entry.user_id} · {formatDateTime(entry.clock_in)}
                  </p>
                  <div className="actions actions-spaced">
                    <span className={badgeClass(entry.status)}>{entry.status}</span>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        await approveTimeEntry(entry.id);
                        setTimeEntries(await listTimeEntries(household.id));
                      }}
                    >
                      Approve time entry
                    </Button>
                  </div>
                </div>
              );
            })}
            {submittedEntries.length === 0 ? <p className="caption">No entries waiting for approval.</p> : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
