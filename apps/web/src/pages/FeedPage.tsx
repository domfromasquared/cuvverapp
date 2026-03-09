import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { FeedItemCard } from "../components/feed/FeedItemCard";
import { PinnedSection } from "../components/feed/PinnedSection";
import { useAppStore } from "../state/appStore";
import { PermissionHelper } from "../permissions/permissionHelper";
import { useAvatarUrls } from "../hooks/useAvatarUrls";
import {
  createCareUpdate,
  createProtocol,
  listFeed,
  pinFeedItem,
  unpinFeedItem,
  uploadCareAttachment,
  upsertCoverageBrief
} from "../services/feedApi";
import type { FeedItem } from "../types/domain";
import { useUi } from "../app/providers";
import { debugBadge } from "../dev/uiDebug";

const TEMPLATE_TAGS = ["Park", "Homework", "Meal", "Medication", "Outing"] as const;

export function FeedPage(): JSX.Element {
  const { household, profile, role, members } = useAppStore();
  const controls = household?.admin_controls ?? null;
  const canPin = PermissionHelper.canAdminHousehold(role);
  const canPostCareUpdate = PermissionHelper.canPostCareUpdate(role, controls);
  const canUploadAttachment = PermissionHelper.canUploadAttachment(role, controls);
  const canOpenDm = PermissionHelper.canOpenDm(role, controls);
  const { pushToast } = useUi();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [attachmentCount, setAttachmentCount] = useState(0);

  useEffect(() => {
    if (!household) return;
    void listFeed(household.id).then(setFeed);
  }, [household]);

  const authorById = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((member) => {
      map.set(member.user_id, member.display_name || member.email || member.user_id);
    });
    if (profile) map.set(profile.id, profile.display_name || profile.email || "You");
    return map;
  }, [members, profile]);

  const pinned = useMemo(() => feed.filter((item) => item.is_pinned), [feed]);
  const timeline = useMemo(() => feed.filter((item) => !item.is_pinned), [feed]);
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

  if (!household || !profile) return <div />;

  return (
    <div className="stack" data-ui="page-feed">
      {debugBadge("FeedPage", "src/pages/FeedPage.tsx")}
      <Card data-ui="feed-header-card">
        <h2 className="section-title">Household updates</h2>
        <p className="caption">
          {canPostCareUpdate
            ? "Post concise updates and keep the care timeline current."
            : "Follow household updates and key critical notices."}
        </p>
      </Card>

      {canPostCareUpdate ? (
        <Card data-ui="feed-compose-card">
          <h3 className="title-reset">Post update</h3>
          <form
            className="stack"
            data-ui="feed-compose-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const title = (form.elements.namedItem("title") as HTMLInputElement).value.trim();
              const body = (form.elements.namedItem("body") as HTMLTextAreaElement).value.trim();
              const isCritical = (form.elements.namedItem("is_critical") as HTMLInputElement).checked;
              const fileInput = form.elements.namedItem("files") as HTMLInputElement;
              const files = [...(fileInput.files ?? [])];

              if (!title || !body) {
                pushToast("Title and update text are required.");
                return;
              }
              if (files.length > 3) {
                pushToast("Upload up to 3 photos.");
                return;
              }

              try {
                const update = await createCareUpdate({
                  household_id: household.id,
                  author_user_id: profile.id,
                  title,
                  body,
                  template_tag: selectedTemplate || null,
                  is_critical: isCritical
                });

                if (canUploadAttachment) {
                  await Promise.all(files.map((file) => uploadCareAttachment(file, household.id, update.id)));
                }

                setFeed(await listFeed(household.id));
                setSelectedTemplate("");
                setAttachmentCount(0);
                form.reset();
                pushToast("Update posted.");
              } catch (error) {
                pushToast(error instanceof Error ? error.message : "Unable to post update.");
              }
            }}
          >
            <div className="form-row">
              <label htmlFor="feed-title">Title</label>
              <input id="feed-title" name="title" className="input" required placeholder="Medication completed" />
            </div>
            <div className="form-row">
              <label htmlFor="feed-body">Update</label>
              <textarea id="feed-body" name="body" className="textarea" required placeholder="What happened and anything the next caregiver should know." />
            </div>
            <div className="form-row">
              <label>Template</label>
              <div className="chip-row">
                {TEMPLATE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`chip-toggle ${selectedTemplate === tag ? "active" : ""}`.trim()}
                    onClick={() => setSelectedTemplate((prev) => (prev === tag ? "" : tag))}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid-2">
              <label className="check-row">
                <input name="is_critical" type="checkbox" /> Mark as critical
              </label>
              <div className="form-row">
                <label htmlFor="feed-files">Photos</label>
                <input
                  id="feed-files"
                  name="files"
                  className="input"
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={!canUploadAttachment}
                  onChange={(event) => setAttachmentCount(event.currentTarget.files?.length ?? 0)}
                />
                <p className="caption">{canUploadAttachment ? `${attachmentCount} selected` : "Attachment uploads disabled by admin controls."}</p>
              </div>
            </div>
            <Button type="submit">Post update</Button>
          </form>
        </Card>
      ) : null}

      {canPin ? (
        <Card data-ui="feed-admin-tools-card">
          <details>
            <summary className="details-summary">Admin tools</summary>
            <div className="stack">
              <form
                className="stack"
                data-ui="feed-coverage-brief-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const title = (form.elements.namedItem("coverage_title") as HTMLInputElement).value.trim();
                  const body = (form.elements.namedItem("coverage_body") as HTMLTextAreaElement).value.trim();
                  if (!title || !body) return;
                  await upsertCoverageBrief({ household_id: household.id, title, body, is_critical: true });
                  setFeed(await listFeed(household.id));
                  pushToast("Coverage brief updated.");
                }}
              >
                <h3 className="title-reset">Coverage brief</h3>
                <div className="form-row">
                  <label htmlFor="coverage-title">Title</label>
                  <input id="coverage-title" name="coverage_title" className="input" defaultValue="Coverage Brief" />
                </div>
                <div className="form-row">
                  <label htmlFor="coverage-body">Body</label>
                  <textarea id="coverage-body" name="coverage_body" className="textarea" placeholder="Emergency contacts, pickup protocol, home rules, daily rhythm..." />
                </div>
                <Button type="submit" variant="secondary">
                  Save brief
                </Button>
              </form>

              <hr className="hr" />

              <form
                className="stack"
                data-ui="feed-protocol-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const title = (form.elements.namedItem("protocol_title") as HTMLInputElement).value.trim();
                  const body = (form.elements.namedItem("protocol_body") as HTMLTextAreaElement).value.trim();
                  const isCritical = (form.elements.namedItem("protocol_critical") as HTMLInputElement).checked;
                  if (!title || !body) return;
                  await createProtocol({
                    household_id: household.id,
                    author_user_id: profile.id,
                    title,
                    body,
                    is_critical: isCritical
                  });
                  setFeed(await listFeed(household.id));
                  form.reset();
                  pushToast("Pinned protocol created.");
                }}
              >
                <h3 className="title-reset">Pinned protocol</h3>
                <div className="form-row">
                  <label htmlFor="protocol-title">Title</label>
                  <input id="protocol-title" name="protocol_title" className="input" />
                </div>
                <div className="form-row">
                  <label htmlFor="protocol-body">Body</label>
                  <textarea id="protocol-body" name="protocol_body" className="textarea" />
                </div>
                <label className="check-row">
                  <input name="protocol_critical" type="checkbox" defaultChecked /> Mark protocol as critical
                </label>
                <Button type="submit" variant="ghost">
                  Pin protocol
                </Button>
              </form>
            </div>
          </details>
        </Card>
      ) : null}

      <PinnedSection
        items={pinned}
        canPin={canPin}
        getAuthorLabel={(userId) => authorById.get(userId) ?? userId}
        getAuthorAvatarUrl={(userId) => avatarById.get(userId) ?? null}
        onOpen={(item) => {
          window.location.hash = `#/app/feed/${item.id}`;
        }}
        onPinToggle={async (item) => {
          try {
            if (item.is_pinned) await unpinFeedItem(household.id, item.id);
            else await pinFeedItem(household.id, item.id);
            setFeed(await listFeed(household.id));
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Unable to change pin state.");
          }
        }}
      />

      <section className="stack" data-ui="feed-recent-section">
        <div className="section-row">
          <h2 className="section-title">Timeline</h2>
          <span className="badge">{timeline.length} items</span>
        </div>
        {timeline.length === 0 ? <EmptyState title="No feed activity" body="New updates and system events will appear here." /> : null}
        <div className="timeline-list" data-ui="feed-recent-list">
          {timeline.map((item) => (
            <FeedItemCard
              key={item.id}
              item={item}
              canPin={canPin}
              authorLabel={authorById.get(item.author_user_id) ?? item.author_user_id}
              authorAvatarUrl={avatarById.get(item.author_user_id) ?? null}
              onOpen={(selected) => {
                window.location.hash = `#/app/feed/${selected.id}`;
              }}
              onPinToggle={async (selected) => {
                try {
                  if (selected.is_pinned) await unpinFeedItem(household.id, selected.id);
                  else await pinFeedItem(household.id, selected.id);
                  setFeed(await listFeed(household.id));
                } catch (error) {
                  pushToast(error instanceof Error ? error.message : "Unable to toggle pin.");
                }
              }}
            />
          ))}
        </div>
      </section>

      {canOpenDm ? (
        <Card data-ui="feed-dm-card">
          <Link className="btn ghost" to="/app/dm?context_type=feed_item&context_id=new">
            Message about a care update
          </Link>
        </Card>
      ) : null}
    </div>
  );
}
