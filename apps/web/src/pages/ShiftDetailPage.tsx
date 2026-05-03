import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { AssignmentBadge } from "../components/schedule/AssignmentBadge";
import { useAppStore } from "../state/appStore";
import { PermissionHelper } from "../permissions/permissionHelper";
import { getShift, updateShift, listAssignmentsForShift, respondToAssignment, assignShift } from "../services/scheduleApi";
import type { Shift, ShiftAssignment } from "../types/domain";
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

function AssignmentSection({
  shift,
  assignment,
  onRespond,
  onReassign,
  onCancel,
  isAdmin,
  isAssignedCaregiver,
  memberNameById,
  caregiverOptions,
}: {
  shift: Shift;
  assignment: ShiftAssignment | null;
  onRespond: (response: "accepted" | "declined", note?: string) => Promise<void>;
  onReassign: (caregiverUserId: string) => Promise<void>;
  onCancel: () => Promise<void>;
  isAdmin: boolean;
  isAssignedCaregiver: boolean;
  memberNameById: Map<string, string>;
  caregiverOptions: { user_id: string; display_name?: string; email?: string }[];
}): JSX.Element {
  const [declineNote, setDeclineNote] = useState("");
  const [responding, setResponding] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [selectedCaregiver, setSelectedCaregiver] = useState("");

  if (!assignment) {
    if (!isAdmin) return <></>;
    return (
      <section className="stack" data-ui="shift-assignment-section">
        <h3 className="section-title">Assignment</h3>
        <p className="caption">No caregiver assigned.</p>
        <div className="form-row">
          <label htmlFor="reassign-caregiver">Assign caregiver</label>
          <select
            id="reassign-caregiver"
            className="select"
            value={selectedCaregiver}
            onChange={(e) => setSelectedCaregiver(e.target.value)}
          >
            <option value="">Select a caregiver</option>
            {caregiverOptions.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name || m.email || m.user_id}
              </option>
            ))}
          </select>
        </div>
        <Button
          disabled={!selectedCaregiver}
          onClick={async () => {
            if (!selectedCaregiver) return;
            await onReassign(selectedCaregiver);
            setSelectedCaregiver("");
          }}
        >
          Assign
        </Button>
      </section>
    );
  }

  // Admin view
  if (isAdmin) {
    return (
      <section className="stack" data-ui="shift-assignment-section">
        <h3 className="section-title">Assignment</h3>
        <div className="list-item">
          <div>
            <p className="text-reset">{memberNameById.get(assignment.caregiver_user_id) ?? assignment.caregiver_user_id}</p>
            <AssignmentBadge status={assignment.status} />
            {assignment.responded_at ? (
              <p className="caption">Responded {formatDateTime(assignment.responded_at)}</p>
            ) : null}
            {assignment.response_note ? (
              <p className="caption">Note: {assignment.response_note}</p>
            ) : null}
          </div>
        </div>
        {showReassign ? (
          <div className="stack">
            <div className="form-row">
              <label htmlFor="reassign-caregiver">Reassign to</label>
              <select
                id="reassign-caregiver"
                className="select"
                value={selectedCaregiver}
                onChange={(e) => setSelectedCaregiver(e.target.value)}
              >
                <option value="">Select a caregiver</option>
                {caregiverOptions.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name || m.email || m.user_id}
                  </option>
                ))}
              </select>
            </div>
            <div className="actions">
              <Button
                disabled={!selectedCaregiver}
                onClick={async () => {
                  if (!selectedCaregiver) return;
                  await onReassign(selectedCaregiver);
                  setShowReassign(false);
                  setSelectedCaregiver("");
                }}
              >
                Confirm reassign
              </Button>
              <Button variant="secondary" onClick={() => setShowReassign(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="actions">
            <Button variant="secondary" onClick={() => setShowReassign(true)}>
              Reassign
            </Button>
            {assignment.status !== "cancelled" ? (
              <Button variant="secondary" onClick={onCancel}>
                Cancel assignment
              </Button>
            ) : null}
          </div>
        )}
      </section>
    );
  }

  // Caregiver view — needs action
  if (isAssignedCaregiver && (assignment.status === "pending" || assignment.status === "changed")) {
    return (
      <section className="stack" data-ui="shift-assignment-section">
        <Card data-ui="shift-confirm-card">
          <h3 className="section-title">Please confirm this shift</h3>
          {assignment.status === "changed" ? (
            <div className="stack">
              <p className="caption" style={{ color: "var(--color-warning)" }}>
                This shift was edited after you accepted. Please re-confirm.
              </p>
              <div className="grid-2">
                <div>
                  <p className="caption">Original</p>
                  <p className="text-reset">{formatDateTime(assignment.snapshot_start)}</p>
                  <p className="text-reset">— {formatDateTime(assignment.snapshot_end)}</p>
                </div>
                <div>
                  <p className="caption">Updated</p>
                  <p className="text-reset">{formatDateTime(shift.start_datetime)}</p>
                  <p className="text-reset">— {formatDateTime(shift.end_datetime)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-reset">{shift.title}</p>
              <p className="caption">
                {formatDateTime(shift.start_datetime)} — {formatDateTime(shift.end_datetime)}
              </p>
            </div>
          )}
          <div className="form-row">
            <label htmlFor="decline-note">Note (required when declining)</label>
            <textarea
              id="decline-note"
              className="textarea"
              placeholder="Optional note for accepting; required for declining"
              value={declineNote}
              onChange={(e) => setDeclineNote(e.target.value)}
            />
          </div>
          <div className="actions">
            <Button
              disabled={responding}
              onClick={async () => {
                setResponding(true);
                try {
                  await onRespond("accepted", declineNote.trim() || undefined);
                } finally {
                  setResponding(false);
                }
              }}
            >
              Accept shift
            </Button>
            <Button
              variant="secondary"
              disabled={responding || !declineNote.trim()}
              onClick={async () => {
                setResponding(true);
                try {
                  await onRespond("declined", declineNote.trim());
                } finally {
                  setResponding(false);
                }
              }}
            >
              Decline
            </Button>
          </div>
        </Card>
      </section>
    );
  }

  // Caregiver view — settled states
  if (isAssignedCaregiver) {
    if (assignment.status === "accepted") {
      return (
        <section data-ui="shift-assignment-section">
          <p className="caption" style={{ color: "var(--color-success)" }}>
            You accepted this shift{assignment.responded_at ? ` on ${formatDateTime(assignment.responded_at)}` : ""}.
          </p>
        </section>
      );
    }
    if (assignment.status === "declined") {
      return (
        <section data-ui="shift-assignment-section">
          <p className="caption" style={{ color: "var(--color-error)" }}>
            You declined this shift{assignment.responded_at ? ` on ${formatDateTime(assignment.responded_at)}` : ""}.
            {assignment.response_note ? ` Note: ${assignment.response_note}` : ""}
          </p>
        </section>
      );
    }
    if (assignment.status === "cancelled") {
      return (
        <section data-ui="shift-assignment-section">
          <p className="caption" style={{ color: "var(--color-text-muted)" }}>
            Assignment cancelled.
          </p>
        </section>
      );
    }
  }

  return <></>;
}

export function ShiftDetailPage(): JSX.Element {
  const { shiftId } = useParams();
  const { household, profile, role, members } = useAppStore();
  const { pushToast } = useUi();
  const [shift, setShift] = useState<Shift | null>(null);
  const [assignment, setAssignment] = useState<ShiftAssignment | null>(null);
  const [recurrencePreset, setRecurrencePreset] = useState<RecurrencePreset>("none");
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<WeekdayCode[]>(["MO"]);
  const [recurrenceCustom, setRecurrenceCustom] = useState("");

  useEffect(() => {
    if (!shiftId) return;
    void (async () => {
      const [next, rows] = await Promise.all([
        getShift(shiftId),
        listAssignmentsForShift(shiftId),
      ]);
      setShift(next);
      setAssignment(rows[0] ?? null);
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
  const isAdmin = PermissionHelper.canAdminHousehold(role);
  const caregiverOptions = members.filter((m) => m.role === "caregiver");
  const assignedMember = members.find((member) => member.user_id === shift.caregiver_user_id);
  const isAssignedCaregiver = !!profile && assignment?.caregiver_user_id === profile.id;

  const memberNameById = new Map<string, string>();
  members.forEach((m) => memberNameById.set(m.user_id, m.display_name || m.email || m.user_id));
  if (profile) memberNameById.set(profile.id, profile.display_name || profile.email || "You");

  const refreshAssignment = async () => {
    const rows = await listAssignmentsForShift(shiftId);
    setAssignment(rows[0] ?? null);
  };

  const handleRespond = async (response: "accepted" | "declined", note?: string) => {
    if (!assignment) return;
    try {
      await respondToAssignment(assignment.id, response, note);
      await refreshAssignment();
      pushToast(response === "accepted" ? "Shift accepted." : "Shift declined.");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Unable to respond.");
    }
  };

  const handleReassign = async (caregiverUserId: string) => {
    try {
      await assignShift(household.id, shiftId, caregiverUserId);
      const next = await getShift(shiftId);
      setShift(next);
      await refreshAssignment();
      pushToast("Caregiver assigned.");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Unable to assign caregiver.");
    }
  };

  const handleCancelAssignment = async () => {
    if (!assignment) return;
    try {
      const { supabase } = await import("../lib/supabaseClient");
      const { error } = await supabase
        .from("shift_assignments")
        .update({ status: "cancelled" })
        .eq("id", assignment.id);
      if (error) throw error;
      await refreshAssignment();
      pushToast("Assignment cancelled.");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Unable to cancel assignment.");
    }
  };

  if (!canEditShift) {
    return (
      <div className="stack" data-ui="page-shift-detail-readonly">
        {debugBadge("ShiftDetailPage", "src/pages/ShiftDetailPage.tsx")}
        <Card>
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
        <AssignmentSection
          shift={shift}
          assignment={assignment}
          onRespond={handleRespond}
          onReassign={handleReassign}
          onCancel={handleCancelAssignment}
          isAdmin={false}
          isAssignedCaregiver={isAssignedCaregiver}
          memberNameById={memberNameById}
          caregiverOptions={caregiverOptions}
        />
      </div>
    );
  }

  return (
    <div className="stack" data-ui="page-shift-detail">
      {debugBadge("ShiftDetailPage", "src/pages/ShiftDetailPage.tsx")}
      <Card>
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
              // Refresh assignment — the DB trigger may have flipped status to 'changed'.
              await refreshAssignment();
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

      <AssignmentSection
        shift={shift}
        assignment={assignment}
        onRespond={handleRespond}
        onReassign={handleReassign}
        onCancel={handleCancelAssignment}
        isAdmin={isAdmin}
        isAssignedCaregiver={isAssignedCaregiver}
        memberNameById={memberNameById}
        caregiverOptions={caregiverOptions}
      />
    </div>
  );
}
