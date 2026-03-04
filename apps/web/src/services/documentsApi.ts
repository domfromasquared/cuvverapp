import { supabase } from "../lib/supabaseClient";
import type { DocumentRecord } from "../types/domain";

function assertNoError(error: unknown): void {
  if (error) throw error;
}

export async function listDocuments(householdId: string): Promise<DocumentRecord[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });

  assertNoError(error);
  return (data ?? []) as DocumentRecord[];
}

export async function uploadDocument(file: File, householdId: string, userId: string, title: string, category: string | null): Promise<DocumentRecord> {
  const storagePath = `${householdId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: uploadError } = await supabase.storage.from("household-documents").upload(storagePath, file, {
    contentType: file.type,
    upsert: false
  });
  assertNoError(uploadError);

  const { data, error } = await supabase
    .from("documents")
    .insert({
      household_id: householdId,
      dependent_id: null,
      title,
      category,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      storage_path: storagePath,
      uploaded_by_user_id: userId
    })
    .select("*")
    .single();

  assertNoError(error);
  return data as DocumentRecord;
}

export async function removeDocument(documentId: string): Promise<void> {
  const { data: doc, error: fetchError } = await supabase.from("documents").select("id,storage_path").eq("id", documentId).maybeSingle();
  assertNoError(fetchError);
  if (!doc) {
    throw new Error("Document not found");
  }

  const { error: storageError } = await supabase.storage.from("household-documents").remove([doc.storage_path]);
  assertNoError(storageError);

  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  assertNoError(error);
}

export async function getDocumentSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from("household-documents").createSignedUrl(storagePath, 3600);
  assertNoError(error);
  return data?.signedUrl ?? "";
}
