import type { ReadReceipt } from "../../types/domain";
import { formatDateTime } from "../../utils/dates";
import { debugBadge } from "../../dev/uiDebug";

export function SeenByDrawer({ receipts, getUserLabel }: { receipts: ReadReceipt[]; getUserLabel?: (userId: string) => string }): JSX.Element {
  return (
    <section className="card" data-ui="module-seen-by-drawer">
      {debugBadge("SeenByDrawer", "src/components/feed/SeenByDrawer.tsx")}
      <h3 className="title-reset">Seen by</h3>
      {receipts.length === 0 ? <p className="caption">No read receipts yet.</p> : null}
      <div className="list">
        {receipts.map((receipt) => (
          <div key={receipt.id} className="list-item">
            <p className="text-reset">{getUserLabel?.(receipt.user_id) ?? receipt.user_id}</p>
            <p className="caption">
              {formatDateTime(receipt.seen_at)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
