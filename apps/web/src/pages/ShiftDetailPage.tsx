import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { useAppStore } from "../state/appStore";
import { getShift, updateShift } from "../services/scheduleApi";
import type { Shift } from "../types/domain";
import { toInputDateTime } from "../utils/dates";
import { useUi } from "../app/providers";
import { debugBadge } from "../dev/uiDebug";

export function ShiftDetailPage(): JSX.Element {
  const { shiftId } = useParams();
  const { household } = useAppStore();
  const { pushToast } = useUi();
  const [shift, setShift] = useState<Shift | null>(null);

  useEffect(() => {
    if (!shiftId) return;
    void getShift(shiftId).then(setShift);
  }, [shiftId]);

  if (!household || !shiftId || !shift) {
    return (
      <Card data-ui="page-shift-detail-loading">
        {debugBadge("ShiftDetailPage", "src/pages/ShiftDetailPage.tsx")}
        <p>Loading shift...</p>
      </Card>
    );
  }

  return (
    <Card data-ui="page-shift-detail">
      {debugBadge("ShiftDetailPage", "src/pages/ShiftDetailPage.tsx")}
      <h2 className="section-title">Shift detail</h2>
      <form
        className="stack"
        data-ui="shift-detail-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const title = (form.elements.namedItem("title") as HTMLInputElement).value.trim();
          const start = (form.elements.namedItem("start") as HTMLInputElement).value;
          const end = (form.elements.namedItem("end") as HTMLInputElement).value;
          const recurrence = (form.elements.namedItem("recurrence") as HTMLInputElement).value.trim();
          const notes = (form.elements.namedItem("notes") as HTMLTextAreaElement).value.trim();

          try {
            const updated = await updateShift(shiftId, {
              title,
              start_datetime: new Date(start).toISOString(),
              end_datetime: new Date(end).toISOString(),
              recurrence_rule: recurrence || null,
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
          <label htmlFor="detail-recurrence">Recurrence rule</label>
          <input id="detail-recurrence" name="recurrence" className="input" defaultValue={shift.recurrence_rule ?? ""} />
        </div>
        <div className="form-row">
          <label htmlFor="detail-notes">Notes</label>
          <textarea id="detail-notes" name="notes" className="textarea" defaultValue={shift.notes ?? ""} />
        </div>
        <div className="actions">
          <Button type="submit">Save</Button>
          <Link className="btn ghost" to={`/app/dm?context_type=shift&context_id=${shift.id}`}>
            Message about this shift
          </Link>
        </div>
      </form>
    </Card>
  );
}
