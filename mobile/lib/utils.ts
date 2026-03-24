/** Decode HTML entities from WordPress API responses */
export function decodeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Strip HTML tags */
export function stripHtml(str: string): string {
  return decodeHtml(str.replace(/<[^>]+>/g, ""));
}

/** Parse WordPress event date - handles both "YYYYMMDD" and "Month D, YYYY" formats */
export function parseEventDate(raw: string): Date | null {
  if (!raw) return null;
  // YYYYMMDD format
  if (/^\d{8}$/.test(raw)) {
    return new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`);
  }
  // Human readable e.g. "August 2, 2025"
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}
