import { useEffect, useMemo, useState } from "react";
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

const PTO_TYPES: Array<{ value: PtoRequest["type"]; label: string }> = [
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick" },
  { value: "personal", label: "Personal" },
  { value: "other", label: "Other" }
];

type RequestView = "mine" | "all";

function statusClass(status: PtoRequest["status"]): string {
  return `status-chip status-${status}`.trim();
}

export function PtoPage(): JSX.Element {
  const { household, profile, role, members } = useAppStore();
  const { pushToast } = useUi();
  const [items, setItems] = useState<PtoRequest[]>([]);
  const [requestView, setRequestView] = useState<RequestView>("mine");
  const [requestType, setRequestType] = useState<PtoRequest["type"]>("vacation");

  useEffect(() => {
    if (!household || !PermissionHelper.canViewPto(role)) return;
    void listPto(household.id).then(setItems);
  }, [household, role]);

  const memberById = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((member) => {
      map.set(member.user_id, member.display_name || member.email || member.user_id);
    });
    if (profile) map.set(profile.id, profile.display_name || profile.email || "You");
    return map;
  }, [members, profile]);

  if (!household || !profile) return <div />;
  if (!PermissionHelper.canViewPto(role)) {
    return (
      <div className="stack" data-ui="page-pto-no-access">
        {debugBadge("PtoPage", "src/pages/PtoPage.tsx")}
        <EmptyState title="PTO is not available for your role" body="Owners and caregivers manage PTO requests." />
      </div>
    );
  }

  const canApprove = PermissionHelper.canApprovePto(role);
  const canRequest = PermissionHelper.canRequestPto(role);
  const pendingApprovals = items.filter((item) => item.status === "pending");
  const visibleRequests =
    requestView === "mine"
      ? items.filter((item) => item.user_id === profile.id)
      : items;

  return (
    <div className="stack" data-ui="page-pto">
      {debugBadge("PtoPage", "src/pages/PtoPage.tsx")}
      <Card data-ui="pto-header-card">
        <h2 className="section-title">Time off</h2>
        <p className="caption">
          {canApprove
            ? "Review pending requests and keep team coverage clear."
            : "Request time off and track request status."}
        </p>
      </Card>

      {canRequest ? (
        <Card data-ui="pto-request-card">
          <h3 className="title-reset">Request time off</h3>
          <form
            className="stack"
            data-ui="pto-request-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const startDate = (form.elements.namedItem("start") as HTMLInputElement).value;
              const endDate = (form.elements.namedItem("end") as HTMLInputElement).value;
              const note = (form.elements.namedItem("note") as HTMLTextAreaElement).value.trim();

              if (!startDate || !endDate || startDate > endDate) {
                pushToast("Select a valid PTO date range.");
                return;
              }

              const pto = await requestPto({
                household_id: household.id,
                user_id: profile.id,
                start_date: startDate,
                end_date: endDate,
                type: requestType,
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
              setRequestType("vacation");
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
              <label>Type</label>
              <div className="segmented">
                {PTO_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    className={`segment ${requestType === type.value ? "active" : ""}`.trim()}
                    onClick={() => setRequestType(type.value)}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-row">
              <label htmlFor="pto-note">Notes</label>
              <textarea id="pto-note" name="note" className="textarea" placeholder="Optional context for approvers." />
            </div>
            <Button type="submit">Submit request</Button>
          </form>
        </Card>
      ) : null}

      {canApprove ? (
        <Card data-ui="pto-approvals-card">
          <h3 className="title-reset">Pending approvals</h3>
          <div className="list">
            {pendingApprovals.map((item) => (
              <article className="list-item" key={item.id}>
                <h3 className="title-tight">
                  {item.start_date} to {item.end_date}
                </h3>
                <p className="caption">{memberById.get(item.user_id) ?? item.user_id}</p>
                <div className="actions actions-spaced">
                  <span className={statusClass(item.status)}>{item.status}</span>
                  <Link className="btn secondary" to={`/app/pto/${item.id}`}>
                    Review request
                  </Link>
                </div>
              </article>
            ))}
            {pendingApprovals.length === 0 ? <p className="caption">No pending requests.</p> : null}
          </div>
        </Card>
      ) : null}

      <Card data-ui="pto-requests-card">
        <div className="section-row">
          <h3 className="title-reset">Request history</h3>
          <div className="chip-row">
            <button
              type="button"
              className={`chip-toggle ${requestView === "mine" ? "active" : ""}`.trim()}
              onClick={() => setRequestView("mine")}
            >
              My requests
            </button>
            <button
              type="button"
              className={`chip-toggle ${requestView === "all" ? "active" : ""}`.trim()}
              onClick={() => setRequestView("all")}
            >
              All requests
            </button>
          </div>
        </div>
        {visibleRequests.length === 0 ? <EmptyState title="No requests" body="Requests will appear here after submission." /> : null}
        <div className="list" data-ui="pto-requests-list">
          {visibleRequests.map((item) => (
            <article className="list-item" key={item.id} data-ui="pto-request-item">
              <h3 className="title-tight">
                {item.start_date} to {item.end_date}
              </h3>
              <p className="caption">
                {item.type} · {memberById.get(item.user_id) ?? item.user_id}
              </p>
              <div className="actions actions-spaced">
                <span className={statusClass(item.status)}>{item.status}</span>
                <Link className="btn ghost" to={`/app/pto/${item.id}`}>
                  Open
                </Link>
                {PermissionHelper.canOpenDm(role, household.admin_controls) ? (
                  <Link className="btn ghost" to={`/app/dm?context_type=pto&context_id=${item.id}`}>
                    Chat
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </Card>
    </div>
  );
}
