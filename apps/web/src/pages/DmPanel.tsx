import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { useAppStore } from "../state/appStore";
import { PermissionHelper } from "../permissions/permissionHelper";
import { createDmThread, listMessages, listThreads, sendMessage } from "../services/dmApi";
import type { DmMessage, DmThread } from "../types/domain";
import { useUi } from "../app/providers";
import { debugBadge } from "../dev/uiDebug";

export function DmPanel(): JSX.Element {
  const [searchParams] = useSearchParams();
  const contextType = searchParams.get("context_type");
  const contextId = searchParams.get("context_id");

  const { household, role, profile } = useAppStore();
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

  if (!enabled || !household || !contextType || !contextId || !profile) {
    return <EmptyState title="DM scaffold disabled" body="Contextual messages are off for this household." />;
  }

  return (
    <div className="stack" data-ui="page-dm-panel">
      {debugBadge("DmPanel", "src/pages/DmPanel.tsx")}
      <Card data-ui="dm-context-card">
        <h2 className="section-title">Context message thread</h2>
        <p className="caption">
          Context: {contextType} · {contextId}
        </p>
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
              pushToast("Context thread created.");
            } catch (error) {
              pushToast(error instanceof Error ? error.message : "Unable to create DM thread.");
            }
          }}
        >
          Start thread
        </Button>
      </Card>

      <Card data-ui="dm-threads-card">
        <h3 style={{ marginTop: 0 }}>Threads</h3>
        {threads.length === 0 ? <p className="caption">No threads for this context yet.</p> : null}
        <div className="list" data-ui="dm-threads-list">
          {threads.map((thread) => (
            <button
              key={thread.id}
              className="btn ghost"
              onClick={() => {
                setSelectedThreadId(thread.id);
              }}
            >
              Thread {thread.id.slice(0, 8)}
            </button>
          ))}
        </div>
      </Card>

      <Card data-ui="dm-messages-card">
        <h3 style={{ marginTop: 0 }}>Messages</h3>
        <div className="list" data-ui="dm-messages-list">
          {messages.map((message) => (
            <article key={message.id} className="list-item" data-ui="dm-message-item">
              <p style={{ margin: 0 }}>{message.body}</p>
              <p className="caption" style={{ margin: 0 }}>{message.author_user_id}</p>
            </article>
          ))}
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
              <label htmlFor="dm-body">Message</label>
              <input id="dm-body" className="input" name="body" />
            </div>
            <Button type="submit">Send</Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
