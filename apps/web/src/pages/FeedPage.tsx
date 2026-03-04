import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { FeedItemCard } from "../components/feed/FeedItemCard";
import { PinnedSection } from "../components/feed/PinnedSection";
import { useAppStore } from "../state/appStore";
import { PermissionHelper } from "../permissions/permissionHelper";
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

export function FeedPage(): JSX.Element {
  const { household, profile, role } = useAppStore();
  const controls = household?.admin_controls ?? null;
  const canPin = PermissionHelper.canAdminHousehold(role);
  const canPostCareUpdate = PermissionHelper.canPostCareUpdate(role, controls);
  const canUploadAttachment = PermissionHelper.canUploadAttachment(role, controls);
  const { pushToast } = useUi();
  const [feed, setFeed] = useState<FeedItem[]>([]);

  useEffect(() => {
    if (!household) return;
    void listFeed(household.id).then(setFeed);
  }, [household]);

  const pinned = useMemo(() => feed.filter((item) => item.is_pinned), [feed]);
  const timeline = useMemo(() => feed.filter((item) => !item.is_pinned), [feed]);

  if (!household || !profile) return <div />;

  return (
    <div className="stack" data-ui="page-feed">
      {debugBadge("FeedPage", "src/pages/FeedPage.tsx")}
      <Card data-ui="feed-header-card">
        <h2 className="section-title">Household Feed</h2>
        <p className="caption">Private operational transparency for this household only.</p>
      </Card>

      {canPostCareUpdate ? (
        <Card data-ui="feed-compose-card">
          <h3 style={{ marginTop: 0 }}>Create Care Update</h3>
          <form
            className="stack"
            data-ui="feed-compose-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const title = (form.elements.namedItem("title") as HTMLInputElement).value.trim();
              const body = (form.elements.namedItem("body") as HTMLTextAreaElement).value.trim();
              const tag = (form.elements.namedItem("template_tag") as HTMLSelectElement).value;
              const isCritical = (form.elements.namedItem("is_critical") as HTMLInputElement).checked;
              const fileInput = form.elements.namedItem("files") as HTMLInputElement;
              const files = [...(fileInput.files ?? [])];

              if (!title || !body) {
                pushToast("Title and message are required.");
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
                  template_tag: tag || null,
                  is_critical: isCritical
                });

                if (canUploadAttachment) {
                  await Promise.all(files.map((file) => uploadCareAttachment(file, household.id, update.id)));
                }

                setFeed(await listFeed(household.id));
                form.reset();
                pushToast("Care update posted.");
              } catch (error) {
                pushToast(error instanceof Error ? error.message : "Unable to post update.");
              }
            }}
          >
            <div className="form-row">
              <label htmlFor="feed-title">Title</label>
              <input id="feed-title" name="title" className="input" required />
            </div>
            <div className="form-row">
              <label htmlFor="feed-body">Message</label>
              <textarea id="feed-body" name="body" className="textarea" required />
            </div>
            <div className="grid-2">
              <div className="form-row">
                <label htmlFor="feed-template">Template tag</label>
                <select id="feed-template" name="template_tag" className="select">
                  <option value="">None</option>
                  <option value="Park">Park</option>
                  <option value="Homework">Homework</option>
                  <option value="Meal">Meal</option>
                  <option value="Medication">Medication</option>
                  <option value="Outing">Outing</option>
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="feed-files">Attachments</label>
                <input id="feed-files" name="files" className="input" type="file" accept="image/*" multiple disabled={!canUploadAttachment} />
              </div>
            </div>
            <label className="caption">
              <input name="is_critical" type="checkbox" /> Mark as critical
            </label>
            <Button type="submit">Post Care Update</Button>
          </form>
        </Card>
      ) : null}

      {canPin ? (
        <Card data-ui="feed-pinned-controls-card">
          <h3 style={{ marginTop: 0 }}>Pinned content controls</h3>
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
              pushToast("Coverage Brief updated.");
            }}
          >
            <div className="form-row">
              <label htmlFor="coverage-title">Coverage Brief title</label>
              <input id="coverage-title" name="coverage_title" className="input" defaultValue="Coverage Brief" />
            </div>
            <div className="form-row">
              <label htmlFor="coverage-body">Coverage Brief body</label>
              <textarea id="coverage-body" name="coverage_body" className="textarea" placeholder="Emergency contacts, pickup protocol, house rules, daily rhythm..." />
            </div>
            <Button type="submit" variant="secondary">Save Coverage Brief</Button>
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
              pushToast("Protocol pinned.");
            }}
          >
            <div className="form-row">
              <label htmlFor="protocol-title">New Pinned Protocol title</label>
              <input id="protocol-title" name="protocol_title" className="input" />
            </div>
            <div className="form-row">
              <label htmlFor="protocol-body">Protocol body</label>
              <textarea id="protocol-body" name="protocol_body" className="textarea" />
            </div>
            <label className="caption">
              <input name="protocol_critical" type="checkbox" defaultChecked /> Critical protocol
            </label>
            <Button type="submit" variant="ghost">Create protocol</Button>
          </form>
        </Card>
      ) : null}

      <PinnedSection
        items={pinned}
        canPin={canPin}
        onOpen={(item) => {
          window.location.hash = `#/app/feed/${item.id}`;
        }}
        onPinToggle={async (item) => {
          try {
            if (item.is_pinned) {
              await unpinFeedItem(household.id, item.id);
            } else {
              await pinFeedItem(household.id, item.id);
            }
            setFeed(await listFeed(household.id));
          } catch (error) {
            pushToast(error instanceof Error ? error.message : "Unable to change pin state.");
          }
        }}
      />

      <section className="stack" data-ui="feed-recent-section">
        <h2 className="section-title">Recent</h2>
        {timeline.length === 0 ? <EmptyState title="No feed activity" body="Care Updates and system events appear here." /> : null}
        <div className="list" data-ui="feed-recent-list">
          {timeline.map((item) => (
            <FeedItemCard
              key={item.id}
              item={item}
              canPin={canPin}
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

      <Card data-ui="feed-dm-card">
        <Link className="btn ghost" to="/app/dm?context_type=feed_item&context_id=new">
          Message about a care update
        </Link>
      </Card>
    </div>
  );
}
