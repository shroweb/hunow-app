import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import {
  wordpress,
  formatOfferRule,
  formatOfferSchedule,
  type BusinessOffersResponse,
  type WPOffer,
  type WPTierOffer,
} from "@/lib/wordpress";
import { BusinessSetupGate } from "@/components/BusinessSetupGate";

const NAV = "#0F0032";
const YELLOW = "#FBC900";
const PERIODS: Array<WPOffer["limit_period"]> = ["week", "month", "year", "ever"];
const WEEK_DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];
const TIER_META: Record<"bronze" | "silver" | "gold", { label: string; colour: string; unlock: string }> = {
  bronze: { label: "Bronze", colour: "#CD7F32", unlock: "200 pts" },
  silver: { label: "Silver", colour: "#C0C0C0", unlock: "600 pts" },
  gold: { label: "Gold", colour: "#FBC900", unlock: "1,400 pts" },
};

function sanitiseDateInput(value: string) {
  return value.trim();
}

function sanitiseTimeInput(value: string) {
  return value.trim().slice(0, 5);
}

function FieldLabel({ children, light = false }: { children: string; light?: boolean }) {
  return (
    <Text
      style={{
        color: light ? "rgba(255,255,255,0.7)" : "rgba(15,0,50,0.55)",
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 0.7,
        textTransform: "uppercase",
        marginBottom: 6,
      }}
    >
      {children}
    </Text>
  );
}

function Input({ dark = false, style, ...props }: React.ComponentProps<typeof TextInput> & { dark?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={dark ? "rgba(255,255,255,0.35)" : "rgba(15,0,50,0.28)"}
      style={{
        backgroundColor: dark ? "rgba(255,255,255,0.12)" : "rgba(15,0,50,0.04)",
        borderWidth: 1,
        borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(15,0,50,0.08)",
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: dark ? "white" : NAV,
        fontSize: 14,
        ...(style as object),
      }}
      {...props}
    />
  );
}

function PeriodSelector({
  value,
  onChange,
  accent = YELLOW,
  dark = false,
}: {
  value?: WPOffer["limit_period"];
  onChange: (next: WPOffer["limit_period"]) => void;
  accent?: string;
  dark?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
      {PERIODS.map((period) => {
        const active = (value ?? "month") === period;
        return (
          <TouchableOpacity
            key={period}
            onPress={() => onChange(period)}
            style={{
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: active ? accent : dark ? "rgba(255,255,255,0.12)" : "rgba(15,0,50,0.05)",
              borderWidth: 1,
              borderColor: active ? accent : dark ? "rgba(255,255,255,0.12)" : "rgba(15,0,50,0.08)",
            }}
          >
            <Text style={{ color: active ? NAV : dark ? "rgba(255,255,255,0.88)" : "rgba(15,0,50,0.6)", fontSize: 12, fontWeight: "800", textTransform: "capitalize" }}>{period}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function DaySelector({
  value = [],
  onChange,
  accent = YELLOW,
  dark = false,
}: {
  value?: number[];
  onChange: (next: number[]) => void;
  accent?: string;
  dark?: boolean;
}) {
  const current = Array.isArray(value) ? value : [];
  return (
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
      {WEEK_DAYS.map((day) => {
        const active = current.includes(day.value);
        return (
          <TouchableOpacity
            key={day.value}
            onPress={() => onChange(active ? current.filter((item) => item !== day.value) : [...current, day.value].sort((a, b) => a - b))}
            style={{
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: active ? accent : dark ? "rgba(255,255,255,0.12)" : "rgba(15,0,50,0.05)",
              borderWidth: 1,
              borderColor: active ? accent : dark ? "rgba(255,255,255,0.12)" : "rgba(15,0,50,0.08)",
            }}
          >
            <Text style={{ color: active ? NAV : dark ? "rgba(255,255,255,0.88)" : "rgba(15,0,50,0.6)", fontSize: 12, fontWeight: "800" }}>{day.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function BusinessOffersScreen() {
  const { user, token, appConfig } = useAuth();
  const [data, setData] = useState<BusinessOffersResponse | null>(null);
  const [standardOffers, setStandardOffers] = useState<WPOffer[]>([]);
  const [tierOffers, setTierOffers] = useState<WPTierOffer[]>([]);
  const [editingStandard, setEditingStandard] = useState<Record<number, boolean>>({});
  const [editingTier, setEditingTier] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const businessReady = user?.role === "business" && user?.setup_status === "ready" && Boolean(user?.venue_id);
  const editingEnabled = appConfig?.feature_flags?.business_offers_editing !== false;

  useEffect(() => {
    if (!businessReady) {
      setLoading(false);
      setData(null);
    }
  }, [businessReady]);

  useEffect(() => {
    async function load() {
      if (!token || !businessReady) {
        setLoading(false);
        return;
      }

      try {
        const response = await wordpress.getBusinessOffers(token);
        setData(response);
        setStandardOffers(response.standard_offers);
        setTierOffers(response.tier_offers);
        setEditingStandard({});
        setEditingTier({});
      } catch (err: any) {
        setData(null);
        Alert.alert("Couldn’t load offers", err?.message ?? "Please try again.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token, businessReady]);

  function updateStandard(id: number, patch: Partial<WPOffer>) {
    setStandardOffers((current) => current.map((offer) => (offer.id === id ? { ...offer, ...patch } : offer)));
  }

  function updateTier(tier: WPTierOffer["tier"], patch: Partial<WPTierOffer>) {
    setTierOffers((current) => current.map((offer) => (offer.tier === tier ? { ...offer, ...patch } : offer)));
  }

  function duplicateStandard(id: number) {
    setStandardOffers((current) => {
      const source = current.find((offer) => offer.id === id);
      const target = current.find((offer) => offer.id !== id && !offer.title.trim() && !offer.description.trim());
      if (!source || !target) {
        Alert.alert("No empty slot", "You need an empty standard offer slot before duplicating.");
        return current;
      }
      return current.map((offer) =>
        offer.id === target.id
          ? {
              ...offer,
              title: source.title,
              description: source.description,
              paused: source.paused,
              limit_count: source.limit_count,
              limit_period: source.limit_period,
              starts_at: source.starts_at,
              ends_at: source.ends_at,
              days_of_week: source.days_of_week ?? [],
              time_start: source.time_start ?? null,
              time_end: source.time_end ?? null,
            }
          : offer
      );
    });
  }

  async function handleSave() {
    if (!token || !data) return;
    setSaving(true);

    try {
      const payload = {
        standard_offers: standardOffers.map((offer) => ({
          ...offer,
          title: offer.title.trim(),
          description: offer.description.trim(),
          starts_at: sanitiseDateInput(offer.starts_at ?? ""),
          ends_at: sanitiseDateInput(offer.ends_at ?? ""),
          days_of_week: (offer.days_of_week ?? []).slice().sort((a, b) => a - b),
          time_start: sanitiseTimeInput(offer.time_start ?? ""),
          time_end: sanitiseTimeInput(offer.time_end ?? ""),
        })),
        tier_offers: tierOffers.map((offer) => ({
          ...offer,
          title: offer.title.trim(),
          description: offer.description.trim(),
          starts_at: sanitiseDateInput(offer.starts_at ?? ""),
          ends_at: sanitiseDateInput(offer.ends_at ?? ""),
          days_of_week: (offer.days_of_week ?? []).slice().sort((a, b) => a - b),
          time_start: sanitiseTimeInput(offer.time_start ?? ""),
          time_end: sanitiseTimeInput(offer.time_end ?? ""),
        })),
      };

      const response = await wordpress.saveBusinessOffers(payload, token);
      setData(response);
      setStandardOffers(response.standard_offers);
      setTierOffers(response.tier_offers);
      setEditingStandard({});
      setEditingTier({});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Offers Updated", "Your venue offers have been saved.");
    } catch (err: any) {
      Alert.alert("Couldn’t save offers", err?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const hasEditingOpen = Object.values(editingStandard).some(Boolean) || Object.values(editingTier).some(Boolean);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: NAV, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={YELLOW} />
      </View>
    );
  }

  if (!user || !token) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: NAV, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
        <Text style={{ color: "white", fontSize: 18, fontWeight: "800", marginBottom: 8 }}>Sign in required</Text>
        <Text style={{ color: "rgba(255,255,255,0.5)", textAlign: "center" }}>Please log back in to manage your venue offers.</Text>
      </SafeAreaView>
    );
  }

  if (!businessReady) {
    return <BusinessSetupGate user={user} title="Business offers unavailable" />;
  }

  if (!editingEnabled) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: NAV, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: YELLOW + "22", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Ionicons name="construct-outline" size={24} color={YELLOW} />
        </View>
        <Text style={{ color: "white", fontSize: 18, fontWeight: "800", marginBottom: 8 }}>Offer editing unavailable</Text>
        <Text style={{ color: "rgba(255,255,255,0.5)", textAlign: "center" }}>This app build doesn’t support in-app offer editing with the current server configuration.</Text>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: NAV, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: YELLOW + "22", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Ionicons name="alert-circle-outline" size={24} color={YELLOW} />
        </View>
        <Text style={{ color: "white", fontSize: 18, fontWeight: "800", marginBottom: 8 }}>Venue setup needed</Text>
        <Text style={{ color: "rgba(255,255,255,0.5)", textAlign: "center" }}>This business account needs a linked venue before offers can be edited.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: 18 }}>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>
            Manage Rewards
          </Text>
          <Text style={{ color: "white", fontSize: 26, fontWeight: "900", letterSpacing: -0.4, marginBottom: 8 }}>
            {data.venue_name}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 20 }}>
            Update standard offers, tier rewards, redemption limits, and offer windows directly in the app.
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginBottom: 18 }}>
          <View style={{ flex: 1, backgroundColor: YELLOW, borderRadius: 20, padding: 16 }}>
            <Text style={{ color: "rgba(15,0,50,0.6)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Plan</Text>
            <Text style={{ color: NAV, fontSize: 18, fontWeight: "900", textTransform: "capitalize" }}>{data.subscription_tier}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Standard Slots</Text>
            <Text style={{ color: "white", fontSize: 18, fontWeight: "900" }}>{data.max_offers === 999 ? "Unlimited" : data.max_offers}</Text>
          </View>
        </View>

        <Text style={{ color: "white", fontSize: 18, fontWeight: "800", marginBottom: 10 }}>Standard Offers</Text>
        {standardOffers.map((offer) => (
          <View key={offer.id} style={{ backgroundColor: "white", borderRadius: 20, padding: 16, marginBottom: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <View>
                <Text style={{ color: NAV, fontSize: 18, fontWeight: "900" }}>Offer {offer.id}</Text>
                <Text style={{ color: "rgba(15,0,50,0.48)", fontSize: 12, marginTop: 4 }}>{offer.title.trim() || "No offer set yet"}</Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {offer.featured ? (
                    <View style={{ backgroundColor: YELLOW + "22", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ color: "#8A6A00", fontSize: 10, fontWeight: "900" }}>Featured by HU NOW</Text>
                    </View>
                  ) : null}
                  {offer.paused ? (
                    <View style={{ backgroundColor: "rgba(239,68,68,0.12)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ color: "#B91C1C", fontSize: 10, fontWeight: "900" }}>Paused</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => updateStandard(offer.id, { paused: !offer.paused })}
                  style={{ backgroundColor: offer.paused ? "rgba(239,68,68,0.12)" : "rgba(15,0,50,0.06)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}
                >
                  <Text style={{ color: offer.paused ? "#B91C1C" : "rgba(15,0,50,0.72)", fontSize: 11, fontWeight: "800" }}>{offer.paused ? "Paused" : "Pause"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => duplicateStandard(offer.id)}
                  style={{ backgroundColor: "rgba(15,0,50,0.06)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}
                >
                  <Text style={{ color: "rgba(15,0,50,0.72)", fontSize: 11, fontWeight: "800" }}>Duplicate</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setEditingStandard((current) => ({ ...current, [offer.id]: !current[offer.id] }))}
                  style={{ backgroundColor: "rgba(251,201,0,0.18)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}
                >
                  <Text style={{ color: NAV, fontSize: 11, fontWeight: "800" }}>{editingStandard[offer.id] ? "Done" : "Edit"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {editingStandard[offer.id] ? (
              <>
                <View style={{ marginBottom: 12 }}>
                  <FieldLabel>Offer Title</FieldLabel>
                  <Input value={offer.title} onChangeText={(value) => updateStandard(offer.id, { title: value })} placeholder="e.g. 20% off all mains" />
                </View>

                <View style={{ marginBottom: 12 }}>
                  <FieldLabel>Description</FieldLabel>
                  <Input
                    value={offer.description}
                    onChangeText={(value) => updateStandard(offer.id, { description: value })}
                    placeholder="Offer details shown in the app and scan flow"
                    multiline
                    style={{
                      backgroundColor: "rgba(15,0,50,0.04)",
                      borderWidth: 1,
                      borderColor: "rgba(15,0,50,0.08)",
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      color: NAV,
                      fontSize: 14,
                      minHeight: 96,
                      textAlignVertical: "top",
                    }}
                  />
                </View>

                <View style={{ marginBottom: 12 }}>
                  <FieldLabel>Offer Image URL</FieldLabel>
                  <Input value={offer.image_url ?? ""} onChangeText={(value) => updateStandard(offer.id, { image_url: value.trim() })} placeholder="https://..." autoCapitalize="none" />
                </View>

                <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <FieldLabel>Limit Count</FieldLabel>
                    <Input
                      value={String(offer.limit_count ?? 1)}
                      onChangeText={(value) => updateStandard(offer.id, { limit_count: Math.max(1, Number(value || 1)) })}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={{ flex: 1.35 }}>
                    <FieldLabel>Redemption Period</FieldLabel>
                    <PeriodSelector value={offer.limit_period} onChange={(value) => updateStandard(offer.id, { limit_period: value })} />
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 12, marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <FieldLabel>Starts At</FieldLabel>
                    <Input value={offer.starts_at ?? ""} onChangeText={(value) => updateStandard(offer.id, { starts_at: value })} placeholder="2026-03-25T18:00" autoCapitalize="none" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldLabel>Ends At</FieldLabel>
                    <Input value={offer.ends_at ?? ""} onChangeText={(value) => updateStandard(offer.id, { ends_at: value })} placeholder="2026-03-31T23:59" autoCapitalize="none" />
                  </View>
                </View>

                <View style={{ marginBottom: 12 }}>
                  <FieldLabel>Days Of Week</FieldLabel>
                  <DaySelector value={offer.days_of_week ?? []} onChange={(value) => updateStandard(offer.id, { days_of_week: value })} />
                </View>

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <FieldLabel>Start Time</FieldLabel>
                    <Input value={offer.time_start ?? ""} onChangeText={(value) => updateStandard(offer.id, { time_start: sanitiseTimeInput(value) })} placeholder="12:00" autoCapitalize="none" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FieldLabel>End Time</FieldLabel>
                    <Input value={offer.time_end ?? ""} onChangeText={(value) => updateStandard(offer.id, { time_end: sanitiseTimeInput(value) })} placeholder="15:00" autoCapitalize="none" />
                  </View>
                </View>
              </>
            ) : (
              <View style={{ gap: 8 }}>
                {offer.featured ? <Text style={{ color: "#8A6A00", fontSize: 12, fontWeight: "800" }}>Featured by HU NOW</Text> : null}
                <Text style={{ color: "rgba(15,0,50,0.68)", fontSize: 14, lineHeight: 20 }}>
                  {offer.description.trim() || "No description set yet."}
                </Text>
                {offer.image_url ? (
                  <Text style={{ color: "rgba(15,0,50,0.45)", fontSize: 12 }} numberOfLines={1}>
                    Custom offer image set
                  </Text>
                ) : null}
                <Text style={{ color: "rgba(15,0,50,0.45)", fontSize: 12, fontWeight: "700" }}>
                  {formatOfferRule(offer.limit_count, offer.limit_period)}
                </Text>
                {offer.paused ? <Text style={{ color: "#B91C1C", fontSize: 12, fontWeight: "800" }}>Currently paused</Text> : null}
                {(offer.starts_at || offer.ends_at) ? (
                  <Text style={{ color: "rgba(15,0,50,0.45)", fontSize: 12 }}>
                    {offer.starts_at ? `Starts ${offer.starts_at}` : "Always on"}
                    {offer.ends_at ? ` • Ends ${offer.ends_at}` : ""}
                  </Text>
                ) : null}
                {formatOfferSchedule(offer.days_of_week ?? [], offer.time_start, offer.time_end) ? (
                  <Text style={{ color: "rgba(15,0,50,0.45)", fontSize: 12 }}>
                    {formatOfferSchedule(offer.days_of_week ?? [], offer.time_start, offer.time_end)}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        ))}

        <Text style={{ color: "white", fontSize: 18, fontWeight: "800", marginTop: 8, marginBottom: 10 }}>Tier Offers</Text>
        {tierOffers.map((offer) => {
          const meta = TIER_META[offer.tier];
          return (
            <View key={offer.tier} style={{ backgroundColor: "#20113F", borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: meta.colour + "66" }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <View>
                  <Text style={{ color: "white", fontSize: 18, fontWeight: "900" }}>{meta.label}</Text>
                  <Text style={{ color: meta.colour, fontSize: 12, fontWeight: "700", marginTop: 2 }}>Unlocks at {meta.unlock}</Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {offer.featured ? (
                      <View style={{ backgroundColor: meta.colour + "22", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Text style={{ color: meta.colour, fontSize: 10, fontWeight: "900" }}>Featured by HU NOW</Text>
                      </View>
                    ) : null}
                    {offer.paused ? (
                      <View style={{ backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Text style={{ color: "#FCA5A5", fontSize: 10, fontWeight: "900" }}>Paused</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => updateTier(offer.tier, { paused: !offer.paused })}
                    style={{ backgroundColor: offer.paused ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.12)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}
                  >
                    <Text style={{ color: offer.paused ? "#FCA5A5" : "rgba(255,255,255,0.86)", fontSize: 11, fontWeight: "800" }}>{offer.paused ? "Paused" : "Pause"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setEditingTier((current) => ({ ...current, [offer.tier]: !current[offer.tier] }))}
                    style={{ backgroundColor: meta.colour + "22", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}
                  >
                    <Text style={{ color: meta.colour, fontSize: 11, fontWeight: "800" }}>{editingTier[offer.tier] ? "Done" : "Edit"}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {editingTier[offer.tier] ? (
                <>
                  <View style={{ marginBottom: 12 }}>
                    <FieldLabel light>Offer Title</FieldLabel>
                    <Input dark value={offer.title} onChangeText={(value) => updateTier(offer.tier, { title: value })} placeholder={`e.g. ${meta.label} member reward`} />
                  </View>

                  <View style={{ marginBottom: 12 }}>
                    <FieldLabel light>Description</FieldLabel>
                    <Input
                      dark
                      value={offer.description}
                      onChangeText={(value) => updateTier(offer.tier, { description: value })}
                      placeholder="Reward details shown to members and staff"
                      multiline
                      style={{
                        minHeight: 96,
                        textAlignVertical: "top",
                      }}
                    />
                  </View>

                  <View style={{ marginBottom: 12 }}>
                    <FieldLabel light>Offer Image URL</FieldLabel>
                    <Input dark value={offer.image_url ?? ""} onChangeText={(value) => updateTier(offer.tier, { image_url: value.trim() })} placeholder="https://..." autoCapitalize="none" />
                  </View>

                  <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <FieldLabel light>Limit Count</FieldLabel>
                      <Input
                        dark
                        value={String(offer.limit_count ?? 1)}
                        onChangeText={(value) => updateTier(offer.tier, { limit_count: Math.max(1, Number(value || 1)) })}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={{ flex: 1.35 }}>
                      <FieldLabel light>Redemption Period</FieldLabel>
                      <PeriodSelector value={offer.limit_period} onChange={(value) => updateTier(offer.tier, { limit_period: value })} accent={meta.colour} dark />
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: 12, marginBottom: 10 }}>
                    <View style={{ flex: 1 }}>
                      <FieldLabel light>Starts At</FieldLabel>
                      <Input dark value={offer.starts_at ?? ""} onChangeText={(value) => updateTier(offer.tier, { starts_at: value })} placeholder="2026-03-25T18:00" autoCapitalize="none" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FieldLabel light>Ends At</FieldLabel>
                      <Input dark value={offer.ends_at ?? ""} onChangeText={(value) => updateTier(offer.tier, { ends_at: value })} placeholder="2026-03-31T23:59" autoCapitalize="none" />
                    </View>
                  </View>

                  <View style={{ marginBottom: 12 }}>
                    <FieldLabel light>Days Of Week</FieldLabel>
                    <DaySelector value={offer.days_of_week ?? []} onChange={(value) => updateTier(offer.tier, { days_of_week: value })} accent={meta.colour} dark />
                  </View>

                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <FieldLabel light>Start Time</FieldLabel>
                      <Input dark value={offer.time_start ?? ""} onChangeText={(value) => updateTier(offer.tier, { time_start: sanitiseTimeInput(value) })} placeholder="12:00" autoCapitalize="none" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FieldLabel light>End Time</FieldLabel>
                      <Input dark value={offer.time_end ?? ""} onChangeText={(value) => updateTier(offer.tier, { time_end: sanitiseTimeInput(value) })} placeholder="15:00" autoCapitalize="none" />
                    </View>
                  </View>
                </>
              ) : (
                <View style={{ gap: 8 }}>
                  {offer.featured ? <Text style={{ color: meta.colour, fontSize: 12, fontWeight: "800" }}>Featured by HU NOW</Text> : null}
                  <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 15, fontWeight: "800" }}>{offer.title.trim() || "No tier reward set yet"}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.74)", fontSize: 14, lineHeight: 20 }}>
                    {offer.description.trim() || "Add a reward for this tier if you want to offer one."}
                  </Text>
                  {offer.image_url ? (
                    <Text style={{ color: "rgba(255,255,255,0.68)", fontSize: 12 }}>
                      Custom offer image set
                    </Text>
                  ) : null}
                  <Text style={{ color: "rgba(255,255,255,0.78)", fontSize: 12, fontWeight: "700" }}>
                    {formatOfferRule(offer.limit_count, offer.limit_period)}
                  </Text>
                  {offer.paused ? <Text style={{ color: "#FCA5A5", fontSize: 12, fontWeight: "800" }}>Currently paused</Text> : null}
                  {(offer.starts_at || offer.ends_at) ? (
                    <Text style={{ color: "rgba(255,255,255,0.68)", fontSize: 12 }}>
                      {offer.starts_at ? `Starts ${offer.starts_at}` : "Always on"}
                      {offer.ends_at ? ` • Ends ${offer.ends_at}` : ""}
                    </Text>
                  ) : null}
                  {formatOfferSchedule(offer.days_of_week ?? [], offer.time_start, offer.time_end) ? (
                    <Text style={{ color: "rgba(255,255,255,0.68)", fontSize: 12 }}>
                      {formatOfferSchedule(offer.days_of_week ?? [], offer.time_start, offer.time_end)}
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
          );
        })}

        {hasEditingOpen && (
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{
              backgroundColor: saving ? "rgba(251,201,0,0.5)" : YELLOW,
              borderRadius: 18,
              paddingVertical: 17,
              alignItems: "center",
              marginTop: 4,
              marginBottom: 18,
            }}
          >
            {saving ? <ActivityIndicator color={NAV} /> : <Text style={{ color: NAV, fontSize: 16, fontWeight: "900" }}>Save Offers</Text>}
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
