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

export function getSearchableText(value: unknown): string {
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "number" || typeof value === "boolean") return String(value).toLowerCase();
  if (Array.isArray(value)) {
    return value.map((item) => getSearchableText(item)).filter(Boolean).join(" ").trim();
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((item) => getSearchableText(item))
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  return "";
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getFilterLabels(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => toTitleCase(part));
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return Array.from(new Set(value.flatMap((item) => getFilterLabels(item)).filter(Boolean)));
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const named = [record.name, record.label, record.title].find((item) => typeof item === "string" && item.trim());
    if (typeof named === "string") return [toTitleCase(named.trim())];
    return Array.from(
      new Set(
        Object.values(record)
          .flatMap((item) => getFilterLabels(item))
          .filter(Boolean)
      )
    );
  }
  return [];
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

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }

  // YYYY-MM-DD HH:mm:ss
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return new Date(value.replace(" ", "T"));
  }

  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split("/");
    return new Date(`${year}-${month}-${day}T00:00:00`);
  }

  // DD/MM/YYYY HH:mm[:ss]
  if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    const [datePart, timePart] = value.split(/\s+/);
    const [day, month, year] = datePart.split("/");
    return new Date(`${year}-${month}-${day}T${timePart}`);
  }

  // DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [day, month, year] = value.split("-");
    return new Date(`${year}-${month}-${day}T00:00:00`);
  }

  // DD-MM-YYYY HH:mm[:ss]
  if (/^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    const [datePart, timePart] = value.split(/\s+/);
    const [day, month, year] = datePart.split("-");
    return new Date(`${year}-${month}-${day}T${timePart}`);
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}
