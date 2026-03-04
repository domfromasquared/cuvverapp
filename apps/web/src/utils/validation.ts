export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isRequired(value: string): boolean {
  return value.trim().length > 0;
}

export function isValidRange(startIso: string, endIso: string): boolean {
  return new Date(startIso).getTime() < new Date(endIso).getTime();
}
