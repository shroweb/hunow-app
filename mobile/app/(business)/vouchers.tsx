import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { fetchBusinessVouchers, createBusinessVoucher, type WPVoucher } from "@/lib/wpAuth";
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

export default function BusinessVouchersScreen() {
  const { user, token, appConfig } = useAuth();
  const [vouchers, setVouchers] = useState<WPVoucher[]>([]);
  const [voucherDraft, setVoucherDraft] = useState({ title: "", code: "", description: "", expires_at: "" });
  const [voucherSaving, setVoucherSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const businessReady = user?.role === "business" && user?.setup_status === "ready" && Boolean(user?.venue_id);
  const vouchersEnabled = appConfig?.feature_flags?.vouchers !== false;

  useEffect(() => {
    async function load() {
      if (!token || !businessReady) {
        setLoading(false);
        return;
      }

      try {
        const vouchersResponse = await fetchBusinessVouchers(token);
        setVouchers(vouchersResponse);
      } catch (err: any) {
        Alert.alert("Couldn’t load vouchers", err?.message ?? "Please try again.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token, businessReady]);

  async function handleCreateVoucher() {
    if (!token || !voucherDraft.title.trim() || !voucherDraft.code.trim()) return;
    setVoucherSaving(true);
    try {
      const voucher = await createBusinessVoucher(
        {
          title: voucherDraft.title.trim(),
          code: voucherDraft.code.trim(),
          description: voucherDraft.description.trim(),
          expires_at: voucherDraft.expires_at.trim(),
        },
        token
      );
      setVouchers((current) => [voucher, ...current]);
      setVoucherDraft({ title: "", code: "", description: "", expires_at: "" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaveMessage("Voucher created. Members can now claim it with the code you set.");
    } catch (err: any) {
      Alert.alert("Couldn’t create voucher", err?.message ?? "Please try again.");
    } finally {
      setVoucherSaving(false);
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
        <Text style={{ color: "rgba(255,255,255,0.5)", textAlign: "center" }}>Please log back in to manage your venue vouchers.</Text>
      </SafeAreaView>
    );
  }

  if (!businessReady) {
    return <BusinessSetupGate user={user} title="Business vouchers unavailable" />;
  }

  if (!vouchersEnabled) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: NAV, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: YELLOW + "22", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Ionicons name="ticket-outline" size={24} color={YELLOW} />
        </View>
        <Text style={{ color: "white", fontSize: 18, fontWeight: "800", marginBottom: 8 }}>Vouchers unavailable</Text>
        <Text style={{ color: "rgba(255,255,255,0.5)", textAlign: "center" }}>This app build doesn’t support in-app voucher management with the current server configuration.</Text>
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
                <Text style={{ color: "#22C55E", fontSize: 13, fontWeight: "900", marginBottom: 4 }}>Voucher ready</Text>
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
            Manage Vouchers
          </Text>
          <Text style={{ color: "white", fontSize: 26, fontWeight: "900", letterSpacing: -0.4, marginBottom: 8 }}>
            {user.venue_name ?? "Venue Vouchers"}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 20 }}>
            Create one-time giveaway vouchers for your venue. Members claim them with a code, then staff redeem the voucher QR once.
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginBottom: 18 }}>
          <View style={{ flex: 1, backgroundColor: YELLOW, borderRadius: 20, padding: 16 }}>
            <Text style={{ color: "rgba(15,0,50,0.6)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Live</Text>
            <Text style={{ color: NAV, fontSize: 22, fontWeight: "900" }}>{vouchers.filter((voucher) => voucher.status === "active").length}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Total</Text>
            <Text style={{ color: "white", fontSize: 22, fontWeight: "900" }}>{vouchers.length}</Text>
          </View>
        </View>

        <View style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>Create Voucher</Text>
            <View style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 10, fontWeight: "900", textTransform: "uppercase" }}>One-time use</Text>
            </View>
          </View>
          <View style={{ marginBottom: 12 }}>
            <FieldLabel>Voucher Title</FieldLabel>
            <Input value={voucherDraft.title} onChangeText={(value) => setVoucherDraft((current) => ({ ...current, title: value }))} placeholder="e.g. Free meal for two" />
          </View>
          <View style={{ marginBottom: 12 }}>
            <FieldLabel>Voucher Code</FieldLabel>
            <Input value={voucherDraft.code} onChangeText={(value) => setVoucherDraft((current) => ({ ...current, code: value.toUpperCase() }))} placeholder="e.g. HUNOWMEAL" autoCapitalize="characters" />
          </View>
          <View style={{ marginBottom: 12 }}>
            <FieldLabel>Description</FieldLabel>
            <Input value={voucherDraft.description} onChangeText={(value) => setVoucherDraft((current) => ({ ...current, description: value }))} placeholder="What the member gets" multiline style={{ minHeight: 88, textAlignVertical: "top" }} />
          </View>
          <View style={{ marginBottom: 14 }}>
            <FieldLabel>Expiry</FieldLabel>
            <Input value={voucherDraft.expires_at} onChangeText={(value) => setVoucherDraft((current) => ({ ...current, expires_at: value }))} placeholder="2026-04-30T23:59" autoCapitalize="none" />
          </View>
          <TouchableOpacity
            onPress={handleCreateVoucher}
            disabled={voucherSaving || !voucherDraft.title.trim() || !voucherDraft.code.trim()}
            style={{ backgroundColor: voucherDraft.title.trim() && voucherDraft.code.trim() ? YELLOW : "rgba(251,201,0,0.28)", borderRadius: 16, paddingVertical: 15, alignItems: "center" }}
          >
            {voucherSaving ? <ActivityIndicator color={NAV} /> : <Text style={{ color: NAV, fontSize: 15, fontWeight: "900" }}>Create Voucher</Text>}
          </TouchableOpacity>
        </View>

        <Text style={{ color: "white", fontSize: 18, fontWeight: "800", marginBottom: 10 }}>Venue Vouchers</Text>
        {vouchers.length === 0 ? (
          <View style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: "white", fontSize: 15, fontWeight: "800", marginBottom: 6 }}>No vouchers yet</Text>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 19 }}>
              Create a giveaway, competition prize, or one-off guest reward above and it’ll appear here straight away.
            </Text>
          </View>
        ) : vouchers.map((voucher) => (
          <View key={voucher.id} style={{ backgroundColor: voucher.status === "active" ? "white" : "rgba(255,255,255,0.08)", borderRadius: 20, padding: 16, marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: voucher.status === "active" ? NAV : "white", fontSize: 17, fontWeight: "900" }}>{voucher.title}</Text>
                <Text style={{ color: voucher.status === "active" ? "rgba(15,0,50,0.48)" : "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 4 }}>Code: {voucher.code}</Text>
              </View>
              <View style={{ backgroundColor: voucher.status === "active" ? YELLOW + "22" : "rgba(255,255,255,0.12)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: voucher.status === "active" ? "#8A6A00" : "rgba(255,255,255,0.76)", fontSize: 10, fontWeight: "900", textTransform: "uppercase" }}>{voucher.status}</Text>
              </View>
            </View>
            {voucher.description ? (
              <Text style={{ color: voucher.status === "active" ? "rgba(15,0,50,0.64)" : "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 19, marginBottom: 10 }}>{voucher.description}</Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {voucher.expires_at ? (
                <View style={{ backgroundColor: voucher.status === "active" ? "rgba(15,0,50,0.06)" : "rgba(255,255,255,0.1)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={{ color: voucher.status === "active" ? "rgba(15,0,50,0.72)" : "rgba(255,255,255,0.74)", fontSize: 11, fontWeight: "800" }}>Expires {voucher.expires_at.replace("T", " ")}</Text>
                </View>
              ) : null}
              {voucher.claimed_at ? (
                <View style={{ backgroundColor: voucher.status === "active" ? "rgba(15,0,50,0.06)" : "rgba(255,255,255,0.1)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={{ color: voucher.status === "active" ? "rgba(15,0,50,0.72)" : "rgba(255,255,255,0.74)", fontSize: 11, fontWeight: "800" }}>Claimed</Text>
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
