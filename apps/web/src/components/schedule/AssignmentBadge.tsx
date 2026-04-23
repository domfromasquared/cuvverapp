import type { AssignmentStatus } from "../../types/domain";

interface AssignmentBadgeProps {
  status: AssignmentStatus;
  className?: string;
}

const STATUS_LABEL: Record<AssignmentStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  changed: "Needs re-confirm",
  cancelled: "Cancelled"
};

/**
 * Pure status-to-pill renderer for shift assignment state. Reused on the
 * schedule list and the shift detail page. Dumb on purpose — no data
 * fetching, no side effects.
 */
export function AssignmentBadge({ status, className }: AssignmentBadgeProps): JSX.Element {
  const classes = ["status-chip", `status-${status}`];
  if (className) classes.push(className);
  return (
    <span className={classes.join(" ")} data-ui="assignment-badge" data-status={status}>
      {STATUS_LABEL[status]}
    </span>
  );
}
