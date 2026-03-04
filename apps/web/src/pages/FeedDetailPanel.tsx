import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { SeenByDrawer } from "../components/feed/SeenByDrawer";
import { useAppStore } from "../state/appStore";
import {
  acknowledge,
  addComment,
  listAcknowledgements,
  listAttachments,
  listComments,
  listFeed,
  listReadReceipts,
  markSeen
} from "../services/feedApi";
import type { Acknowledgement, Attachment, Comment, FeedItem, ReadReceipt } from "../types/domain";
import { PermissionHelper } from "../permissions/permissionHelper";
import { useUi } from "../app/providers";
import { debugBadge } from "../dev/uiDebug";

export function FeedDetailPanel(): JSX.Element {
  const { feedItemId } = useParams();
  const { household, profile, role } = useAppStore();
  const controls = household?.admin_controls ?? null;
  const { pushToast } = useUi();

  const [item, setItem] = useState<FeedItem | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [acks, setAcks] = useState<Acknowledgement[]>([]);
  const [attachments, setAttachments] = useState<Array<Attachment & { signed_url: string }>>([]);
  const [receipts, setReceipts] = useState<ReadReceipt[]>([]);

  useEffect(() => {
    if (!household || !feedItemId || !profile) return;

    void (async () => {
      const all = await listFeed(household.id);
      const found = all.find((feed) => feed.id === feedItemId) ?? null;
      setItem(found);
      if (!found) return;

      setComments(await listComments(found.id));
      setAcks(await listAcknowledgements(found.id));
      setAttachments(await listAttachments(found.id));

      if (found.is_critical) {
        await markSeen(household.id, found.id, profile.id);
        setReceipts(await listReadReceipts(found.id));
      }
    })();
  }, [feedItemId, household, profile]);

  if (!household || !profile || !feedItemId || !item) {
    return <EmptyState title="Feed item not found" body="This item may have been removed." />;
  }

  return (
    <div className="stack" data-ui="page-feed-detail">
      {debugBadge("FeedDetailPanel", "src/pages/FeedDetailPanel.tsx")}
      <Card data-ui="feed-detail-card">
        <h2 className="section-title">{item.title}</h2>
        <p>{item.body}</p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {PermissionHelper.canAcknowledge(role, controls)
            ? (["seen", "thanks", "love", "got_it"] as const).map((kind) => (
                <Button
                  key={kind}
                  variant="ghost"
                  onClick={async () => {
                    await acknowledge({
                      household_id: household.id,
                      feed_item_id: item.id,
                      author_user_id: profile.id,
                      kind
                    });
                    setAcks(await listAcknowledgements(item.id));
                  }}
                >
                  {kind.replace("_", " ")}
                </Button>
              ))
            : null}
          <Link className="btn ghost" to={`/app/dm?context_type=feed_item&context_id=${item.id}`}>
            Message about this care update
          </Link>
        </div>
        <p className="caption">Acknowledgements: {acks.length}</p>
      </Card>

      <Card data-ui="feed-detail-attachments-card">
        <h3 style={{ marginTop: 0 }}>Attachments</h3>
        <div className="list" data-ui="feed-detail-attachments-list">
          {attachments.map((attachment) => (
            <article className="list-item" key={attachment.id} data-ui="feed-detail-attachment-item">
              <p style={{ marginTop: 0 }}>{attachment.storage_path.split("/").pop()}</p>
              <a className="btn ghost" href={attachment.signed_url} target="_blank" rel="noreferrer">
                Open attachment
              </a>
            </article>
          ))}
          {attachments.length === 0 ? <p className="caption">No attachments.</p> : null}
        </div>
      </Card>

      <Card data-ui="feed-detail-comments-card">
        <h3 style={{ marginTop: 0 }}>Comments</h3>
        <div className="list" data-ui="feed-detail-comments-list">
          {comments.map((comment) => (
            <article className="list-item" key={comment.id} data-ui="feed-detail-comment-item">
              <p style={{ margin: 0 }}>{comment.body}</p>
              <p className="caption" style={{ margin: 0 }}>
                {comment.author_user_id}
              </p>
            </article>
          ))}
        </div>
        {PermissionHelper.canComment(role, controls) ? (
          <form
            className="stack"
            data-ui="feed-detail-comment-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const body = (form.elements.namedItem("body") as HTMLInputElement).value.trim();
              if (!body) return;
              try {
                await addComment({
                  household_id: household.id,
                  feed_item_id: item.id,
                  author_user_id: profile.id,
                  body
                });
                setComments(await listComments(item.id));
                form.reset();
              } catch (error) {
                pushToast(error instanceof Error ? error.message : "Unable to add comment.");
              }
            }}
          >
            <div className="form-row">
              <label htmlFor="comment-body">Add comment</label>
              <input id="comment-body" name="body" className="input" />
            </div>
            <Button type="submit" variant="secondary">
              Send comment
            </Button>
          </form>
        ) : null}
      </Card>

      {item.is_critical ? <SeenByDrawer receipts={receipts} /> : null}
    </div>
  );
}
