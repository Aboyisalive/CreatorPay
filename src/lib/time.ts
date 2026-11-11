const TZ = "Africa/Lagos";

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "28 Oct 2026" in WAT. */
export function formatDay(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }).format(date);
}

/** "28 Oct 2026, 19:48 WAT". */
export function formatStamp(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  const text = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(date);
  return `${text} WAT`;
}

export function formatDistanceToNowStrict(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(seconds, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(seconds / 86400), "day");
  return formatDay(date);
}

/** Days until a date (negative when past). */
export function daysUntil(value: string | Date | null | undefined): number | null {
  const date = toDate(value);
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}
