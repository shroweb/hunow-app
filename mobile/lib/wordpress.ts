const BASE = process.env.EXPO_PUBLIC_WP_API_URL ?? "https://hunow.co.uk/wp-json/wp/v2";
const HUNOW_BASE = (process.env.EXPO_PUBLIC_WP_API_URL ?? "https://hunow.co.uk/wp-json").replace("/wp/v2", "") + "/hunow/v1";
const JWT_BASE = (process.env.EXPO_PUBLIC_WP_API_URL ?? "https://hunow.co.uk/wp-json").replace("/wp/v2", "") + "/jwt-auth/v1";

interface EmbeddedMedia {
  source_url: string;
  media_details?: { sizes?: { large?: { source_url: string }; medium_large?: { source_url: string }; medium?: { source_url: string } } };
}

export interface WPOffer {
  id: number;
  title: string;
  description: string;
  featured?: boolean;
  paused?: boolean;
  limit_count?: number;
  limit_period?: "week" | "month" | "year" | "ever";
  starts_at?: string | null;
  ends_at?: string | null;
  days_of_week?: number[];
  time_start?: string | null;
  time_end?: string | null;
}

export interface WPTierOffer {
  tier: "bronze" | "silver" | "gold";
  title: string;
  description: string;
  featured?: boolean;
  paused?: boolean;
  limit_count?: number;
  limit_period?: "week" | "month" | "year" | "ever";
  starts_at?: string | null;
  ends_at?: string | null;
  days_of_week?: number[];
  time_start?: string | null;
  time_end?: string | null;
}

export interface FavouriteOfferRef {
  venue_id: number;
  offer_index?: number;
  tier?: "bronze" | "silver" | "gold";
  offer_title?: string;
  content_type?: string;
  date_added?: string;
}

export interface BusinessOffersResponse {
  venue_id: number;
  venue_name: string;
  subscription_tier: string;
  max_offers: number;
  standard_offers: WPOffer[];
  tier_offers: WPTierOffer[];
}

export interface WPVenueFilter {
  id: number;
  slug: string;
  name: string;
}

export interface SiteBrand {
  name: string;
  logo_url: string | null;
  home_url: string;
}

export interface WPEat {
  id: number;
  slug: string;
  title: { rendered: string };
  excerpt?: { rendered: string };
  featured_media?: number;
  _embedded?: { "wp:featuredmedia"?: EmbeddedMedia[] };
  offers?: {
    items: WPOffer[];
    count: number;
    cta?: { text?: string; url?: string } | null;
  };
  tier_offers?: WPTierOffer[];
  filters?: WPVenueFilter[];
  acf?: {
    is_featured?: string;
    opening_hours?: { day: string; hours: string }[];
    address?: unknown;
    phone?: string;
    website?: string;
    offer_title?: string;
    offer_description?: string;
    offer_cta_text?: string;
    offer_cta_url?: string;
    [key: string]: unknown;
  };
}

export interface WPEvent {
  id: number;
  slug: string;
  title: { rendered: string };
  excerpt?: { rendered: string };
  content?: { rendered: string };
  featured_media?: number;
  _embedded?: { "wp:featuredmedia"?: EmbeddedMedia[] };
  acf?: {
    event_date?: string;
    event_end?: string;
    is_featured?: string;
    venue?: string;
    location?: string;
    ticket_url?: string;
    price?: string;
    [key: string]: unknown;
  };
}

export interface WPPost {
  id: number;
  slug: string;
  date: string;
  sticky?: boolean;
  title: { rendered: string };
  excerpt?: { rendered: string };
  content?: { rendered: string };
  featured_media?: number;
  _embedded?: { "wp:featuredmedia"?: EmbeddedMedia[] };
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

/** Extract offers from a WP listing — reads from `offers.items` (venue portal system) */
export function extractOffers(venue: WPEat): WPOffer[] {
  // Primary: venue portal offers array
  if (venue.offers?.items?.length) {
    return venue.offers.items
      .filter((o) => o.title?.trim())
      .map((o) => ({
        id: o.id,
        title: o.title.trim(),
        description: (o.description ?? "").trim(),
        featured: Boolean(o.featured),
        paused: Boolean(o.paused),
        limit_count: o.limit_count ?? 1,
        limit_period: o.limit_period ?? "month",
        starts_at: o.starts_at ?? null,
        ends_at: o.ends_at ?? null,
        days_of_week: Array.isArray(o.days_of_week) ? o.days_of_week : [],
        time_start: o.time_start ?? null,
        time_end: o.time_end ?? null,
      }))
      .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.id - b.id);
  }
  // Fallback: single ACF offer_title field
  const title = venue.acf?.offer_title?.trim();
  if (title) {
    return [{
      id: 1,
      title,
      description: (venue.acf?.offer_description ?? "").trim(),
      featured: false,
      paused: false,
      limit_count: 1,
      limit_period: "month",
      starts_at: null,
      ends_at: null,
      days_of_week: [],
      time_start: null,
      time_end: null,
    }];
  }
  return [];
}

export function formatOfferRule(limitCount = 1, limitPeriod: WPOffer["limit_period"] = "month"): string {
  const count = Math.max(1, limitCount);
  const period = limitPeriod ?? "month";
  if (period === "ever") {
    return count === 1 ? "Once ever" : `${count}x ever`;
  }
  const periodLabel = count === 1 ? period : `${period}s`;
  return count === 1 ? `1x per ${period}` : `${count}x per ${periodLabel}`;
}

export function formatOfferSchedule(
  daysOfWeek: number[] = [],
  timeStart?: string | null,
  timeEnd?: string | null,
): string | null {
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const normalizedDays = Array.from(new Set((daysOfWeek ?? []).filter((day) => day >= 0 && day <= 6))).sort((a, b) => a - b);
  const daysText = normalizedDays.length > 0 && normalizedDays.length < 7
    ? normalizedDays.map((day) => dayLabels[day]).join(", ")
    : "";
  const timeText = timeStart && timeEnd
    ? `${timeStart}–${timeEnd}`
    : timeStart
      ? `From ${timeStart}`
      : timeEnd
        ? `Until ${timeEnd}`
        : "";

  if (!daysText && !timeText) return null;
  if (daysText && timeText) return `${daysText} · ${timeText}`;
  return daysText || timeText;
}

/** Get the best available image URL from an embedded WP post, with ACF fallbacks */
export function getFeaturedImage(item: WPEat | WPEvent | WPActivity): string | null {
  // 1. WP featured media via _embed
  const media = item._embedded?.["wp:featuredmedia"]?.[0];
  if (media) {
    const sizes = media.media_details?.sizes ?? {};
    const url =
      sizes.large?.source_url ??
      sizes.medium_large?.source_url ??
      sizes.medium?.source_url ??
      media.source_url ??
      null;
    if (url) return url;
  }

  // 2. ACF image fields (listing_thumbnail → featured_image → gallery[0])
  const acf = (item as WPEat).acf as Record<string, unknown> | undefined;
  if (acf) {
    const acfImg = (field: unknown): string | null => {
      if (!field) return null;
      if (typeof field === "string" && field.startsWith("http")) return field;
      if (typeof field === "object") {
        const f = field as Record<string, unknown>;
        if (typeof f.url === "string") return f.url;
        if (typeof f.source_url === "string") return f.source_url;
      }
      return null;
    };

    const candidates = ["listing_thumbnail", "featured_image", "image", "photo"];
    for (const key of candidates) {
      const url = acfImg(acf[key]);
      if (url) return url;
    }

    // gallery array
    const gallery = acf.gallery;
    if (Array.isArray(gallery) && gallery.length > 0) {
      const url = acfImg(gallery[0]);
      if (url) return url;
    }
  }

  return null;
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

  getEventById(id: number): Promise<WPEvent> {
    return get<WPEvent>(`${BASE}/event/${id}?_embed=1`);
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

  getPostById(id: number): Promise<WPPost> {
    return get<WPPost>(`${BASE}/posts/${id}?_embed=1`);
  },

  getPosts(params: ListParams = {}): Promise<WPPost[]> {
    const q = buildQuery({
      per_page: params.perPage ?? 6,
      page: params.page ?? 1,
      _embed: 1,
    });
    return get<WPPost[]>(`${BASE}/posts${q}`);
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

  getBusinessOffers(token: string): Promise<BusinessOffersResponse> {
    return get<BusinessOffersResponse>(`${HUNOW_BASE}/business-offers`, token);
  },

  getSiteBrand(): Promise<SiteBrand> {
    return get<SiteBrand>(`${HUNOW_BASE}/site-brand`);
  },

  saveBusinessOffers(
    body: { standard_offers: WPOffer[]; tier_offers: WPTierOffer[] },
    token: string,
  ): Promise<BusinessOffersResponse> {
    return post<BusinessOffersResponse>(`${HUNOW_BASE}/business-offers`, body, token);
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
  getFavourites(token: string): Promise<FavouriteOfferRef[]> {
    return get(`${HUNOW_BASE}/favourites`, token);
  },

  /** Add an offer favourite */
  addFavourite(favourite: FavouriteOfferRef, token: string): Promise<unknown> {
    return post(`${HUNOW_BASE}/favourites`, favourite, token);
  },

  /** Remove an offer favourite */
  removeFavourite(favourite: FavouriteOfferRef, token: string): Promise<unknown> {
    return fetch(`${HUNOW_BASE}/favourites`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(favourite),
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
  dailyCheckin(
    token: string,
    body?: { venue_id?: number; lat?: number; lng?: number }
  ): Promise<{ points_awarded?: number; message: string; already_checked_in?: boolean; streak?: number; venue_id?: number | null }> {
    return post(`${HUNOW_BASE}/daily-checkin`, body ?? {}, token);
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
