import AsyncStorage from "@react-native-async-storage/async-storage";

const WP_BASE = (process.env.EXPO_PUBLIC_WP_API_URL ?? "https://hunow.co.uk/wp-json").replace(/\/wp\/v2$/, "");
const JWT_URL = `${WP_BASE}/jwt-auth/v1/token`;
const REGISTER_URL = `${WP_BASE}/hunow/v1/register`;
const ME_URL = `${WP_BASE}/hunow/v1/me`;

const LOOKUP_URL = `${WP_BASE}/hunow/v1/lookup-card`;
const REDEEM_URL = `${WP_BASE}/hunow/v1/redeem`;

const TOKEN_KEY = "wp_jwt_token";
const USER_KEY = "wp_user";

export interface WPUser {
  user_id: number;
  display_name: string;
  email: string;
  role: "customer" | "business";
  card_token: string;
  card_created: string;
  points: number;
  venue_id: number;
  redemptions: WPRedemption[];
}

export interface WPRedemption {
  offer_title: string;
  venue_id: number;
  venue_name: string;
  redeemed_by: number;
  timestamp: number;
  date: string;
}

/** Persist token to AsyncStorage */
export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

/** Load persisted token */
export async function loadToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

/** Clear persisted auth */
export async function clearAuth(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

/** POST /jwt-auth/v1/token — returns JWT token string */
export async function wpLogin(email: string, password: string): Promise<{ token: string; user: WPUser }> {
  const res = await fetch(JWT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Login failed. Check your email and password.");
  }

  // JWT Auth plugin returns { token, user_email, user_nicename, user_display_name }
  const jwt = await res.json() as { token: string };
  await saveToken(jwt.token);

  // Fetch full profile
  const user = await fetchMe(jwt.token);
  return { token: jwt.token, user };
}

/** POST /hunow/v1/register — creates WP user + returns token and user */
export async function wpRegister(
  name: string,
  email: string,
  password: string,
): Promise<{ token: string; user: WPUser }> {
  const res = await fetch(REGISTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, role: "customer" }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string; data?: { message?: string } };
    throw new Error(err.message ?? err.data?.message ?? "Registration failed. Please try again.");
  }

  const data = await res.json() as WPUser & { token: string };
  await saveToken(data.token);

  const user: WPUser = {
    user_id: data.user_id,
    display_name: data.display_name,
    email: data.email,
    role: data.role,
    card_token: data.card_token,
    card_created: data.card_created,
    points: data.points,
    venue_id: data.venue_id ?? 0,
    redemptions: [],
  };

  return { token: data.token, user };
}

/** GET /hunow/v1/me — fetches fresh user data */
export async function fetchMe(token: string): Promise<WPUser> {
  const res = await fetch(ME_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("Session expired. Please log in again.");
  }

  return res.json() as Promise<WPUser>;
}

/** POST /hunow/v1/lookup-card — validate a scanned QR token, return member name + points */
export async function lookupCard(
  cardToken: string,
  jwt: string,
): Promise<{ valid: boolean; name: string; user_id: number; points: number; tier: string }> {
  const res = await fetch(LOOKUP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ card_token: cardToken }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Invalid card");
  }
  return res.json();
}

/** POST /hunow/v1/redeem — redeem an offer for a scanned member */
export async function wpRedeem(
  cardToken: string,
  offerTitle: string,
  wpPostId: number,
  jwt: string,
  tier?: string,
): Promise<{ success: boolean; member_name: string; offer: string; venue: string; points_awarded: number }> {
  const res = await fetch(REDEEM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ card_token: cardToken, offer_title: offerTitle, wp_post_id: wpPostId, ...(tier ? { tier } : {}) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Redemption failed");
  }
  return res.json();
}

/** Try to restore session from storage, returns null if not valid */
export async function restoreSession(): Promise<{ token: string; user: WPUser } | null> {
  const token = await loadToken();
  if (!token) return null;

  try {
    const user = await fetchMe(token);
    return { token, user };
  } catch {
    await clearAuth();
    return null;
  }
}
