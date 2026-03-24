const BASE = process.env.EXPO_PUBLIC_WP_API_URL ?? "https://hunow.co.uk/wp-json/wp/v2";

interface EmbeddedMedia {
  source_url: string;
  media_details?: { sizes?: { medium_large?: { source_url: string }; medium?: { source_url: string } } };
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
    offer_title_1?: string;
    cuisine_link?: string;
    location_link?: string;
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
  fields?: string[];
  embed?: boolean;
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

async function get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)])
  ).toString();
  const url = `${BASE}${path}${query ? `?${query}` : ""}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`WP API error: ${res.status}`);
  return res.json();
}

export const wordpress = {
  getEat(params: ListParams = {}): Promise<WPEat[]> {
    return get<WPEat[]>("/eat", {
      per_page: params.perPage ?? 10,
      page: params.page ?? 1,
      ...(params.search ? { search: params.search } : {}),
      orderby: params.orderby ?? "date",
      order: params.order ?? "desc",
      ...(params.location ? { location: params.location } : {}),
      ...(params.cuisine ? { cuisine: params.cuisine } : {}),
      ...(params.fields ? { _fields: params.fields.join(",") } : {}),
      ...(params.embed !== false ? { _embed: 1 } : {}),
    });
  },

  getEatById(id: number): Promise<WPEat> {
    return get<WPEat>(`/eat/${id}`, { _embed: 1 });
  },

  getEvents(params: ListParams = {}): Promise<WPEvent[]> {
    return get<WPEvent[]>("/event", {
      per_page: params.perPage ?? 10,
      page: params.page ?? 1,
      orderby: params.orderby ?? "date",
      order: params.order ?? "asc",
      ...(params.embed !== false ? { _embed: 1 } : {}),
    });
  },

  getActivities(params: ListParams = {}): Promise<WPActivity[]> {
    return get<WPActivity[]>("/activity", {
      per_page: params.perPage ?? 10,
      page: params.page ?? 1,
      orderby: params.orderby ?? "date",
      order: params.order ?? "desc",
      ...(params.embed !== false ? { _embed: 1 } : {}),
    });
  },

  getCuisines(): Promise<{ id: number; name: string; slug: string }[]> {
    return get("/cuisine");
  },

  getLocations(): Promise<{ id: number; name: string; slug: string }[]> {
    return get("/location");
  },
};
