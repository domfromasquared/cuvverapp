import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { Avatar } from "../components/common/Avatar";
import { useAppStore } from "../state/appStore";
import { PermissionHelper } from "../permissions/permissionHelper";
import { createDmThread, listMessages, listThreads, sendMessage } from "../services/dmApi";
import type { DmMessage, DmThread } from "../types/domain";
import { formatDateTime } from "../utils/dates";
import { useUi } from "../app/providers";
import { debugBadge } from "../dev/uiDebug";
import { useAvatarUrls } from "../hooks/useAvatarUrls";

export function DmPanel(): JSX.Element {
  const [searchParams] = useSearchParams();
  const contextType = searchParams.get("context_type");
  const contextId = searchParams.get("context_id");

  const { household, role, profile, members } = useAppStore();
  const controls = household?.admin_controls ?? null;
  const { pushToast } = useUi();

  const [threads, setThreads] = useState<DmThread[]>([]);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const enabled = useMemo(
    () => PermissionHelper.canOpenDm(role, controls) && Boolean(contextType && contextId),
    [contextId, contextType, controls, role]
  );

  useEffect(() => {
    if (!enabled || !household || !contextType || !contextId) return;
    void (async () => {
      const rows = await listThreads(household.id, contextType, contextId);
      setThreads(rows);
      setSelectedThreadId(rows[0]?.id ?? null);
    })();
  }, [enabled, household, contextId, contextType]);

  useEffect(() => {
    if (!selectedThreadId) return;
    void listMessages(selectedThreadId).then(setMessages);
  }, [selectedThreadId]);

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

  if (!enabled || !household || !contextType || !contextId || !profile) {
    return <EmptyState title="Context chat unavailable" body="Direct messaging is disabled for your role or this household." />;
  }

  return (
    <div className="stack" data-ui="page-dm-panel">
      {debugBadge("DmPanel", "src/pages/DmPanel.tsx")}
      <Card data-ui="dm-context-card">
        <div className="section-row">
          <h2 className="section-title">Context chat</h2>
          {threads.length === 0 ? (
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const result = await createDmThread({
                    household_id: household.id,
                    context_type: contextType as "shift" | "pto" | "feed_item",
                    context_id: contextId,
                    participants: [profile.id]
                  });
                  const rows = await listThreads(household.id, contextType, contextId);
                  setThreads(rows);
                  setSelectedThreadId(result.thread_id);
                  pushToast("Thread started.");
                } catch (error) {
                  pushToast(error instanceof Error ? error.message : "Unable to create thread.");
                }
              }}
            >
              Start thread
            </Button>
          ) : null}
        </div>
        <p className="caption">
          Context: {contextType} · {contextId}
        </p>
      </Card>

      <Card data-ui="dm-threads-card">
        <h3 className="title-reset">Threads</h3>
        {threads.length === 0 ? <p className="caption">No messages yet for this context.</p> : null}
        <div className="chip-row" data-ui="dm-threads-list">
          {threads.map((thread, index) => (
            <button
              key={thread.id}
              type="button"
              className={`chip-toggle ${selectedThreadId === thread.id ? "active" : ""}`.trim()}
              onClick={() => setSelectedThreadId(thread.id)}
            >
              Thread {index + 1}
            </button>
          ))}
        </div>
      </Card>

      <Card data-ui="dm-messages-card">
        <h3 className="title-reset">Conversation</h3>
        <div className="chat-list" data-ui="dm-messages-list">
          {messages.map((message) => {
            const mine = message.author_user_id === profile.id;
            return (
              <article key={message.id} className={`chat-bubble ${mine ? "mine" : ""}`.trim()} data-ui="dm-message-item">
                <p className="text-reset">{message.body}</p>
                <div className="identity-row">
                  <Avatar
                    size="sm"
                    name={memberById.get(message.author_user_id) ?? message.author_user_id}
                    src={avatarById.get(message.author_user_id) ?? null}
                  />
                  <p className="caption">
                    {memberById.get(message.author_user_id) ?? message.author_user_id} · {formatDateTime(message.created_at)}
                  </p>
                </div>
              </article>
            );
          })}
          {messages.length === 0 ? <p className="caption">No messages yet.</p> : null}
        </div>

        {selectedThreadId ? (
          <form
            className="stack"
            data-ui="dm-compose-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const body = (form.elements.namedItem("body") as HTMLInputElement).value.trim();
              if (!body) return;
              await sendMessage(selectedThreadId, profile.id, body);
              setMessages(await listMessages(selectedThreadId));
              form.reset();
            }}
          >
            <div className="form-row">
              <label htmlFor="dm-body">Reply</label>
              <input id="dm-body" className="input" name="body" placeholder="Type your message..." />
            </div>
            <Button type="submit">Send</Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
