import type { FeedItem } from "../../types/domain";
import { formatDateTime } from "../../utils/dates";
import { titleCase } from "../../utils/format";
import { Button } from "../common/Button";
import { debugBadge } from "../../dev/uiDebug";

export function FeedItemCard({
  item,
  onOpen,
  onPinToggle,
  canPin
}: {
  item: FeedItem;
  onOpen: (item: FeedItem) => void;
  onPinToggle: (item: FeedItem) => void;
  canPin: boolean;
}): JSX.Element {
  return (
    <article className="list-item" data-ui="module-feed-item-card">
      {debugBadge("FeedItemCard", "src/components/feed/FeedItemCard.tsx")}
      <p className="kicker">
        {titleCase(item.type)} · {formatDateTime(item.created_at)}
      </p>
      <h3 style={{ margin: "6px 0" }}>{item.title}</h3>
      {item.body ? <p style={{ marginTop: 0 }}>{item.body}</p> : null}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <Button variant="ghost" onClick={() => onOpen(item)}>
          Open
        </Button>
        {canPin ? (
          <Button variant="ghost" onClick={() => onPinToggle(item)}>
            {item.is_pinned ? "Unpin" : "Pin"}
          </Button>
        ) : null}
        {item.is_critical ? <span className="badge">Critical</span> : null}
      </div>
    </article>
  );
}
