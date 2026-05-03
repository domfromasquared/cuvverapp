import type { AssignmentStatus } from "../../types/domain";

const STATUS_LABEL: Record<AssignmentStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  changed: "Needs re-confirm",
  cancelled: "Cancelled",
};

const STATUS_CLASS: Record<AssignmentStatus, string> = {
  pending: "status-pending",
  accepted: "status-approved",
  declined: "status-rejected",
  changed: "status-submitted",
  cancelled: "status-rejected",
};

interface Props {
  status: AssignmentStatus;
}

export function AssignmentBadge({ status }: Props): JSX.Element {
  return (
    <span className={`status-chip ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
