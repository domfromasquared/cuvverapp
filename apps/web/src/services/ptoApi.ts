import { supabase } from "../lib/supabaseClient";
import type { PtoRequest } from "../types/domain";

function assertNoError(error: unknown): void {
  if (error) throw error;
}

export async function listPto(householdId: string): Promise<PtoRequest[]> {
  const { data, error } = await supabase
    .from("pto_requests")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });
  assertNoError(error);
  return (data ?? []) as PtoRequest[];
}

export async function requestPto(payload: Omit<PtoRequest, "id" | "decided_by" | "decided_at" | "created_at" | "status">): Promise<PtoRequest> {
  const { data, error } = await supabase.from("pto_requests").insert({ ...payload, status: "pending" }).select("*").single();
  assertNoError(error);
  return data as PtoRequest;
}

export async function decidePto(ptoId: string, status: "approved" | "denied", deciderId: string): Promise<PtoRequest> {
  const { data, error } = await supabase
    .from("pto_requests")
    .update({ status, decided_by: deciderId, decided_at: new Date().toISOString() })
    .eq("id", ptoId)
    .select("*")
    .single();

  assertNoError(error);
  return data as PtoRequest;
}
