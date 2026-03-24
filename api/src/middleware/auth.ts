import { Request, Response, NextFunction } from "express";

const WP_BASE = (process.env.WP_API_URL ?? "https://hunow.co.uk/wp-json").replace(/\/wp\/v2$/, "");
const WP_ME_URL = `${WP_BASE}/hunow/v1/me`;

export interface AuthRequest extends Request {
  userId?: string;     // WP user ID as string
  wpUserId?: number;   // WP user ID as number
  wpVenueId?: number;  // WP venue_id (hunow_venue_id meta) — set for business accounts
}

/**
 * Validates a WP JWT by calling GET /hunow/v1/me.
 * Sets req.wpUserId, req.userId, and req.wpVenueId on success.
 */
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const wpRes = await fetch(WP_ME_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!wpRes.ok) {
      res.status(401).json({ message: "Invalid or expired token" });
      return;
    }

    const user = await wpRes.json() as { user_id: number; venue_id?: number };
    req.wpUserId = user.user_id;
    req.userId = String(user.user_id);
    req.wpVenueId = user.venue_id ?? 0;
    next();
  } catch {
    res.status(401).json({ message: "Authentication failed" });
  }
}
