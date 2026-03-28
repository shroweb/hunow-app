import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import {
  wordpress,
  type BusinessOffersResponse,
  type WPLoyaltyCardConfig,
} from "@/lib/wordpress";
import { BusinessSetupGate } from "@/components/BusinessSetupGate";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

function FieldLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        color: "rgba(255,255,255,0.7)",
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

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor="rgba(255,255,255,0.35)"
      style={{
        backgroundColor: "rgba(255,255,255,0.12)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: "white",
        fontSize: 14,
        ...(props.style as object),
      }}
      {...props}
    />
  );
}

const DEFAULT_LOYALTY_CARD: WPLoyaltyCardConfig = {
  enabled: false,
  card_title: "Venue Loyalty Card",
  stamp_label: "Stamp",
  reward_title: "Loyalty Reward",
  reward_description: "",
  reward_expiry_days: null,
};

export default function BusinessLoyaltyScreen() {
  const { user, token, appConfig } = useAuth();
  const [data, setData] = useState<BusinessOffersResponse | null>(null);
  const [loyaltyCard, setLoyaltyCard] = useState<WPLoyaltyCardConfig>(DEFAULT_LOYALTY_CARD);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const businessReady = user?.role === "business" && user?.setup_status === "ready" && Boolean(user?.venue_id);
  const editingEnabled = appConfig?.feature_flags?.business_offers_editing !== false;

  useEffect(() => {
    async function load() {
      if (!token || !businessReady) {
        setLoading(false);
        return;
      }

      try {
        const response = await wordpress.getBusinessOffers(token);
        setData(response);
        setLoyaltyCard(response.loyalty_card ?? DEFAULT_LOYALTY_CARD);
      } catch (err: any) {
        Alert.alert("Couldn’t load loyalty", err?.message ?? "Please try again.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token, businessReady]);

  async function handleSave() {
    if (!token || !data) return;
    setSaving(true);

    try {
      const response = await wordpress.saveBusinessOffers(
        {
          standard_offers: data.standard_offers,
          tier_offers: data.tier_offers,
          loyalty_card: {
            ...loyaltyCard,
            card_title: loyaltyCard.card_title.trim() || DEFAULT_LOYALTY_CARD.card_title,
            stamp_label: loyaltyCard.stamp_label.trim() || DEFAULT_LOYALTY_CARD.stamp_label,
            reward_title: loyaltyCard.reward_title.trim() || DEFAULT_LOYALTY_CARD.reward_title,
            reward_description: loyaltyCard.reward_description.trim(),
            reward_expiry_days:
              loyaltyCard.reward_expiry_days === null || loyaltyCard.reward_expiry_days === undefined || Number.isNaN(Number(loyaltyCard.reward_expiry_days))
                ? null
                : Math.max(1, Number(loyaltyCard.reward_expiry_days)),
          },
        },
        token
      );

      setData(response);
      setLoyaltyCard(response.loyalty_card ?? DEFAULT_LOYALTY_CARD);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaveMessage("Loyalty card saved. Venue staff can now stamp purchases from the Scan tab.");
    } catch (err: any) {
      Alert.alert("Couldn’t save loyalty", err?.message ?? "Please try again.");
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
        <Text style={{ color: "rgba(255,255,255,0.5)", textAlign: "center" }}>Please log back in to manage your venue loyalty card.</Text>
      </SafeAreaView>
    );
  }

  if (!businessReady) {
    return <BusinessSetupGate user={user} title="Business loyalty unavailable" />;
  }

  if (!editingEnabled) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: NAV, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: YELLOW + "22", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Ionicons name="card-outline" size={24} color={YELLOW} />
        </View>
        <Text style={{ color: "white", fontSize: 18, fontWeight: "800", marginBottom: 8 }}>Loyalty editing unavailable</Text>
        <Text style={{ color: "rgba(255,255,255,0.5)", textAlign: "center" }}>This app build doesn’t support in-app loyalty card management with the current server configuration.</Text>
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
        <Text style={{ color: "rgba(255,255,255,0.5)", textAlign: "center" }}>This business account needs a linked venue before loyalty can be configured.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {saveMessage ? (
          <View style={{ backgroundColor: "rgba(34,197,94,0.12)", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "rgba(34,197,94,0.24)", marginBottom: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#22C55E", fontSize: 13, fontWeight: "900", marginBottom: 4 }}>Loyalty saved</Text>
                <Text style={{ color: "rgba(255,255,255,0.78)", fontSize: 12, lineHeight: 18 }}>{saveMessage}</Text>
              </View>
              <TouchableOpacity onPress={() => setSaveMessage(null)}>
                <Ionicons name="close" size={16} color="rgba(255,255,255,0.56)" />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={{ marginBottom: 18 }}>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 }}>
            Venue Loyalty
          </Text>
          <Text style={{ color: "white", fontSize: 26, fontWeight: "900", letterSpacing: -0.4, marginBottom: 8 }}>
            {data.venue_name}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 20 }}>
            Configure one loyalty card for this venue. Staff add stamps after purchases, members earn +5 points at 5 stamps, and a loyalty voucher at 10.
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginBottom: 18 }}>
          <View style={{ flex: 1, backgroundColor: loyaltyCard.enabled ? YELLOW : "rgba(255,255,255,0.07)", borderRadius: 20, padding: 16, borderWidth: loyaltyCard.enabled ? 0 : 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: loyaltyCard.enabled ? "rgba(15,0,50,0.6)" : "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Status</Text>
            <Text style={{ color: loyaltyCard.enabled ? NAV : "white", fontSize: 18, fontWeight: "900" }}>{loyaltyCard.enabled ? "Enabled" : "Disabled"}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Reward Cycle</Text>
            <Text style={{ color: "white", fontSize: 18, fontWeight: "900" }}>10 Stamps</Text>
          </View>
        </View>

        <View style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>Loyalty Settings</Text>
            <TouchableOpacity
              onPress={() => setLoyaltyCard((current) => ({ ...current, enabled: !current.enabled }))}
              style={{
                backgroundColor: loyaltyCard.enabled ? YELLOW : "rgba(255,255,255,0.12)",
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: loyaltyCard.enabled ? NAV : "white", fontSize: 12, fontWeight: "900" }}>
                {loyaltyCard.enabled ? "Enabled" : "Enable Loyalty"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <View style={{ backgroundColor: "rgba(251,201,0,0.14)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: YELLOW, fontSize: 11, fontWeight: "900" }}>5 stamps = +5 pts</Text>
            </View>
            <View style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: "white", fontSize: 11, fontWeight: "900" }}>10 stamps = voucher reward</Text>
            </View>
          </View>

          <View style={{ marginBottom: 12 }}>
            <FieldLabel>Card Title</FieldLabel>
            <Input
              value={loyaltyCard.card_title}
              onChangeText={(value) => setLoyaltyCard((current) => ({ ...current, card_title: value }))}
              placeholder="e.g. Brewdog Loyalty Card"
            />
          </View>

          <View style={{ marginBottom: 12 }}>
            <FieldLabel>Stamp Label</FieldLabel>
            <Input
              value={loyaltyCard.stamp_label}
              onChangeText={(value) => setLoyaltyCard((current) => ({ ...current, stamp_label: value }))}
              placeholder="e.g. Pint stamp"
            />
          </View>

          <View style={{ marginBottom: 12 }}>
            <FieldLabel>10-Stamp Reward Title</FieldLabel>
            <Input
              value={loyaltyCard.reward_title}
              onChangeText={(value) => setLoyaltyCard((current) => ({ ...current, reward_title: value }))}
              placeholder="e.g. Free burger reward"
            />
          </View>

          <View style={{ marginBottom: 12 }}>
            <FieldLabel>Reward Description</FieldLabel>
            <Input
              value={loyaltyCard.reward_description}
              onChangeText={(value) => setLoyaltyCard((current) => ({ ...current, reward_description: value }))}
              placeholder="Tell members what they unlock at 10 stamps"
              multiline
              style={{ minHeight: 96, textAlignVertical: "top" }}
            />
          </View>

          <View style={{ marginBottom: 14 }}>
            <FieldLabel>Voucher Expiry Days</FieldLabel>
            <Input
              value={loyaltyCard.reward_expiry_days ? String(loyaltyCard.reward_expiry_days) : ""}
              onChangeText={(value) =>
                setLoyaltyCard((current) => ({
                  ...current,
                  reward_expiry_days: value.trim() ? Math.max(1, Number(value || 1)) : null,
                }))
              }
              placeholder="Optional, e.g. 30"
              keyboardType="number-pad"
            />
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={{ backgroundColor: saving ? "rgba(251,201,0,0.5)" : YELLOW, borderRadius: 16, paddingVertical: 15, alignItems: "center" }}
          >
            {saving ? <ActivityIndicator color={NAV} /> : <Text style={{ color: NAV, fontSize: 15, fontWeight: "900" }}>Save Loyalty Card</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
