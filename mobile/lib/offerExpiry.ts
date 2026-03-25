/** Parse an offer expiry date string into a Date, trying several formats */
function parseExpiry(raw: string): Date | null {
  if (!raw?.trim()) return null;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(raw + "T00:00:00");
  // DD/MM/YYYY
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}T00:00:00`);
  // ISO or any other format
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/** Returns integer days remaining, null if expired or unparseable */
export function getDaysRemaining(raw: string): number | null {
  const expiry = parseExpiry(raw);
  if (!expiry) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  return diff >= 0 ? diff : null;
}

/** Returns a human-readable badge label, or null if >30 days / expired */
export function getExpiryBadgeLabel(raw: string): string | null {
  const days = getDaysRemaining(raw);
  if (days === null) return null;
  if (days > 30) return null;
  if (days === 0) return "Ends today";
  if (days === 1) return "Ends tomorrow";
  return `Ends in ${days} days`;
}
