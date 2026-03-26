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
  if (typeof address === "string") return address.trim() || null;
  if (typeof address === "object") {
    const a = address as Record<string, unknown>;
    const preferred = [
      a.formatted_address,
      a.address,
      a.name,
      a.street_name,
      a.city,
    ].find((value) => typeof value === "string" && value.trim().length > 0);
    return typeof preferred === "string" ? preferred.trim() : null;
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

function parseHourToken(hourRaw: string, minuteRaw: string | undefined, meridiemRaw: string | undefined): number | null {
  let hour = Number(hourRaw);
  const minute = Number(minuteRaw ?? "0");
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  const meridiem = (meridiemRaw ?? "").toLowerCase();
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

export function getTodayOpeningStatus(hours: unknown): { isOpen: boolean; label: string } | null {
  const todayHours = getTodayOpeningHours(hours);
  if (!todayHours) return null;
  if (/closed/i.test(todayHours)) {
    return { isOpen: false, label: "Closed today" };
  }

  const match = todayHours.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return null;

  const [, startHour, startMinute, startMeridiem, endHour, endMinute, endMeridiem] = match;
  const inferredMeridiem = startMeridiem || endMeridiem || undefined;
  const start = parseHourToken(startHour, startMinute, startMeridiem || inferredMeridiem);
  const end = parseHourToken(endHour, endMinute, endMeridiem || inferredMeridiem);
  if (start === null || end === null) return null;

  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const adjustedEnd = end <= start ? end + 24 * 60 : end;
  const adjustedCurrent = current < start && adjustedEnd > 24 * 60 ? current + 24 * 60 : current;
  const isOpen = adjustedCurrent >= start && adjustedCurrent <= adjustedEnd;

  return {
    isOpen,
    label: isOpen ? "Open now" : "Closed now",
  };
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
