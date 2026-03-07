import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { useAppStore } from "../state/appStore";
import { listPto, requestPto } from "../services/ptoApi";
import { createSystemEvent } from "../services/feedApi";
import type { PtoRequest } from "../types/domain";
import { PermissionHelper } from "../permissions/permissionHelper";
import { useUi } from "../app/providers";
import { debugBadge } from "../dev/uiDebug";

export function PtoPage(): JSX.Element {
  const { household, profile, role } = useAppStore();
  const { pushToast } = useUi();
  const [items, setItems] = useState<PtoRequest[]>([]);

  useEffect(() => {
    if (!household) return;
    void listPto(household.id).then(setItems);
  }, [household]);

  if (!household || !profile) return <div />;

  return (
    <div className="stack" data-ui="page-pto">
      {debugBadge("PtoPage", "src/pages/PtoPage.tsx")}
      <Card data-ui="pto-request-card">
        <h2 className="section-title">PTO</h2>
        <p className="caption">Request and approve time off with clear status.</p>
        <form
          className="stack"
          data-ui="pto-request-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const startDate = (form.elements.namedItem("start") as HTMLInputElement).value;
            const endDate = (form.elements.namedItem("end") as HTMLInputElement).value;
            const type = (form.elements.namedItem("type") as HTMLSelectElement).value as PtoRequest["type"];
            const note = (form.elements.namedItem("note") as HTMLTextAreaElement).value.trim();

            if (!startDate || !endDate || startDate > endDate) {
              pushToast("Provide a valid PTO range.");
              return;
            }

            const pto = await requestPto({
              household_id: household.id,
              user_id: profile.id,
              start_date: startDate,
              end_date: endDate,
              type,
              note: note || null
            });

            await createSystemEvent({
              household_id: household.id,
              author_user_id: profile.id,
              title: "PTO requested",
              body: `${startDate} to ${endDate}`,
              pto_request_id: pto.id,
              is_critical: false
            });

            setItems(await listPto(household.id));
            pushToast("PTO request submitted.");
            form.reset();
          }}
        >
          <div className="grid-2">
            <div className="form-row">
              <label htmlFor="pto-start">Start date</label>
              <input id="pto-start" className="input" type="date" name="start" required />
            </div>
            <div className="form-row">
              <label htmlFor="pto-end">End date</label>
              <input id="pto-end" className="input" type="date" name="end" required />
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="pto-type">Type</label>
            <select id="pto-type" name="type" className="select">
              <option value="vacation">Vacation</option>
              <option value="sick">Sick</option>
              <option value="personal">Personal</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="pto-note">Note</label>
            <textarea id="pto-note" name="note" className="textarea" />
          </div>
          <Button type="submit">Request PTO</Button>
        </form>
      </Card>

      <section className="stack" data-ui="pto-requests-section">
        <h2 className="section-title">Requests</h2>
        {items.length === 0 ? <EmptyState title="No PTO requests" body="Submitted requests appear here." /> : null}
        <div className="list" data-ui="pto-requests-list">
          {items.map((item) => (
            <article className="list-item" key={item.id} data-ui="pto-request-item">
              <h3 className="title-tight">{item.start_date} to {item.end_date}</h3>
              <p className="caption">
                {item.type} · <span className={`badge ${item.status}`}>{item.status}</span>
              </p>
              <div className="actions actions-spaced">
                <Link className="btn ghost" to={`/app/pto/${item.id}`}>
                  Open
                </Link>
                {PermissionHelper.canApprovePto(role) ? (
                  <Link className="btn ghost" to={`/app/dm?context_type=pto&context_id=${item.id}`}>
                    Message about this PTO
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
