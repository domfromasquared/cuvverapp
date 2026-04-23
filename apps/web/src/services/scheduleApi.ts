import { supabase } from "../lib/supabaseClient";
import { getAccessToken } from "../auth/session";
import type { Shift, ShiftAssignment, TimeEntry } from "../types/domain";

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

/**
 * Default schedule window. Beta households accumulate hundreds of shifts over
 * time; unbounded listShifts will eventually stall the page. Callers can pass
 * an explicit window to override.
 */
export const DEFAULT_SCHEDULE_WINDOW_DAYS = 30;

export interface ScheduleWindow {
  /** Days before `now` to include. Default: DEFAULT_SCHEDULE_WINDOW_DAYS. */
  pastDays?: number;
  /** Days after `now` to include. Default: DEFAULT_SCHEDULE_WINDOW_DAYS. */
  futureDays?: number;
}

function windowBounds(window?: ScheduleWindow): { from: string; to: string } {
  const pastDays = window?.pastDays ?? DEFAULT_SCHEDULE_WINDOW_DAYS;
  const futureDays = window?.futureDays ?? DEFAULT_SCHEDULE_WINDOW_DAYS;
  const now = Date.now();
  const from = new Date(now - pastDays * 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(now + futureDays * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

export async function listShifts(householdId: string, window?: ScheduleWindow): Promise<Shift[]> {
  const { from, to } = windowBounds(window);
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("household_id", householdId)
    .gte("start_datetime", from)
    .lte("start_datetime", to)
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

// =====================
// Shift assignments
// =====================

/** All assignments for a single shift (admin detail view). */
export async function listAssignmentsForShift(shiftId: string): Promise<ShiftAssignment[]> {
  const { data, error } = await supabase
    .from("shift_assignments")
    .select("*")
    .eq("shift_id", shiftId)
    .order("assigned_at", { ascending: false });

  assertNoError(error);
  return (data ?? []) as ShiftAssignment[];
}

/**
 * All assignments in a household within the schedule window. Used by
 * SchedulePage to render a status badge per shift without N queries.
 */
export async function listAssignmentsForHousehold(
  householdId: string,
  window?: ScheduleWindow
): Promise<ShiftAssignment[]> {
  const { from, to } = windowBounds(window);
  const { data, error } = await supabase
    .from("shift_assignments")
    .select("*")
    .eq("household_id", householdId)
    .gte("snapshot_start", from)
    .lte("snapshot_start", to)
    .order("snapshot_start", { ascending: true });

  assertNoError(error);
  return (data ?? []) as ShiftAssignment[];
}

/** Caregiver-facing: shifts I still need to respond to. */
export async function listMyPendingAssignments(
  householdId: string,
  userId: string
): Promise<ShiftAssignment[]> {
  const { data, error } = await supabase
    .from("shift_assignments")
    .select("*")
    .eq("household_id", householdId)
    .eq("caregiver_user_id", userId)
    .in("status", ["pending", "changed"])
    .order("snapshot_start", { ascending: true });

  assertNoError(error);
  return (data ?? []) as ShiftAssignment[];
}

export async function assignShift(
  householdId: string,
  shiftId: string,
  caregiverUserId: string
): Promise<{ ok: boolean; assignment_id: string }> {
  return invokeWithAuth("assign-shift", {
    household_id: householdId,
    shift_id: shiftId,
    caregiver_user_id: caregiverUserId
  });
}

export async function respondToAssignment(
  assignmentId: string,
  response: "accepted" | "declined",
  note?: string
): Promise<{ ok: boolean; status: "accepted" | "declined" }> {
  return invokeWithAuth("respond-to-assignment", {
    assignment_id: assignmentId,
    response,
    note
  });
}
