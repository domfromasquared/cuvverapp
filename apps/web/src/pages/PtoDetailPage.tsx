import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { useAppStore } from "../state/appStore";
import type { PtoRequest } from "../types/domain";
import { listPto, decidePto } from "../services/ptoApi";
import { createSystemEvent } from "../services/feedApi";
import { PermissionHelper } from "../permissions/permissionHelper";
import { useUi } from "../app/providers";
import { debugBadge } from "../dev/uiDebug";

export function PtoDetailPage(): JSX.Element {
  const { ptoId } = useParams();
  const { household, profile, role } = useAppStore();
  const { pushToast } = useUi();
  const [item, setItem] = useState<PtoRequest | null>(null);

  useEffect(() => {
    if (!household || !ptoId) return;
    void (async () => {
      const items = await listPto(household.id);
      setItem(items.find((entry) => entry.id === ptoId) ?? null);
    })();
  }, [household, ptoId]);

  if (!household || !profile || !ptoId || !item) {
    return (
      <Card data-ui="page-pto-detail-loading">
        {debugBadge("PtoDetailPage", "src/pages/PtoDetailPage.tsx")}
        <p>Loading PTO request...</p>
      </Card>
    );
  }

  const canApprove = PermissionHelper.canApprovePto(role);

  return (
    <Card data-ui="page-pto-detail">
      {debugBadge("PtoDetailPage", "src/pages/PtoDetailPage.tsx")}
      <h2 className="section-title">PTO detail</h2>
      <p>
        {item.start_date} to {item.end_date}
      </p>
      <p className="caption">Type: {item.type}</p>
      <p>{item.note ?? "No note."}</p>
      <p>
        Status: <span className={`badge ${item.status}`}>{item.status}</span>
      </p>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {canApprove && item.status === "pending" ? (
          <>
            <Button
              onClick={async () => {
                const result = await decidePto(item.id, "approved", profile.id);
                setItem(result);
                await createSystemEvent({
                  household_id: household.id,
                  author_user_id: profile.id,
                  title: "PTO approved",
                  body: `${result.start_date} to ${result.end_date}`,
                  pto_request_id: result.id
                });
                pushToast("PTO approved.");
              }}
            >
              Approve
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const result = await decidePto(item.id, "denied", profile.id);
                setItem(result);
                await createSystemEvent({
                  household_id: household.id,
                  author_user_id: profile.id,
                  title: "PTO denied",
                  body: `${result.start_date} to ${result.end_date}`,
                  pto_request_id: result.id
                });
                pushToast("PTO denied.");
              }}
            >
              Deny
            </Button>
          </>
        ) : null}

        <Link className="btn ghost" to={`/app/dm?context_type=pto&context_id=${item.id}`}>
          Message about this PTO
        </Link>
      </div>
    </Card>
  );
}
