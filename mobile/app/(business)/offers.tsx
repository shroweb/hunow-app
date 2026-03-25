import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import {
  wordpress,
  formatOfferRule,
  type BusinessOffersResponse,
  type WPOffer,
  type WPTierOffer,
} from "@/lib/wordpress";

const NAV = "#0F0032";
const YELLOW = "#FBC900";
const PERIODS: Array<WPOffer["limit_period"]> = ["week", "month", "year", "ever"];
const TIER_META: Record<"bronze" | "silver" | "gold", { label: string; colour: string; unlock: string }> = {
  bronze: { label: "Bronze", colour: "#CD7F32", unlock: "200 pts" },
  silver: { label: "Silver", colour: "#C0C0C0", unlock: "600 pts" },
  gold: { label: "Gold", colour: "#FBC900", unlock: "1,400 pts" },
};

function sanitiseDateInput(value: string) {
  return value.trim();
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={{ color: "rgba(15,0,50,0.55)", fontSize: 11, fontWeight: "800", letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 6 }}>{children}</Text>;
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor="rgba(15,0,50,0.28)"
      style={{
        backgroundColor: "rgba(15,0,50,0.04)",
        borderWidth: 1,
        borderColor: "rgba(15,0,50,0.08)",
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: NAV,
        fontSize: 14,
      }}
      {...props}
    />
  );
}

function PeriodSelector({
  value,
  onChange,
  accent = YELLOW,
}: {
  value?: WPOffer["limit_period"];
  onChange: (next: WPOffer["limit_period"]) => void;
  accent?: string;
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
              backgroundColor: active ? accent : "rgba(15,0,50,0.05)",
              borderWidth: 1,
              borderColor: active ? accent : "rgba(15,0,50,0.08)",
            }}
          >
            <Text style={{ color: active ? NAV : "rgba(15,0,50,0.6)", fontSize: 12, fontWeight: "800", textTransform: "capitalize" }}>{period}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function BusinessOffersScreen() {
  const { user, token } = useAuth();
  const [data, setData] = useState<BusinessOffersResponse | null>(null);
  const [standardOffers, setStandardOffers] = useState<WPOffer[]>([]);
  const [tierOffers, setTierOffers] = useState<WPTierOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await wordpress.getBusinessOffers(token);
        setData(response);
        setStandardOffers(response.standard_offers);
        setTierOffers(response.tier_offers);
      } catch (err: any) {
        setData(null);
        Alert.alert("Couldn’t load offers", err?.message ?? "Please try again.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token]);

  function updateStandard(id: number, patch: Partial<WPOffer>) {
    setStandardOffers((current) => current.map((offer) => (offer.id === id ? { ...offer, ...patch } : offer)));
  }

  function updateTier(tier: WPTierOffer["tier"], patch: Partial<WPTierOffer>) {
    setTierOffers((current) => current.map((offer) => (offer.tier === tier ? { ...offer, ...patch } : offer)));
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
        })),
        tier_offers: tierOffers.map((offer) => ({
          ...offer,
          title: offer.title.trim(),
          description: offer.description.trim(),
          starts_at: sanitiseDateInput(offer.starts_at ?? ""),
          ends_at: sanitiseDateInput(offer.ends_at ?? ""),
        })),
      };

      const response = await wordpress.saveBusinessOffers(payload, token);
      setData(response);
      setStandardOffers(response.standard_offers);
      setTierOffers(response.tier_offers);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Offers Updated", "Your venue offers have been saved.");
    } catch (err: any) {
      Alert.alert("Couldn’t save offers", err?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  }

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
              <Text style={{ color: NAV, fontSize: 18, fontWeight: "900" }}>Offer {offer.id}</Text>
              <View style={{ backgroundColor: "rgba(251,201,0,0.18)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: NAV, fontSize: 11, fontWeight: "800" }}>{offer.title.trim() ? "Live slot" : "Empty slot"}</Text>
              </View>
            </View>

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

            <Text style={{ color: "rgba(15,0,50,0.45)", fontSize: 12, fontWeight: "700" }}>
              {formatOfferRule(offer.limit_count, offer.limit_period)}
            </Text>
          </View>
        ))}

        <Text style={{ color: "white", fontSize: 18, fontWeight: "800", marginTop: 8, marginBottom: 10 }}>Tier Offers</Text>
        {tierOffers.map((offer) => {
          const meta = TIER_META[offer.tier];
          return (
            <View key={offer.tier} style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: meta.colour + "55" }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <View>
                  <Text style={{ color: "white", fontSize: 18, fontWeight: "900" }}>{meta.label}</Text>
                  <Text style={{ color: meta.colour, fontSize: 12, fontWeight: "700", marginTop: 2 }}>Unlocks at {meta.unlock}</Text>
                </View>
                <View style={{ backgroundColor: meta.colour + "22", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={{ color: meta.colour, fontSize: 11, fontWeight: "800" }}>{offer.title.trim() ? "Enabled" : "Optional"}</Text>
                </View>
              </View>

              <View style={{ marginBottom: 12 }}>
                <FieldLabel>Offer Title</FieldLabel>
                <Input value={offer.title} onChangeText={(value) => updateTier(offer.tier, { title: value })} placeholder={`e.g. ${meta.label} member reward`} />
              </View>

              <View style={{ marginBottom: 12 }}>
                <FieldLabel>Description</FieldLabel>
                <Input
                  value={offer.description}
                  onChangeText={(value) => updateTier(offer.tier, { description: value })}
                  placeholder="Reward details shown to members and staff"
                  multiline
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.08)",
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    color: "white",
                    fontSize: 14,
                    minHeight: 96,
                    textAlignVertical: "top",
                  }}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Limit Count</FieldLabel>
                  <Input
                    value={String(offer.limit_count ?? 1)}
                    onChangeText={(value) => updateTier(offer.tier, { limit_count: Math.max(1, Number(value || 1)) })}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1.35 }}>
                  <FieldLabel>Redemption Period</FieldLabel>
                  <PeriodSelector value={offer.limit_period} onChange={(value) => updateTier(offer.tier, { limit_period: value })} accent={meta.colour} />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 12, marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Starts At</FieldLabel>
                  <Input value={offer.starts_at ?? ""} onChangeText={(value) => updateTier(offer.tier, { starts_at: value })} placeholder="2026-03-25T18:00" autoCapitalize="none" />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>Ends At</FieldLabel>
                  <Input value={offer.ends_at ?? ""} onChangeText={(value) => updateTier(offer.tier, { ends_at: value })} placeholder="2026-03-31T23:59" autoCapitalize="none" />
                </View>
              </View>

              <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700" }}>
                {formatOfferRule(offer.limit_count, offer.limit_period)}
              </Text>
            </View>
          );
        })}

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
      </ScrollView>
    </SafeAreaView>
  );
}
