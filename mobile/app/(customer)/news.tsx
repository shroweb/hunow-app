import { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, Modal, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { fetchVouchers, redeemVoucherCode, type WPVoucher } from "@/lib/wpAuth";
import { buildVoucherQrPayload } from "@/lib/qrPayload";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function DottedVoucherLine({ dark = false }: { dark?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 22, paddingVertical: 10 }}>
      {Array.from({ length: 22 }).map((_, index) => (
        <View
          key={index}
          style={{
            width: 5,
            height: 5,
            borderRadius: 999,
            backgroundColor: dark ? "rgba(255,255,255,0.18)" : "rgba(15,0,50,0.18)",
          }}
        />
      ))}
    </View>
  );
}

export default function VouchersScreen() {
  const { token } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [redeemingCode, setRedeemingCode] = useState(false);
  const [vouchers, setVouchers] = useState<WPVoucher[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState<WPVoucher | null>(null);
  const [showUsedVouchers, setShowUsedVouchers] = useState(false);

  async function load(showLoader = true) {
    if (!token) {
      setLoading(false);
      setVouchers([]);
      return;
    }
    if (showLoader) setLoading(true);
    try {
      const result = await fetchVouchers(token);
      setVouchers(result);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function handleRedeemCode() {
    if (!token || !code.trim()) return;
    setRedeemingCode(true);
    try {
      const voucher = await redeemVoucherCode(code.trim(), token);
      setCode("");
      await load(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedVoucher(voucher);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(err?.message ?? "Could not redeem voucher code.");
    } finally {
      setRedeemingCode(false);
    }
  }

  const grouped = useMemo(() => {
    const active = vouchers.filter((voucher) => voucher.status === "active");
    const used = vouchers.filter((voucher) => voucher.status !== "active");
    return { active, used };
  }, [vouchers]);

  const walletItems = useMemo(
    () => [...grouped.active, ...(showUsedVouchers ? grouped.used : [])],
    [grouped.active, grouped.used, showUsedVouchers]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <FlatList
        data={walletItems}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} tintColor={YELLOW} />
        }
        ListHeaderComponent={
          <View style={{ marginBottom: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
              <View>
                <Text style={{ color: "white", fontSize: 30, fontWeight: "900", letterSpacing: -0.6 }}>Vouchers</Text>
                <Text style={{ color: "rgba(255,255,255,0.46)", fontSize: 14, marginTop: 4 }}>
                  Claim codes, keep your rewards, and present them to staff when you’re ready.
                </Text>
              </View>
            </View>

            <View style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 22, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: 18 }}>
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 10 }}>
                Redeem Voucher Code
              </Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="Enter voucher code"
                autoCapitalize="characters"
                placeholderTextColor="rgba(255,255,255,0.28)"
                style={{
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                  color: "white",
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                  marginBottom: 12,
                }}
              />
              <TouchableOpacity
                onPress={handleRedeemCode}
                disabled={redeemingCode || !code.trim()}
                style={{
                  backgroundColor: code.trim() ? YELLOW : "rgba(251,201,0,0.28)",
                  borderRadius: 16,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: NAV, fontSize: 15, fontWeight: "900" }}>{redeemingCode ? "Redeeming..." : "Redeem Code"}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: 14 }}>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 8 }}>
                Voucher Wallet
              </Text>
              <Text style={{ color: "white", fontSize: 28, fontWeight: "900", marginBottom: 4 }}>{grouped.active.length}</Text>
              <Text style={{ color: "rgba(255,255,255,0.48)", fontSize: 13 }}>
                Active voucher{grouped.active.length === 1 ? "" : "s"} ready to use
              </Text>
            </View>

            {grouped.active.length > 0 ? (
              <Text style={{ color: "white", fontWeight: "800", fontSize: 18, marginBottom: 10 }}>Ready to use</Text>
            ) : null}

            {grouped.used.length > 0 ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setShowUsedVouchers((value) => !value)}
                style={{
                  marginTop: grouped.active.length > 0 ? 6 : 0,
                  marginBottom: showUsedVouchers ? 10 : 16,
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderRadius: 18,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingRight: 12 }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: "rgba(255,255,255,0.08)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="archive-outline" size={18} color="rgba(255,255,255,0.8)" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "white", fontSize: 15, fontWeight: "800" }}>
                      Redeemed or expired
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.48)", fontSize: 12, marginTop: 2 }}>
                      {grouped.used.length} voucher{grouped.used.length === 1 ? "" : "s"} hidden to keep this page tidy
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={showUsedVouchers ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="rgba(255,255,255,0.82)"
                  />
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => {
          const isUsed = item.status !== "active";
          return (
            <View>
              <TouchableOpacity
                activeOpacity={0.9}
                disabled={isUsed}
                onPress={() => setSelectedVoucher(item)}
                style={{
                  backgroundColor: isUsed ? "#2A174A" : "white",
                  borderRadius: 28,
                  marginBottom: 12,
                  overflow: "hidden",
                  borderWidth: isUsed ? 1 : 0,
                  borderColor: isUsed ? "rgba(255,255,255,0.12)" : "transparent",
                }}
              >
                <View style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ color: isUsed ? "rgba(255,255,255,0.45)" : "rgba(15,0,50,0.42)", fontSize: 11, fontWeight: "900", letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6 }}>
                        {item.venue_name ?? "HU NOW Voucher"}
                      </Text>
                      <Text style={{ color: isUsed ? "white" : NAV, fontSize: 21, fontWeight: "900", lineHeight: 26 }}>{item.title}</Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: isUsed ? "rgba(255,255,255,0.1)" : YELLOW + "22",
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderWidth: isUsed ? 1 : 0,
                        borderColor: isUsed ? "rgba(255,255,255,0.12)" : "transparent",
                      }}
                    >
                      <Text style={{ color: isUsed ? "rgba(255,255,255,0.86)" : "#8A6A00", fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>
                        {item.status}
                      </Text>
                    </View>
                  </View>
                  {item.description ? (
                    <Text style={{ color: isUsed ? "rgba(255,255,255,0.58)" : "rgba(15,0,50,0.62)", fontSize: 14, lineHeight: 20, marginBottom: 12 }}>
                      {item.description}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                    {item.expires_at ? (
                      <View style={{ backgroundColor: isUsed ? "rgba(255,255,255,0.08)" : "rgba(15,0,50,0.06)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <Text style={{ color: isUsed ? "rgba(255,255,255,0.72)" : "rgba(15,0,50,0.72)", fontSize: 11, fontWeight: "800" }}>Expires {formatDate(item.expires_at)}</Text>
                      </View>
                    ) : null}
                    {item.required_tier ? (
                      <View style={{ backgroundColor: isUsed ? "rgba(255,255,255,0.08)" : "rgba(15,0,50,0.06)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <Text style={{ color: isUsed ? "rgba(255,255,255,0.72)" : "rgba(15,0,50,0.72)", fontSize: 11, fontWeight: "800" }}>{item.required_tier.toUpperCase()}+</Text>
                      </View>
                    ) : null}
                  </View>
                  <View
                    style={{
                      backgroundColor: isUsed ? "rgba(255,255,255,0.08)" : "rgba(15,0,50,0.05)",
                      borderRadius: 14,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderWidth: isUsed ? 1 : 0,
                      borderColor: isUsed ? "rgba(255,255,255,0.08)" : "transparent",
                    }}
                  >
                    <Text style={{ color: isUsed ? "rgba(255,255,255,0.45)" : "rgba(15,0,50,0.42)", fontSize: 10, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 4 }}>
                      Voucher Code
                    </Text>
                    <Text style={{ color: isUsed ? "white" : NAV, fontSize: 16, fontWeight: "900", letterSpacing: 1.2 }}>
                      {item.code}
                    </Text>
                  </View>
                </View>
                <DottedVoucherLine dark={isUsed} />
                <View style={{ position: "absolute", left: -12, top: "66%", width: 24, height: 24, borderRadius: 12, backgroundColor: NAV }} />
                <View style={{ position: "absolute", right: -12, top: "66%", width: 24, height: 24, borderRadius: 12, backgroundColor: NAV }} />
                {!isUsed ? (
                  <View style={{ paddingHorizontal: 18, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View>
                      <Text style={{ color: "rgba(15,0,50,0.4)", fontSize: 10, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 4 }}>
                        Redemption Stub
                      </Text>
                      <Text style={{ color: NAV, fontSize: 15, fontWeight: "900" }}>Show QR to redeem</Text>
                    </View>
                    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: YELLOW, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="arrow-forward" size={20} color={NAV} />
                    </View>
                  </View>
                ) : (
                  <View
                    style={{
                      paddingHorizontal: 18,
                      paddingVertical: 16,
                      backgroundColor: "rgba(255,255,255,0.05)",
                      borderTopWidth: 1,
                      borderTopColor: "rgba(255,255,255,0.08)",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingRight: 12 }}>
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: "rgba(255,255,255,0.1)",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons
                            name={item.status === "redeemed" ? "checkmark-done" : "time-outline"}
                            size={18}
                            color="rgba(255,255,255,0.88)"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: "white", fontSize: 14, fontWeight: "900" }}>
                            {item.status === "redeemed" ? "Voucher redeemed" : "Voucher expired"}
                          </Text>
                          <Text style={{ color: "rgba(255,255,255,0.48)", fontSize: 12, marginTop: 2 }}>
                            {item.status === "redeemed"
                              ? "This voucher has already been used and can no longer be scanned."
                              : "This voucher is no longer valid and has been moved out of your active wallet."}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <Text style={{ color: "rgba(255,255,255,0.5)" }}>Loading vouchers…</Text>
            </View>
          ) : (
            <View style={{ alignItems: "center", marginTop: 20, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 22, padding: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Text style={{ color: "white", fontSize: 16, fontWeight: "800", marginBottom: 6 }}>No vouchers yet</Text>
              <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 13, textAlign: "center", lineHeight: 19 }}>
                Enter a voucher code above to claim your first reward.
              </Text>
            </View>
          )
        }
      />

      <Modal visible={!!selectedVoucher} animationType="slide" transparent onRequestClose={() => setSelectedVoucher(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.86)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ width: "100%", maxWidth: 360, backgroundColor: "#090512", borderRadius: 28, padding: 24, borderWidth: 1, borderColor: "rgba(251,201,0,0.18)" }}>
            <Text style={{ color: "rgba(255,255,255,0.44)", fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>
              Present to staff
            </Text>
            <Text style={{ color: "white", fontSize: 24, fontWeight: "900", marginBottom: 4 }}>{selectedVoucher?.title}</Text>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, marginBottom: 20 }}>{selectedVoucher?.venue_name}</Text>
            <View style={{ backgroundColor: "white", borderRadius: 28, padding: 20, alignItems: "center", marginBottom: 18 }}>
              {selectedVoucher ? (
                <QRCode
                  value={buildVoucherQrPayload({ version: 1, voucher_token: selectedVoucher.token })}
                  size={220}
                  color={NAV}
                  backgroundColor="transparent"
                />
              ) : null}
            </View>
            <Text style={{ color: "rgba(255,255,255,0.48)", fontSize: 12, textAlign: "center", marginBottom: 22 }}>
              One-time voucher. Once redeemed, it will be marked as used in your wallet.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 18, paddingVertical: 15, alignItems: "center" }}
              onPress={() => setSelectedVoucher(null)}
            >
              <Text style={{ color: "white", fontWeight: "800", fontSize: 15 }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
