import { supabase } from "../lib/supabaseClient";

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(displayName: string, email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName }
    }
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function signInWithGoogle(): Promise<void> {
  const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // Keep OAuth callback away from hash routes; app root redirects to bootstrap.
      redirectTo
    }
  });
  if (error) throw error;
}
