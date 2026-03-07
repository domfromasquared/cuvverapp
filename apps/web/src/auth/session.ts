import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  const accessToken = session?.access_token?.trim();
  if (accessToken) return accessToken;

  // Fallback for cases where storage has a refresh token but access token is stale/missing in memory.
  const { data, error } = await supabase.auth.refreshSession();
  if (error) throw error;
  return data.session?.access_token?.trim() ?? null;
}

export function onAuthStateChanged(cb: (session: Session | null) => void): () => void {
  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => subscription.unsubscribe();
}
