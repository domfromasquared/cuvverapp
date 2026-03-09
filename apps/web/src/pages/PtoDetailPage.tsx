import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { Avatar } from "../components/common/Avatar";
import { useAppStore } from "../state/appStore";
import type { PtoRequest } from "../types/domain";
import { listPto, decidePto } from "../services/ptoApi";
import { createSystemEvent } from "../services/feedApi";
import { PermissionHelper } from "../permissions/permissionHelper";
import { useUi } from "../app/providers";
import { debugBadge } from "../dev/uiDebug";
import { resolveAvatarUrl } from "../services/profileApi";

export function PtoDetailPage(): JSX.Element {
  const { ptoId } = useParams();
  const { household, profile, role, members } = useAppStore();
  const { pushToast } = useUi();
  const [item, setItem] = useState<PtoRequest | null>(null);
  const [requesterAvatarUrl, setRequesterAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!household || !ptoId || !PermissionHelper.canViewPto(role)) return;
    void (async () => {
      const items = await listPto(household.id);
      setItem(items.find((entry) => entry.id === ptoId) ?? null);
    })();
  }, [household, ptoId, role]);

  const requester = members.find((member) => member.user_id === item?.user_id);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!requester) {
        setRequesterAvatarUrl(null);
        return;
      }
      try {
        const url = await resolveAvatarUrl({
          avatar_path: requester.avatar_path ?? null,
          avatar_url: requester.avatar_url ?? null
        });
        if (!cancelled) setRequesterAvatarUrl(url);
      } catch {
        if (!cancelled) setRequesterAvatarUrl(requester.avatar_url ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requester]);

  if (!PermissionHelper.canViewPto(role)) {
    return <EmptyState title="No PTO access" body="Your role does not have access to PTO details." />;
  }

  if (!household || !profile || !ptoId || !item) {
    return (
      <Card data-ui="page-pto-detail-loading">
        {debugBadge("PtoDetailPage", "src/pages/PtoDetailPage.tsx")}
        <p>Loading PTO request...</p>
      </Card>
    );
  }

  const canApprove = PermissionHelper.canApprovePto(role);
  const requesterLabel = requester?.display_name || requester?.email || item.user_id;

  return (
    <Card data-ui="page-pto-detail">
      {debugBadge("PtoDetailPage", "src/pages/PtoDetailPage.tsx")}
      <h2 className="section-title">PTO detail</h2>
      <p>
        {item.start_date} to {item.end_date}
      </p>
      <div className="identity-row">
        <Avatar size="sm" name={requesterLabel} src={requesterAvatarUrl} />
        <p className="caption">Requester: {requesterLabel}</p>
      </div>
      <p className="caption">Type: {item.type}</p>
      <p>{item.note ?? "No note."}</p>
      <p>
        Status: <span className={`badge ${item.status}`}>{item.status}</span>
      </p>
      <div className="actions">
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

        {PermissionHelper.canOpenDm(role, household.admin_controls) ? (
          <Link className="btn ghost" to={`/app/dm?context_type=pto&context_id=${item.id}`}>
            Open context chat
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
