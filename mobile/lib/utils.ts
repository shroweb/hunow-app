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

export function getTodayOpeningHours(hours: unknown): string | null {
  if (!Array.isArray(hours) || hours.length === 0) return null;
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long" }).toLowerCase();
  const match = hours.find((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const row = entry as Record<string, unknown>;
    return typeof row.day === "string" && row.day.toLowerCase() === today;
  }) as { day?: string; hours?: string } | undefined;
  return match?.hours?.trim() || null;
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

/** Parse WordPress event date - handles compact, ISO, and human-readable formats */
export function parseEventDate(raw: string): Date | null {
  if (!raw) return null;
  const value = raw.trim();

  // YYYYMMDD
  if (/^\d{8}$/.test(value)) {
    return new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00`);
  }

  // YYYYMMDDHHMMSS
  if (/^\d{14}$/.test(value)) {
    return new Date(
      `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}`
    );
  }

  // YYYY-MM-DD HH:mm:ss
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return new Date(value.replace(" ", "T"));
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}
