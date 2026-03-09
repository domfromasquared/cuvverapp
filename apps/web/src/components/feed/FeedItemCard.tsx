import type { FeedItem } from "../../types/domain";
import { formatDateTime } from "../../utils/dates";
import { titleCase } from "../../utils/format";
import { Button } from "../common/Button";
import { Avatar } from "../common/Avatar";
import { debugBadge } from "../../dev/uiDebug";

export function FeedItemCard({
  item,
  onOpen,
  onPinToggle,
  canPin,
  authorLabel,
  authorAvatarUrl
}: {
  item: FeedItem;
  onOpen: (item: FeedItem) => void;
  onPinToggle: (item: FeedItem) => void;
  canPin: boolean;
  authorLabel?: string;
  authorAvatarUrl?: string | null;
}): JSX.Element {
  return (
    <article className="list-item timeline-row" data-ui="module-feed-item-card">
      {debugBadge("FeedItemCard", "src/components/feed/FeedItemCard.tsx")}
      <div className="timeline-main">
        <div className="section-row">
          <p className="kicker">
            {titleCase(item.type)} · {formatDateTime(item.created_at)}
          </p>
          {item.is_critical ? <span className="status-chip status-denied">Critical</span> : null}
        </div>
        <h3 className="title-tight">{item.title}</h3>
        {item.body ? <p className="text-reset">{item.body}</p> : null}
        {authorLabel ? (
          <div className="identity-row">
            <Avatar size="sm" name={authorLabel} src={authorAvatarUrl ?? null} />
            <p className="caption">By {authorLabel}</p>
          </div>
        ) : null}
      </div>
      <div className="actions">
        <Button variant="ghost" onClick={() => onOpen(item)}>
          Open
        </Button>
        {canPin ? (
          <Button variant="ghost" onClick={() => onPinToggle(item)}>
            {item.is_pinned ? "Unpin" : "Pin"}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
