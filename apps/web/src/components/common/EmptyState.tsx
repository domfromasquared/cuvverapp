import { debugBadge } from "../../dev/uiDebug";

export function EmptyState({ title, body }: { title: string; body: string }): JSX.Element {
  return (
    <div className="empty" data-ui="module-empty-state">
      {debugBadge("EmptyState", "src/components/common/EmptyState.tsx")}
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
