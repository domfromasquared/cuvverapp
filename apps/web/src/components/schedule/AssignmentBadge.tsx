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

const STATUS_CLASS: Record<AssignmentStatus, string> = {
  pending: "status-pending",
  accepted: "status-approved",
  declined: "status-rejected",
  changed: "status-submitted",
  cancelled: "status-rejected"
};

export function AssignmentBadge({ status, className }: AssignmentBadgeProps): JSX.Element {
  const classes = ["status-chip", STATUS_CLASS[status]];
  if (className) classes.push(className);
  return (
    <span className={classes.join(" ")} data-ui="assignment-badge" data-status={status}>
      {STATUS_LABEL[status]}
    </span>
  );
}
