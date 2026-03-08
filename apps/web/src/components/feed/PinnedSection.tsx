import type { FeedItem } from "../../types/domain";
import { FeedItemCard } from "./FeedItemCard";
import { debugBadge } from "../../dev/uiDebug";

export function PinnedSection({
  items,
  onOpen,
  onPinToggle,
  canPin,
  getAuthorLabel
}: {
  items: FeedItem[];
  onOpen: (item: FeedItem) => void;
  onPinToggle: (item: FeedItem) => void;
  canPin: boolean;
  getAuthorLabel?: (userId: string) => string;
}): JSX.Element | null {
  if (items.length === 0) return null;

  return (
    <section className="stack" data-ui="module-pinned-section">
      {debugBadge("PinnedSection", "src/components/feed/PinnedSection.tsx")}
      <h2 className="section-title">Pinned</h2>
      <div className="list" data-ui="module-pinned-list">
        {items.map((item) => (
          <FeedItemCard
            key={item.id}
            item={item}
            onOpen={onOpen}
            onPinToggle={onPinToggle}
            canPin={canPin}
            authorLabel={getAuthorLabel?.(item.author_user_id)}
          />
        ))}
      </div>
    </section>
  );
}
