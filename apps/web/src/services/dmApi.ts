import { supabase } from "../lib/supabaseClient";
import { getAccessToken } from "../auth/session";
import type { CreateDmThreadInput } from "../types/api";
import type { DmMessage, DmThread } from "../types/domain";

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

export async function createDmThread(input: CreateDmThreadInput): Promise<{ thread_id: string }> {
  return invokeWithAuth<{ thread_id: string }>("create-dm-thread", input);
}

export async function listThreads(householdId: string, contextType: string, contextId: string): Promise<DmThread[]> {
  const { data, error } = await supabase
    .from("dm_threads")
    .select("*")
    .eq("household_id", householdId)
    .eq("context_type", contextType)
    .eq("context_id", contextId)
    .order("created_at", { ascending: false });

  assertNoError(error);
  return (data ?? []) as DmThread[];
}

export async function listMessages(threadId: string): Promise<DmMessage[]> {
  const { data, error } = await supabase
    .from("dm_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  assertNoError(error);
  return (data ?? []) as DmMessage[];
}

export async function sendMessage(threadId: string, authorUserId: string, body: string): Promise<DmMessage> {
  const { data, error } = await supabase
    .from("dm_messages")
    .insert({ thread_id: threadId, author_user_id: authorUserId, body })
    .select("*")
    .single();

  assertNoError(error);
  return data as DmMessage;
}
