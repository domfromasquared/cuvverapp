import type { ReadReceipt } from "../../types/domain";
import { formatDateTime } from "../../utils/dates";
import { debugBadge } from "../../dev/uiDebug";

export function SeenByDrawer({ receipts }: { receipts: ReadReceipt[] }): JSX.Element {
  return (
    <section className="card" data-ui="module-seen-by-drawer">
      {debugBadge("SeenByDrawer", "src/components/feed/SeenByDrawer.tsx")}
      <h3 style={{ marginTop: 0 }}>Seen by</h3>
      {receipts.length === 0 ? <p className="caption">No read receipts yet.</p> : null}
      <div className="list">
        {receipts.map((receipt) => (
          <div key={receipt.id} className="list-item">
            <p style={{ margin: 0 }}>{receipt.user_id}</p>
            <p className="caption" style={{ margin: 0 }}>
              {formatDateTime(receipt.seen_at)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
