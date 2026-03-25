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

/** Extract a display string from a WP ACF address field (can be string or Google Maps object) */
export function getDisplayAddress(address: unknown): string | null {
  if (!address) return null;
  if (typeof address === "string") return address;
  if (typeof address === "object") {
    const a = address as Record<string, unknown>;
    return (a.name ?? a.street_name ?? a.city ?? null) as string | null;
  }
  return null;
}

/** Extract lat/lng from a WP ACF Google Maps address object */
export function getLatLng(address: unknown): { lat: number; lng: number } | null {
  if (!address || typeof address !== "object") return null;
  const a = address as Record<string, unknown>;
  const lat = parseFloat(a.lat as string);
  const lng = parseFloat(a.lng as string);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
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
