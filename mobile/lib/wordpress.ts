const BASE = process.env.EXPO_PUBLIC_WP_API_URL ?? "https://hunow.co.uk/wp-json/wp/v2";

export interface WPEat {
  id: number;
  slug: string;
  title: { rendered: string };
  excerpt?: { rendered: string };
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
      search: params.search ?? "",
      orderby: params.orderby ?? "date",
      order: params.order ?? "desc",
      ...(params.location ? { location: params.location } : {}),
      ...(params.cuisine ? { cuisine: params.cuisine } : {}),
      ...(params.fields ? { _fields: params.fields.join(",") } : {}),
    });
  },

  getEatById(id: number): Promise<WPEat> {
    return get<WPEat>(`/eat/${id}`);
  },

  getEvents(params: ListParams = {}): Promise<WPEvent[]> {
    return get<WPEvent[]>("/event", {
      per_page: params.perPage ?? 10,
      page: params.page ?? 1,
      orderby: params.orderby ?? "date",
      order: params.order ?? "asc",
    });
  },

  getActivities(params: ListParams = {}): Promise<WPActivity[]> {
    return get<WPActivity[]>("/activity", {
      per_page: params.perPage ?? 10,
      page: params.page ?? 1,
      orderby: params.orderby ?? "date",
      order: params.order ?? "desc",
    });
  },

  getCuisines(): Promise<{ id: number; name: string; slug: string }[]> {
    return get("/cuisine");
  },

  getLocations(): Promise<{ id: number; name: string; slug: string }[]> {
    return get("/location");
  },
};
