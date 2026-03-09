import { supabase } from "../lib/supabaseClient";
import type { UserProfile } from "../types/domain";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const signedAvatarUrlCache = new Map<string, string>();

function assertNoError(error: unknown): void {
  if (error) throw error;
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned : "avatar";
}

export function validateAvatarFile(file: File): void {
  if (!ALLOWED_AVATAR_TYPES.has(file.type.toLowerCase())) {
    throw new Error("Use JPG, PNG, or WEBP for profile photos.");
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("Profile photo must be 5MB or smaller.");
  }
}

export async function uploadMyAvatar(file: File, householdId: string, userId: string): Promise<UserProfile> {
  validateAvatarFile(file);
  const safeName = sanitizeFileName(file.name);
  const path = `${householdId}/${userId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(path, file, {
    upsert: false,
    contentType: file.type
  });
  assertNoError(uploadError);

  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", userId)
    .select("*")
    .single();
  assertNoError(error);

  signedAvatarUrlCache.delete(path);
  return data as UserProfile;
}

export async function removeMyAvatar(householdId: string, userId: string, avatarPath?: string | null): Promise<UserProfile> {
  if (avatarPath && avatarPath.startsWith(`${householdId}/${userId}/`)) {
    const { error: removeError } = await supabase.storage.from("profile-avatars").remove([avatarPath]);
    if (removeError) {
      // Keep profile update path moving even if object already missing.
      console.warn("Avatar object remove warning:", removeError.message);
    }
    signedAvatarUrlCache.delete(avatarPath);
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", userId)
    .select("*")
    .single();
  assertNoError(error);
  return data as UserProfile;
}

export async function resolveAvatarUrl(profile: Pick<UserProfile, "avatar_path" | "avatar_url">): Promise<string | null> {
  if (profile.avatar_path) {
    if (signedAvatarUrlCache.has(profile.avatar_path)) {
      return signedAvatarUrlCache.get(profile.avatar_path) ?? null;
    }
    const { data, error } = await supabase.storage.from("profile-avatars").createSignedUrl(profile.avatar_path, 3600);
    assertNoError(error);
    const url = data?.signedUrl ?? null;
    if (url) signedAvatarUrlCache.set(profile.avatar_path, url);
    return url;
  }
  return profile.avatar_url ?? null;
}
