export function formatDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}

export function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(date));
}

export function toInputDate(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

export function toInputDateTime(value: string): string {
  const d = new Date(value);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
