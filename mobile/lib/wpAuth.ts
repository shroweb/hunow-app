import AsyncStorage from "@react-native-async-storage/async-storage";

const WP_BASE = (process.env.EXPO_PUBLIC_WP_API_URL ?? "https://hunow.co.uk/wp-json").replace(/\/wp\/v2$/, "");
const JWT_URL = `${WP_BASE}/jwt-auth/v1/token`;
const REGISTER_URL = `${WP_BASE}/hunow/v1/register`;
const ME_URL = `${WP_BASE}/hunow/v1/me`;
const APP_CONFIG_URL = `${WP_BASE}/hunow/v1/app-config`;
const BUSINESS_DASHBOARD_URL = `${WP_BASE}/hunow/v1/business-dashboard`;
const FORGOT_PASSWORD_URL = `${WP_BASE}/hunow/v1/forgot-password`;
const UPDATE_EMAIL_URL = `${WP_BASE}/hunow/v1/update-email`;
const GOOGLE_LOGIN_URL = `${WP_BASE}/hunow/v1/google-login`;

const LOOKUP_URL = `${WP_BASE}/hunow/v1/lookup-card`;
const REDEEM_URL = `${WP_BASE}/hunow/v1/redeem`;
const OFFER_STATUSES_URL = `${WP_BASE}/hunow/v1/offer-statuses`;
const VOUCHERS_URL = `${WP_BASE}/hunow/v1/vouchers`;
const VOUCHER_CODE_URL = `${WP_BASE}/hunow/v1/vouchers/redeem-code`;
const LOOKUP_VOUCHER_URL = `${WP_BASE}/hunow/v1/lookup-voucher`;
const REDEEM_VOUCHER_URL = `${WP_BASE}/hunow/v1/redeem-voucher`;
const BUSINESS_VOUCHERS_URL = `${WP_BASE}/hunow/v1/business-vouchers`;

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
  tier?: string;
  venue_id: number;
  venue_name?: string | null;
  assigned_venue_ids?: number[];
  subscription_tier?: string;
  setup_status?: "ready" | "needs_venue";
  setup_message?: string | null;
  referral_code?: string | null;
  referral_count?: number;
  today_checked_in?: boolean;
  last_daily_checkin?: string | null;
  login_streak?: number;
  challenges?: WPChallenge[];
  redemptions: WPRedemption[];
}

export interface WPChallenge {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  reward: string;
}

export interface AppConfig {
  api_version: string;
  min_supported_app_version: string;
  recommended_app_version: string;
  feature_flags: {
    business_setup_status?: boolean;
    normalized_offer_filters?: boolean;
    business_offers_editing?: boolean;
    tier_offers?: boolean;
    favourites?: boolean;
    [key: string]: boolean | undefined;
  };
}

export interface WPRedemption {
  offer_title: string;
  venue_id: number;
  venue_name: string;
  redeemed_by: number;
  timestamp: number;
  date: string;
  tier?: string;
  offer_index?: number;
  limit_count?: number;
  limit_period?: "week" | "month" | "year" | "ever";
}

export interface OfferStatus {
  available: boolean;
  used_count: number;
  remaining_count: number;
  status_label: string;
  message: string;
  next_available_at?: string | null;
  next_available_text?: string | null;
  limit_count: number;
  limit_period: "week" | "month" | "year" | "ever";
  rule_label: string;
  offer_index?: number;
  tier?: "bronze" | "silver" | "gold";
  unlocked?: boolean;
  required_points?: number;
  points_needed?: number;
}

export interface OfferStatusesResponse {
  member_points: number;
  member_tier: string;
  standard: OfferStatus[];
  tier: OfferStatus[];
}

export interface BusinessDashboardResponse {
  venue_ids: number[];
  venue_name: string | null;
  stats: {
    total_scans: number;
    today_scans: number;
    weekly_scans: number;
    monthly_scans: number;
    most_active_day: string;
    unique_members: number;
    repeat_members: number;
    standard_redemptions: number;
    tier_redemptions: number;
    top_offers: { offer_title: string; count: number }[];
    tier_breakdown: { bronze: number; silver: number; gold: number };
    day_counts: Record<string, number>;
    range: "7d" | "30d" | "90d" | "all";
    recent_scans: { offer_title: string; timestamp: string; member_email: string }[];
  };
}

export interface WPVoucher {
  id: number;
  token: string;
  code: string;
  title: string;
  description: string;
  venue_id: number;
  venue_name?: string | null;
  expires_at?: string | null;
  required_tier?: "bronze" | "silver" | "gold" | null;
  claimed_user_id?: number;
  claimed_at?: string | null;
  redeemed_at?: string | null;
  source?: "admin" | "venue";
  status: "active" | "redeemed" | "expired";
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
  referralCode?: string,
): Promise<{ token: string; user: WPUser }> {
  const res = await fetch(REGISTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, role: "customer", ...(referralCode?.trim() ? { referral_code: referralCode.trim().toUpperCase() } : {}) }),
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

export async function wpGoogleLogin(idToken: string): Promise<{ token: string; user: WPUser }> {
  const res = await fetch(GOOGLE_LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Google login failed.");
  }

  const data = await res.json() as WPUser & { token: string };
  await saveToken(data.token);
  const user = await fetchMe(data.token);
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

export async function fetchAppConfig(): Promise<AppConfig | null> {
  const res = await fetch(APP_CONFIG_URL, {
    headers: { Accept: "application/json" },
  }).catch(() => null);

  if (!res || !res.ok) {
    return null;
  }

  return res.json() as Promise<AppConfig>;
}

/** POST /hunow/v1/lookup-card — validate a scanned QR token, return member name + points */
export async function lookupCard(
  cardToken: string,
  jwt: string,
  wpPostId?: number,
): Promise<{ valid: boolean; name: string; user_id: number; points: number; tier: string; offer_statuses?: OfferStatusesResponse | null }> {
  const res = await fetch(LOOKUP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ card_token: cardToken, ...(wpPostId ? { wp_post_id: wpPostId } : {}) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Invalid card");
  }
  return res.json();
}

export async function fetchOfferStatuses(
  wpPostId: number,
  jwt: string,
  cardToken?: string,
): Promise<OfferStatusesResponse> {
  const res = await fetch(OFFER_STATUSES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ wp_post_id: wpPostId, ...(cardToken ? { card_token: cardToken } : {}) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Could not load offer statuses");
  }
  return res.json();
}

export async function fetchBusinessDashboard(jwt: string, range: "7d" | "30d" | "90d" | "all" = "30d"): Promise<BusinessDashboardResponse> {
  const res = await fetch(`${BUSINESS_DASHBOARD_URL}?range=${range}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Could not load business dashboard");
  }
  return res.json();
}

export async function fetchVouchers(jwt: string): Promise<WPVoucher[]> {
  const res = await fetch(VOUCHERS_URL, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Could not load vouchers");
  }
  return res.json();
}

export async function redeemVoucherCode(code: string, jwt: string): Promise<WPVoucher> {
  const res = await fetch(VOUCHER_CODE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Could not redeem voucher code.");
  }
  return res.json();
}

export async function lookupVoucher(voucherToken: string, jwt: string): Promise<WPVoucher> {
  const res = await fetch(LOOKUP_VOUCHER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ voucher_token: voucherToken }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Invalid voucher");
  }
  return res.json();
}

export async function redeemVoucher(voucherToken: string, jwt: string): Promise<{ success: boolean; voucher: WPVoucher }> {
  const res = await fetch(REDEEM_VOUCHER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ voucher_token: voucherToken }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Could not redeem voucher.");
  }
  return res.json();
}

export async function fetchBusinessVouchers(jwt: string): Promise<WPVoucher[]> {
  const res = await fetch(BUSINESS_VOUCHERS_URL, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Could not load venue vouchers.");
  }
  return res.json();
}

export async function createBusinessVoucher(
  payload: { title: string; code: string; description?: string; expires_at?: string },
  jwt: string,
): Promise<WPVoucher> {
  const res = await fetch(BUSINESS_VOUCHERS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Could not create voucher.");
  }
  return res.json();
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(FORGOT_PASSWORD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Could not send reset email.");
  }
  return res.json();
}

export async function updateEmail(email: string, currentPassword: string, jwt: string): Promise<{ success: boolean; email: string; message: string }> {
  const res = await fetch(UPDATE_EMAIL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ email, current_password: currentPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Could not update email.");
  }
  return res.json();
}

/** POST /hunow/v1/redeem — redeem an offer for a scanned member */
export async function wpRedeem(
  cardToken: string,
  offerTitle: string,
  wpPostId: number,
  jwt: string,
  offerIndex?: number,
  tier?: string,
): Promise<{ success: boolean; member_name: string; offer: string; venue: string; points_awarded: number }> {
  const res = await fetch(REDEEM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({
      card_token: cardToken,
      offer_title: offerTitle,
      wp_post_id: wpPostId,
      ...(offerIndex ? { offer_index: offerIndex } : {}),
      ...(tier ? { tier } : {}),
    }),
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
