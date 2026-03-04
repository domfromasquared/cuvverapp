import { supabase } from "../lib/supabaseClient";
import { getAccessToken } from "../auth/session";
import type {
  Acknowledgement,
  AcknowledgementKind,
  Attachment,
  Comment,
  FeedItem,
  ReadReceipt
} from "../types/domain";

function assertNoError(error: unknown): void {
  if (error) throw error;
}

async function invokeWithAuth<T, TBody extends object = object>(name: string, body: TBody): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${token}` }
  });
  assertNoError(error);
  return data as T;
}

export async function listFeed(householdId: string): Promise<FeedItem[]> {
  const { data, error } = await supabase
    .from("feed_items")
    .select("*")
    .eq("household_id", householdId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  assertNoError(error);
  return (data ?? []) as FeedItem[];
}

export async function listPinned(householdId: string): Promise<FeedItem[]> {
  const { data, error } = await supabase
    .from("feed_items")
    .select("*")
    .eq("household_id", householdId)
    .eq("is_pinned", true)
    .order("created_at", { ascending: false });
  assertNoError(error);
  return (data ?? []) as FeedItem[];
}

export async function createCareUpdate(payload: {
  household_id: string;
  author_user_id: string;
  title: string;
  body: string;
  template_tag: string | null;
  is_critical: boolean;
}): Promise<FeedItem> {
  const { data, error } = await supabase
    .from("feed_items")
    .insert({ ...payload, type: "care_update", is_pinned: false })
    .select("*")
    .single();
  assertNoError(error);
  return data as FeedItem;
}

export async function createSystemEvent(payload: {
  household_id: string;
  author_user_id: string;
  title: string;
  body: string;
  shift_id?: string | null;
  pto_request_id?: string | null;
  is_critical?: boolean;
}): Promise<void> {
  const { error } = await supabase.from("feed_items").insert({
    ...payload,
    type: "system_event",
    template_tag: "System",
    is_pinned: false,
    is_critical: payload.is_critical ?? false
  });
  assertNoError(error);
}

export async function upsertCoverageBrief(input: {
  household_id: string;
  title: string;
  body: string;
  is_critical: boolean;
}): Promise<void> {
  await invokeWithAuth("upsert-coverage-brief", input);
}

export async function createProtocol(payload: {
  household_id: string;
  author_user_id: string;
  title: string;
  body: string;
  is_critical: boolean;
}): Promise<FeedItem> {
  const { data, error } = await supabase
    .from("feed_items")
    .insert({ ...payload, type: "protocol", is_pinned: true })
    .select("*")
    .single();
  assertNoError(error);
  return data as FeedItem;
}

export async function pinFeedItem(householdId: string, feedItemId: string): Promise<void> {
  await invokeWithAuth("pin-feed-item", { household_id: householdId, feed_item_id: feedItemId });
}

export async function unpinFeedItem(householdId: string, feedItemId: string): Promise<void> {
  await invokeWithAuth("unpin-feed-item", { household_id: householdId, feed_item_id: feedItemId });
}

export async function addComment(payload: {
  household_id: string;
  feed_item_id: string;
  author_user_id: string;
  body: string;
}): Promise<Comment> {
  const { data, error } = await supabase.from("comments").insert(payload).select("*").single();
  assertNoError(error);
  return data as Comment;
}

export async function listComments(feedItemId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("feed_item_id", feedItemId)
    .order("created_at", { ascending: true });

  assertNoError(error);
  return (data ?? []) as Comment[];
}

export async function acknowledge(payload: {
  household_id: string;
  feed_item_id: string;
  author_user_id: string;
  kind: AcknowledgementKind;
}): Promise<Acknowledgement> {
  const { data, error } = await supabase
    .from("acknowledgements")
    .upsert(payload, { onConflict: "feed_item_id,author_user_id,kind" })
    .select("*")
    .single();

  assertNoError(error);
  return data as Acknowledgement;
}

export async function listAcknowledgements(feedItemId: string): Promise<Acknowledgement[]> {
  const { data, error } = await supabase.from("acknowledgements").select("*").eq("feed_item_id", feedItemId);
  assertNoError(error);
  return (data ?? []) as Acknowledgement[];
}

export async function markSeen(householdId: string, feedItemId: string, userId: string): Promise<ReadReceipt> {
  const { data, error } = await supabase
    .from("read_receipts")
    .upsert({ household_id: householdId, feed_item_id: feedItemId, user_id: userId, seen_at: new Date().toISOString() }, { onConflict: "feed_item_id,user_id" })
    .select("*")
    .single();

  assertNoError(error);
  return data as ReadReceipt;
}

export async function listReadReceipts(feedItemId: string): Promise<ReadReceipt[]> {
  const { data, error } = await supabase.from("read_receipts").select("*").eq("feed_item_id", feedItemId);
  assertNoError(error);
  return (data ?? []) as ReadReceipt[];
}

export async function uploadCareAttachment(file: File, householdId: string, feedItemId: string): Promise<Attachment> {
  const filePath = `${householdId}/${feedItemId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: uploadError } = await supabase.storage.from("care-updates").upload(filePath, file, {
    contentType: file.type,
    upsert: false
  });
  assertNoError(uploadError);

  const { data, error } = await supabase
    .from("attachments")
    .insert({
      household_id: householdId,
      feed_item_id: feedItemId,
      type: "photo",
      storage_path: filePath,
      mime_type: file.type
    })
    .select("*")
    .single();
  assertNoError(error);

  return data as Attachment;
}

export async function listAttachments(feedItemId: string): Promise<Array<Attachment & { signed_url: string }>> {
  const { data, error } = await supabase.from("attachments").select("*").eq("feed_item_id", feedItemId);
  assertNoError(error);
  const attachments = (data ?? []) as Attachment[];

  const signed = await Promise.all(
    attachments.map(async (a) => {
      const { data: signedData, error: signedError } = await supabase.storage.from("care-updates").createSignedUrl(a.storage_path, 3600);
      assertNoError(signedError);
      return { ...a, signed_url: signedData?.signedUrl ?? "" };
    })
  );

  return signed;
}
