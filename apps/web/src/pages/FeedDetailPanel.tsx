import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { Avatar } from "../components/common/Avatar";
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
import { formatDateTime } from "../utils/dates";
import { titleCase } from "../utils/format";
import { useUi } from "../app/providers";
import { debugBadge } from "../dev/uiDebug";
import { useAvatarUrls } from "../hooks/useAvatarUrls";

export function FeedDetailPanel(): JSX.Element {
  const { feedItemId } = useParams();
  const { household, profile, role, members } = useAppStore();
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

      const [nextComments, nextAcks, nextAttachments] = await Promise.all([
        listComments(found.id),
        listAcknowledgements(found.id),
        listAttachments(found.id)
      ]);
      setComments(nextComments);
      setAcks(nextAcks);
      setAttachments(nextAttachments);

      if (found.is_critical) {
        await markSeen(household.id, found.id, profile.id);
        setReceipts(await listReadReceipts(found.id));
      }
    })();
  }, [feedItemId, household, profile]);

  const memberById = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((member) => {
      map.set(member.user_id, member.display_name || member.email || member.user_id);
    });
    if (profile) map.set(profile.id, profile.display_name || profile.email || "You");
    return map;
  }, [members, profile]);
  const identityRows = useMemo(
    () => [
      ...members.map((member) => ({
        user_id: member.user_id,
        avatar_path: member.avatar_path ?? null,
        avatar_url: member.avatar_url ?? null
      })),
      ...(profile
        ? [
            {
              user_id: profile.id,
              avatar_path: profile.avatar_path ?? null,
              avatar_url: profile.avatar_url ?? null
            }
          ]
        : [])
    ],
    [members, profile]
  );
  const avatarById = useAvatarUrls(identityRows);

  if (!household || !profile || !feedItemId || !item) {
    return <EmptyState title="Feed item not found" body="This item may have been removed." />;
  }

  return (
    <div className="stack" data-ui="page-feed-detail">
      {debugBadge("FeedDetailPanel", "src/pages/FeedDetailPanel.tsx")}
      <Card data-ui="feed-detail-card">
        <div className="section-row">
          <p className="kicker">
            {titleCase(item.type)} · {formatDateTime(item.created_at)}
          </p>
          {item.is_critical ? <span className="status-chip status-denied">Critical</span> : null}
        </div>
        <h2 className="section-title">{item.title}</h2>
        {item.body ? <p>{item.body}</p> : null}
        <div className="identity-row">
          <Avatar
            size="sm"
            name={memberById.get(item.author_user_id) ?? item.author_user_id}
            src={avatarById.get(item.author_user_id) ?? null}
          />
          <p className="caption">By {memberById.get(item.author_user_id) ?? item.author_user_id}</p>
        </div>
        <div className="actions actions-spaced">
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
          {PermissionHelper.canOpenDm(role, controls) ? (
            <Link className="btn ghost" to={`/app/dm?context_type=feed_item&context_id=${item.id}`}>
              Open context chat
            </Link>
          ) : null}
        </div>
        <p className="caption">Acknowledgements: {acks.length}</p>
      </Card>

      <Card data-ui="feed-detail-attachments-card">
        <h3 className="title-reset">Attachments</h3>
        <div className="list" data-ui="feed-detail-attachments-list">
          {attachments.map((attachment) => (
            <article className="list-item" key={attachment.id} data-ui="feed-detail-attachment-item">
              <p className="text-reset">{attachment.storage_path.split("/").pop()}</p>
              <a className="btn ghost" href={attachment.signed_url} target="_blank" rel="noreferrer">
                Open
              </a>
            </article>
          ))}
          {attachments.length === 0 ? <p className="caption">No attachments.</p> : null}
        </div>
      </Card>

      <Card data-ui="feed-detail-comments-card">
        <h3 className="title-reset">Conversation</h3>
        <div className="chat-list" data-ui="feed-detail-comments-list">
          {comments.map((comment) => {
            const mine = comment.author_user_id === profile.id;
            return (
              <article key={comment.id} className={`chat-bubble ${mine ? "mine" : ""}`.trim()} data-ui="feed-detail-comment-item">
                <p className="text-reset">{comment.body}</p>
                <div className="identity-row">
                  <Avatar
                    size="sm"
                    name={memberById.get(comment.author_user_id) ?? comment.author_user_id}
                    src={avatarById.get(comment.author_user_id) ?? null}
                  />
                  <p className="caption">
                    {memberById.get(comment.author_user_id) ?? comment.author_user_id} · {formatDateTime(comment.created_at)}
                  </p>
                </div>
              </article>
            );
          })}
          {comments.length === 0 ? <p className="caption">No comments yet.</p> : null}
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
              <label htmlFor="comment-body">Reply</label>
              <input id="comment-body" name="body" className="input" placeholder="Add context for the team..." />
            </div>
            <Button type="submit" variant="secondary">
              Send
            </Button>
          </form>
        ) : null}
      </Card>

      {item.is_critical ? <SeenByDrawer receipts={receipts} getUserLabel={(userId) => memberById.get(userId) ?? userId} /> : null}
    </div>
  );
}
