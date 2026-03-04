import { supabase } from "../lib/supabaseClient";
import type { Shift, TimeEntry } from "../types/domain";

function assertNoError(error: unknown): void {
  if (error) throw error;
}

export async function listShifts(householdId: string): Promise<Shift[]> {
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("household_id", householdId)
    .order("start_datetime", { ascending: true });

  assertNoError(error);
  return (data ?? []) as Shift[];
}

export async function getShift(shiftId: string): Promise<Shift> {
  const { data, error } = await supabase.from("shifts").select("*").eq("id", shiftId).single();
  assertNoError(error);
  return data as Shift;
}

export async function createShift(payload: Omit<Shift, "id" | "created_at" | "updated_at">): Promise<Shift> {
  const { data, error } = await supabase.from("shifts").insert(payload).select("*").single();
  assertNoError(error);
  return data as Shift;
}

export async function updateShift(shiftId: string, payload: Partial<Shift>): Promise<Shift> {
  const { data, error } = await supabase.from("shifts").update(payload).eq("id", shiftId).select("*").single();
  assertNoError(error);
  return data as Shift;
}

export async function listTimeEntries(householdId: string): Promise<TimeEntry[]> {
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });

  assertNoError(error);
  return (data ?? []) as TimeEntry[];
}

export async function clockIn(householdId: string, shiftId: string, userId: string): Promise<TimeEntry> {
  const { data, error } = await supabase
    .from("time_entries")
    .insert({ household_id: householdId, shift_id: shiftId, user_id: userId, clock_in: new Date().toISOString(), status: "open" })
    .select("*")
    .single();

  assertNoError(error);
  return data as TimeEntry;
}

export async function clockOut(entryId: string): Promise<TimeEntry> {
  const { data, error } = await supabase
    .from("time_entries")
    .update({ clock_out: new Date().toISOString(), status: "submitted" })
    .eq("id", entryId)
    .select("*")
    .single();

  assertNoError(error);
  return data as TimeEntry;
}

export async function approveTimeEntry(entryId: string): Promise<TimeEntry> {
  const { data, error } = await supabase.from("time_entries").update({ status: "approved" }).eq("id", entryId).select("*").single();
  assertNoError(error);
  return data as TimeEntry;
}
