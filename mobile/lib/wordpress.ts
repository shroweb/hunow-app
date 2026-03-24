const BASE = process.env.EXPO_PUBLIC_WP_API_URL ?? "https://hunow.co.uk/wp-json/wp/v2";
const HUNOW_BASE = (process.env.EXPO_PUBLIC_WP_API_URL ?? "https://hunow.co.uk/wp-json").replace("/wp/v2", "") + "/hunow/v1";
const JWT_BASE = (process.env.EXPO_PUBLIC_WP_API_URL ?? "https://hunow.co.uk/wp-json").replace("/wp/v2", "") + "/jwt-auth/v1";

interface EmbeddedMedia {
  source_url: string;
  media_details?: { sizes?: { medium_large?: { source_url: string }; medium?: { source_url: string } } };
}

export interface WPOffer {
  title: string;
  description: string;
  index: number; // 1-20
}

export interface WPEat {
  id: number;
  slug: string;
  title: { rendered: string };
  excerpt?: { rendered: string };
  featured_media?: number;
  _embedded?: { "wp:featuredmedia"?: EmbeddedMedia[] };
  acf?: {
    is_featured?: string;
    opening_hours?: { day: string; hours: string }[];
    address?: string;
    phone?: string;
    website?: string;
    offer_cta_text?: string;
    offer_cta_url?: string;
    [key: string]: unknown; // offer_title_1..20, offer_description_1..20
  };
}

export interface WPEvent {
  id: number;
  slug: string;
  title: { rendered: string };
  excerpt?: { rendered: string };
  featured_media?: number;
  _embedded?: { "wp:featuredmedia"?: EmbeddedMedia[] };
  acf?: {
    event_date?: string;
    event_end?: string;
    is_featured?: string;
  };
}

export interface WPActivity {
  id: number;
  slug: string;
  title: { rendered: string };
  excerpt?: { rendered: string };
  featured_media?: number;
  _embedded?: { "wp:featuredmedia"?: EmbeddedMedia[] };
  acf?: { is_featured?: string };
}

interface ListParams {
  page?: number;
  perPage?: number;
  search?: string;
  orderby?: string;
  order?: "asc" | "desc";
  location?: number;
  cuisine?: number;
  embed?: boolean;
}

/** Extract offers from a WP listing's ACF fields */
export function extractOffers(acf: Record<string, unknown>): WPOffer[] {
  const offers: WPOffer[] = [];
  for (let i = 1; i <= 20; i++) {
    const title = acf[`offer_title_${i}`] as string | undefined;
    if (title?.trim()) {
      offers.push({
        index: i,
        title: title.trim(),
        description: ((acf[`offer_description_${i}`] as string) ?? "").trim(),
      });
    }
  }
  return offers;
}

/** Get the best available image URL from an embedded WP post */
export function getFeaturedImage(item: WPEat | WPEvent | WPActivity): string | null {
  const media = item._embedded?.["wp:featuredmedia"]?.[0];
  if (!media) return null;
  return (
    media.media_details?.sizes?.medium_large?.source_url ??
    media.media_details?.sizes?.medium?.source_url ??
    media.source_url ??
    null
  );
}

async function get<T>(url: string, token?: string): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`WP API error: ${res.status}`);
  return res.json();
}

async function post<T>(url: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message ?? `WP API error: ${res.status}`);
  }
  return res.json();
}

function buildQuery(params: Record<string, string | number | boolean>): string {
  const q = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "" && v !== false)
      .map(([k, v]) => [k, String(v)])
  ).toString();
  return q ? `?${q}` : "";
}

export const wordpress = {
  // ── Standard WP REST ──────────────────────────────────────────────

  getEat(params: ListParams = {}): Promise<WPEat[]> {
    const q = buildQuery({
      per_page: params.perPage ?? 10,
      page: params.page ?? 1,
      ...(params.search ? { search: params.search } : {}),
      orderby: params.orderby ?? "date",
      order: params.order ?? "desc",
      ...(params.location ? { location: params.location } : {}),
      ...(params.cuisine ? { cuisine: params.cuisine } : {}),
      _embed: 1,
    });
    return get<WPEat[]>(`${BASE}/eat${q}`);
  },

  getEatById(id: number): Promise<WPEat> {
    return get<WPEat>(`${BASE}/eat/${id}?_embed=1`);
  },

  getEvents(params: ListParams = {}): Promise<WPEvent[]> {
    const q = buildQuery({
      per_page: params.perPage ?? 10,
      page: params.page ?? 1,
      orderby: params.orderby ?? "date",
      order: params.order ?? "asc",
      _embed: 1,
    });
    return get<WPEvent[]>(`${BASE}/event${q}`);
  },

  getActivities(params: ListParams = {}): Promise<WPActivity[]> {
    const q = buildQuery({
      per_page: params.perPage ?? 10,
      page: params.page ?? 1,
      _embed: 1,
    });
    return get<WPActivity[]>(`${BASE}/activity${q}`);
  },

  getCuisines(): Promise<{ id: number; name: string; slug: string }[]> {
    return get(`${BASE}/cuisine`);
  },

  getLocations(): Promise<{ id: number; name: string; slug: string }[]> {
    return get(`${BASE}/location`);
  },

  // ── HU NOW API ────────────────────────────────────────────────────

  /** Get featured listings by CPT */
  getFeatured(postType: "eat" | "event" | "activity" | "guide"): Promise<WPEat[]> {
    return get<WPEat[]>(`${HUNOW_BASE}/featured-archive/${postType}?_embed=1`);
  },

  /** Get user's points total */
  getPoints(token: string): Promise<{ points: number }> {
    return get(`${HUNOW_BASE}/points`, token);
  },

  /** Get user's badges */
  getBadges(token: string): Promise<{ badges: { id: string; name: string; icon: string }[] }> {
    return get(`${HUNOW_BASE}/badges`, token);
  },

  /** Get leaderboard */
  getLeaderboard(token: string): Promise<{ leaderboard: { display_name: string; points: number }[] }> {
    return get(`${HUNOW_BASE}/leaderboard`, token);
  },

  /** Get user's favourites */
  getFavourites(token: string): Promise<{ post_id: number }[]> {
    return get(`${HUNOW_BASE}/favourites`, token);
  },

  /** Add a favourite */
  addFavourite(postId: number, token: string): Promise<unknown> {
    return post(`${HUNOW_BASE}/favourites`, { post_id: postId }, token);
  },

  /** Remove a favourite */
  removeFavourite(postId: number, token: string): Promise<unknown> {
    return fetch(`${HUNOW_BASE}/favourites/${postId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
  },

  /** Get ratings for a listing */
  getRatings(postId: number): Promise<{ average: number; count: number }> {
    return get(`${HUNOW_BASE}/ratings/${postId}`);
  },

  /** Submit a rating */
  submitRating(postId: number, rating: number, token: string): Promise<unknown> {
    return post(`${HUNOW_BASE}/ratings`, { post_id: postId, rating }, token);
  },

  /** Daily check-in */
  dailyCheckin(token: string): Promise<{ points_awarded: number; message: string }> {
    return post(`${HUNOW_BASE}/daily-checkin`, {}, token);
  },

  /** Register device for push */
  registerPush(deviceToken: string, token: string): Promise<unknown> {
    return post(`${HUNOW_BASE}/push/register`, { device_token: deviceToken }, token);
  },

  /** Get membership stats for a card */
  getMemberStats(cardId: string, token: string): Promise<unknown> {
    return get(`${HUNOW_BASE}/membership/${cardId}/stats`, token);
  },
};

/** Get a WordPress JWT token */
export async function getWPToken(username: string, password: string): Promise<string> {
  const res = await post<{ token: string }>(`${JWT_BASE}/token`, { username, password });
  return res.token;
}
