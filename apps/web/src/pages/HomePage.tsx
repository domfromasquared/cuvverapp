import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { useAppStore } from "../state/appStore";
import { PermissionHelper } from "../permissions/permissionHelper";
import { listShifts, listTimeEntries, clockIn, clockOut } from "../services/scheduleApi";
import { listFeed } from "../services/feedApi";
import { listPto } from "../services/ptoApi";
import type { FeedItem, PtoRequest, Shift, TimeEntry } from "../types/domain";
import { formatDateTime } from "../utils/dates";
import { useUi } from "../app/providers";
import { debugBadge } from "../dev/uiDebug";

type HomeData = {
  shifts: Shift[];
  entries: TimeEntry[];
  feed: FeedItem[];
  pto: PtoRequest[];
};

function metric(label: string, value: number, link: string): JSX.Element {
  return (
    <Link className="list-item metric-item" to={link}>
      <p className="caption">{label}</p>
      <p className="detail-value">{value}</p>
    </Link>
  );
}

export function HomePage(): JSX.Element {
  const { household, profile, role } = useAppStore();
  const { pushToast } = useUi();
  const [data, setData] = useState<HomeData>({ shifts: [], entries: [], feed: [], pto: [] });

  useEffect(() => {
    if (!household || !role) return;
    void (async () => {
      const [shiftsResult, entriesResult, feedResult, ptoResult] = await Promise.allSettled([
        listShifts(household.id),
        PermissionHelper.canTrackTime(role) || PermissionHelper.canApproveTimeEntries(role)
          ? listTimeEntries(household.id)
          : Promise.resolve([] as TimeEntry[]),
        listFeed(household.id),
        PermissionHelper.canViewPto(role) ? listPto(household.id) : Promise.resolve([] as PtoRequest[])
      ]);
      setData({
        shifts: shiftsResult.status === "fulfilled" ? shiftsResult.value : [],
        entries: entriesResult.status === "fulfilled" ? entriesResult.value : [],
        feed: feedResult.status === "fulfilled" ? feedResult.value : [],
        pto: ptoResult.status === "fulfilled" ? ptoResult.value : []
      });
    })();
  }, [household, role]);

  if (!household || !profile) return <div />;

  const isAdmin = PermissionHelper.canAdminHousehold(role);
  const isCaregiver = role === "caregiver";
  const isViewer = role === "viewer";

  const now = Date.now();
  const upcomingShifts = data.shifts.filter((shift) => new Date(shift.end_datetime).getTime() >= now);
  const nextShift =
    upcomingShifts.find((shift) => shift.caregiver_user_id === profile.id) ??
    upcomingShifts.find((shift) => shift.caregiver_user_id === null) ??
    null;
  const myOpenEntry = data.entries.find((entry) => entry.user_id === profile.id && entry.status === "open") ?? null;
  const criticalCount = data.feed.filter((item) => item.is_critical).length;
  const pendingPtoCount = data.pto.filter((item) => item.status === "pending").length;
  const pendingTimeApprovals = data.entries.filter((entry) => entry.status === "submitted").length;
  const recentUpdates = data.feed.slice(0, 4);

  return (
    <div className="stack" data-ui="page-home">
      {debugBadge("HomePage", "src/pages/HomePage.tsx")}
      <Card data-ui="home-hero">
        <h2 className="section-title">
          {isAdmin ? "Operations overview" : isCaregiver ? "Today at a glance" : "Household pulse"}
        </h2>
        <p className="caption">
          {isAdmin
            ? "Monitor approvals, updates, and upcoming coverage."
            : isCaregiver
              ? "Start shifts faster and keep updates moving."
              : "Follow key updates and upcoming care coverage."}
        </p>
      </Card>

      {isAdmin ? (
        <Card data-ui="home-admin-metrics">
          <h3 className="title-reset">Priority queues</h3>
          <div className="metric-grid">
            {metric("Pending PTO", pendingPtoCount, "/app/pto")}
            {metric("Time approvals", pendingTimeApprovals, "/app/schedule")}
            {metric("Critical updates", criticalCount, "/app/feed")}
            {metric("Upcoming shifts", upcomingShifts.length, "/app/schedule")}
          </div>
        </Card>
      ) : null}

      {isCaregiver ? (
        <Card data-ui="home-caregiver-today">
          <h3 className="title-reset">Shift actions</h3>
          {nextShift ? (
            <div className="list-item">
              <p className="caption">Next shift</p>
              <h3 className="title-tight">{nextShift.title}</h3>
              <p className="caption">{formatDateTime(nextShift.start_datetime)}</p>
              <div className="actions actions-spaced">
                <Link className="btn ghost" to={`/app/shift/${nextShift.id}`}>
                  Open shift
                </Link>
                {!myOpenEntry ? (
                  <Button
                    onClick={async () => {
                      try {
                        await clockIn(household.id, nextShift.id, profile.id);
                        const entries = await listTimeEntries(household.id);
                        setData((prev) => ({ ...prev, entries }));
                      } catch (error) {
                        pushToast(error instanceof Error ? error.message : "Unable to clock in.");
                      }
                    }}
                  >
                    Clock in
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await clockOut(myOpenEntry.id);
                        const entries = await listTimeEntries(household.id);
                        setData((prev) => ({ ...prev, entries }));
                      } catch (error) {
                        pushToast(error instanceof Error ? error.message : "Unable to clock out.");
                      }
                    }}
                  >
                    Clock out
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <EmptyState title="No assigned shift" body="You have no active or upcoming assigned shifts." />
          )}
        </Card>
      ) : null}

      {isViewer ? (
        <Card data-ui="home-viewer-upcoming">
          <h3 className="title-reset">Upcoming schedule</h3>
          <div className="list">
            {upcomingShifts.slice(0, 4).map((shift) => (
              <div key={shift.id} className="list-item">
                <h3 className="title-tight">{shift.title}</h3>
                <p className="caption">{formatDateTime(shift.start_datetime)}</p>
              </div>
            ))}
            {upcomingShifts.length === 0 ? <p className="caption">No upcoming shifts.</p> : null}
          </div>
        </Card>
      ) : null}

      <Card data-ui="home-recent-updates">
        <div className="section-row">
          <h3 className="title-reset">Recent updates</h3>
          <Link className="btn ghost" to="/app/feed">
            Open feed
          </Link>
        </div>
        <div className="list">
          {recentUpdates.map((item) => (
            <div key={item.id} className="list-item">
              <p className="kicker">
                {item.type.replace("_", " ")} · {formatDateTime(item.created_at)}
              </p>
              <h3 className="title-tight">{item.title}</h3>
              {item.body ? <p className="caption">{item.body}</p> : null}
            </div>
          ))}
          {recentUpdates.length === 0 ? <p className="caption">No updates yet.</p> : null}
        </div>
      </Card>
    </div>
  );
}
