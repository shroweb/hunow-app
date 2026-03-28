import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { wordpress, extractOffers, formatOfferRule, type WPLoyaltyStatus, type WPOffer, type WPTierOffer } from "@/lib/wordpress";
import { lookupCard, stampLoyalty, wpRedeem, lookupVoucher, redeemVoucher, type OfferStatus, type WPVoucher } from "@/lib/wpAuth";
import { decodeHtml } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { ConfettiCannon } from "@/components/ConfettiCannon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BusinessSetupGate } from "@/components/BusinessSetupGate";
import { parseMemberQrPayload, parseVoucherQrPayload } from "@/lib/qrPayload";
import { TIER_META } from "@/lib/tierMeta";

const DASHBOARD_REFRESH_KEY = "hunow_business_dashboard_refresh";

export default function ScanScreen() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [wpPostId, setWpPostId] = useState<number | null>(null);
  const [offers, setOffers] = useState<WPOffer[]>([]);
  const [tierOffers, setTierOffers] = useState<WPTierOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [cardToken, setCardToken] = useState<string | null>(null);
  const [cardInfo, setCardInfo] = useState<{ name: string; points: number; tier: string } | null>(null);
  const [offerStatuses, setOfferStatuses] = useState<{ standard: Record<number, OfferStatus>; tier: Record<string, OfferStatus> }>({ standard: {}, tier: {} });
  const [selectedOffer, setSelectedOffer] = useState<WPOffer | null>(null);
  const [loyaltyStatus, setLoyaltyStatus] = useState<WPLoyaltyStatus | null>(null);
  const [loyaltyFeedback, setLoyaltyFeedback] = useState<{ title: string; body: string; tone: "success" | "warn" } | null>(null);
  const [scanHint, setScanHint] = useState<string | null>(null);
  const [venueMismatchHint, setVenueMismatchHint] = useState<{ offerTitle?: string | null } | null>(null);
  const [voucherInfo, setVoucherInfo] = useState<WPVoucher | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [stampingLoyalty, setStampingLoyalty] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [pointsAwarded, setPointsAwarded] = useState(35);
  const lastScan = useRef<string>("");
  const businessReady = user?.role === "business" && user?.setup_status === "ready" && Boolean(user?.venue_id);

  // Load this venue's offers from WordPress
  useEffect(() => {
    async function load() {
      if (!user || !businessReady) { setOffersLoading(false); return; }

      const venueId = user.venue_id;
      setWpPostId(venueId || null);

      if (venueId) {
        try {
          const venue = await wordpress.getEatById(venueId);
          if (venue) {
            setOffers(extractOffers(venue));
            setTierOffers(venue.tier_offers ?? []);
          }
        } catch {
          // venue might not be found — show empty list
        }
      }
      setOffersLoading(false);
    }
    load();
  }, [user, businessReady]);

  async function handleScan({ data }: { data: string }) {
    if (data === lastScan.current || !token || !wpPostId) return;
    lastScan.current = data;
    setScanning(false);

    const voucherPayload = parseVoucherQrPayload(data);
    if (voucherPayload) {
      try {
        const voucher = await lookupVoucher(voucherPayload.voucher_token, token);
        setVoucherInfo(voucher);
        setSelectedOffer(null);
        setCardInfo(null);
        setCardToken(null);
        setScanHint(null);
        setVenueMismatchHint(null);
        setRedeemSuccess(false);
        setModalVisible(true);
      } catch (err: any) {
        Alert.alert("Invalid Voucher", err?.message ?? "This voucher QR code could not be read.");
        lastScan.current = "";
        setScanning(true);
      }
      return;
    }

    const qrPayload = parseMemberQrPayload(data);
    const resolvedCardToken = qrPayload?.card_token ?? data;

    try {
      const member = await lookupCard(resolvedCardToken, token, wpPostId);
      setCardToken(resolvedCardToken);
      setCardInfo({ name: member.name, points: member.points, tier: member.tier ?? "standard" });
      setLoyaltyStatus(member.loyalty_status ?? null);
      setLoyaltyFeedback(null);
      setOfferStatuses({
        standard: Object.fromEntries((member.offer_statuses?.standard ?? []).map((s) => [s.offer_index ?? 0, s])),
        tier: Object.fromEntries((member.offer_statuses?.tier ?? []).map((s) => [s.tier ?? "", s])),
      });
      setVoucherInfo(null);
      setScanHint(null);
      setVenueMismatchHint(null);
      setSelectedOffer(null);

      if (qrPayload && qrPayload.venue_id === wpPostId) {
        if (typeof qrPayload.offer_index === "number") {
          const matchedOffer = offers.find((offer) => offer.id === qrPayload.offer_index);
          if (matchedOffer) {
            setSelectedOffer(matchedOffer);
            setScanHint(`Preselected from member QR: ${decodeHtml(matchedOffer.title)}`);
          }
        } else if (qrPayload.tier) {
          const matchedTier = tierOffers.find((offer) => offer.tier === qrPayload.tier);
          if (matchedTier) {
            setSelectedOffer({
              id: -1,
              title: matchedTier.title,
              description: matchedTier.description,
              _tier: matchedTier.tier,
              limit_count: matchedTier.limit_count,
              limit_period: matchedTier.limit_period,
            } as any);
            setScanHint(`Preselected from member QR: ${matchedTier.title}`);
          }
        }
      } else if (qrPayload?.venue_id && qrPayload.venue_id !== wpPostId) {
        setVenueMismatchHint({
          offerTitle: qrPayload.offer_title ?? null,
        });
      }

      setRedeemSuccess(false);
      setModalVisible(true);
    } catch (err: any) {
      Alert.alert("Invalid Card", err?.message ?? "This QR code is not a valid HU NOW card.");
      lastScan.current = "";
      setScanning(true);
    }
  }

  async function handleRedeem() {
    if (!selectedOffer || !cardToken || !wpPostId || !token) return;
    setRedeeming(true);

    try {
      const tier = (selectedOffer as any)._tier as string | undefined;
      const offerIndex = tier ? undefined : selectedOffer.id;
      const result = await wpRedeem(cardToken, selectedOffer.title, wpPostId, token, offerIndex, tier);
      setPointsAwarded(result.points_awarded ?? 35);
      setRedeemSuccess(true);
      await AsyncStorage.setItem(DASHBOARD_REFRESH_KEY, String(Date.now()));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      const ui = getStaffFailureMessage(err?.message ?? "");
      Alert.alert(ui.title, ui.body);
    }

    setRedeeming(false);
  }

  async function handleAddLoyaltyStamp() {
    if (!cardToken || !token) return;
    setStampingLoyalty(true);
    try {
      const result = await stampLoyalty(cardToken, token);
      setLoyaltyStatus(result.loyalty_status);
      setCardInfo((current) =>
        current
          ? { ...current, points: current.points + (result.points_awarded ?? 0) }
          : current
      );
      setLoyaltyFeedback({
        tone: "success",
        title: result.cycle_completed
          ? "Voucher added to wallet"
          : result.points_awarded > 0
            ? `+${result.loyalty_status.points_milestone.points} points awarded`
            : "Loyalty stamp added",
        body: result.cycle_completed
          ? `${result.voucher?.title ?? "Loyalty reward"} has been added to ${result.member_name}'s vouchers and the card has reset to 0/10.`
          : result.points_awarded > 0
            ? `${result.member_name} reached 5 stamps and earned +${result.loyalty_status.points_milestone.points} HU NOW points.`
            : `${result.member_name} is now on ${result.loyalty_status.stamp_count}/${result.loyalty_status.target} stamps.`,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await AsyncStorage.setItem(DASHBOARD_REFRESH_KEY, String(Date.now()));
    } catch (err: any) {
      setLoyaltyFeedback({
        tone: "warn",
        title: "Couldn’t add loyalty stamp",
        body: err?.message ?? "Please try again.",
      });
    } finally {
      setStampingLoyalty(false);
    }
  }

  async function handleRedeemVoucher() {
    if (!voucherInfo?.token || !token) return;
    setRedeeming(true);
    try {
      await redeemVoucher(voucherInfo.token, token);
      setVoucherInfo((current) => current ? { ...current, status: "redeemed", redeemed_at: new Date().toISOString() } : current);
      setRedeemSuccess(true);
      await AsyncStorage.setItem(DASHBOARD_REFRESH_KEY, String(Date.now()));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Voucher redemption failed", err?.message ?? "Could not redeem voucher.");
    }
    setRedeeming(false);
  }

  function resetScan() {
    setModalVisible(false);
    setSelectedOffer(null);
    setScanHint(null);
    setVenueMismatchHint(null);
    setCardToken(null);
    setCardInfo(null);
    setVoucherInfo(null);
    setLoyaltyStatus(null);
    setLoyaltyFeedback(null);
    setOfferStatuses({ standard: {}, tier: {} });
    setRedeemSuccess(false);
    lastScan.current = "";
    setScanning(true);
  }

  function getStaffFailureMessage(errorMessage: string) {
    if (errorMessage.includes("already used this offer") || errorMessage.includes("already used this bronze") || errorMessage.includes("already used this silver") || errorMessage.includes("already used this gold")) {
      return {
        title: "Already Used",
        body: selectedStatus?.next_available_text
          ? `${errorMessage} ${selectedStatus.next_available_text}`
          : errorMessage,
      };
    }
    if (errorMessage.includes("required tier")) {
      return {
        title: "Tier Not Reached",
        body: "This member hasn’t unlocked this tier yet.",
      };
    }
    return {
      title: "Redemption Failed",
      body: errorMessage || "Could not redeem offer. Please try again.",
    };
  }

  const selectedTier = (selectedOffer as any)?._tier as string | undefined;
  const selectedStatus = selectedTier
    ? offerStatuses.tier[selectedTier]
    : selectedOffer
      ? offerStatuses.standard[selectedOffer.id]
      : undefined;
  const selectedRule = selectedOffer ? formatOfferRule(selectedOffer.limit_count, selectedOffer.limit_period) : null;
  const remainingAfterRedeem = selectedStatus && selectedOffer
    ? Math.max(0, selectedStatus.remaining_count - 1)
    : null;
  const nextResetSummary = selectedOffer
    ? remainingAfterRedeem === 0
      ? selectedOffer.limit_period === "ever"
        ? "This reward is now fully used for this member."
        : `This reward will be available again next ${selectedOffer.limit_period}.`
      : remainingAfterRedeem !== null
        ? `${remainingAfterRedeem} redemption${remainingAfterRedeem === 1 ? "" : "s"} left in this ${selectedOffer.limit_period}.`
        : null
    : null;

  if (!permission) return <View style={{ flex: 1, backgroundColor: "#F5F5F7" }} />;

  if (!businessReady) {
    return <BusinessSetupGate user={user} title="Scanning unavailable" />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F5F7", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <View style={{ backgroundColor: "rgba(15,0,50,0.05)", borderRadius: 50, width: 80, height: 80, alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
          <Ionicons name="camera-outline" size={36} color="#0F0032" />
        </View>
        <Text style={{ color: "#0F0032", fontSize: 20, fontWeight: "800", marginBottom: 10, textAlign: "center" }}>Camera Access Required</Text>
        <Text style={{ color: "rgba(15,0,50,0.5)", fontSize: 14, textAlign: "center", marginBottom: 32, lineHeight: 20 }}>
          Camera permission is needed to scan HU NOW member cards.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: "#FBC900", borderRadius: 16, paddingHorizontal: 32, paddingVertical: 14 }}
          onPress={requestPermission}
        >
          <Text style={{ color: "#0F0032", fontWeight: "800", fontSize: 15 }}>Grant Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F5F7" }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 }}>
        <Text style={{ color: "#0F0032", fontSize: 24, fontWeight: "800", marginBottom: 4 }}>Scan Card</Text>
        <Text style={{ color: "rgba(15,0,50,0.4)", fontSize: 14 }}>Point camera at a customer's HU NOW QR code</Text>
      </View>

      {!wpPostId && (
        <View style={{ marginHorizontal: 20, backgroundColor: "rgba(251,201,0,0.15)", borderWidth: 1, borderColor: "rgba(251,201,0,0.4)", borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <Text style={{ color: "#0F0032", fontSize: 13, fontWeight: "700", marginBottom: 2 }}>Venue not linked</Text>
          <Text style={{ color: "rgba(15,0,50,0.6)", fontSize: 12 }}>Set your WordPress Post ID in Profile to load your offers.</Text>
        </View>
      )}

      {/* Camera viewfinder */}
      <View style={{
        marginHorizontal: 20, borderRadius: 24, overflow: "hidden", flex: 1, maxHeight: 280, marginBottom: 20,
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16,
      }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          onBarcodeScanned={scanning ? handleScan : undefined}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        />
        {/* Corner guides */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 200, height: 200, borderWidth: 2, borderColor: "#FBC900", borderRadius: 24, opacity: 0.8 }} />
          <View style={{ position: "absolute", top: "50%", left: "50%", marginTop: -100, marginLeft: -100, width: 28, height: 28, borderTopWidth: 4, borderLeftWidth: 4, borderColor: "#FBC900", borderTopLeftRadius: 20 }} />
          <View style={{ position: "absolute", top: "50%", right: "50%", marginTop: -100, marginRight: -100, width: 28, height: 28, borderTopWidth: 4, borderRightWidth: 4, borderColor: "#FBC900", borderTopRightRadius: 20 }} />
          <View style={{ position: "absolute", bottom: "50%", left: "50%", marginBottom: -100, marginLeft: -100, width: 28, height: 28, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: "#FBC900", borderBottomLeftRadius: 20 }} />
          <View style={{ position: "absolute", bottom: "50%", right: "50%", marginBottom: -100, marginRight: -100, width: 28, height: 28, borderBottomWidth: 4, borderRightWidth: 4, borderColor: "#FBC900", borderBottomRightRadius: 20 }} />
        </View>
      </View>

      {/* Start/Stop button */}
      <View style={{ paddingHorizontal: 20 }}>
        <TouchableOpacity
          style={{
            borderRadius: 16, paddingVertical: 16, alignItems: "center", flexDirection: "row",
            justifyContent: "center", gap: 8,
            backgroundColor: scanning ? "#0F0032" : "#FBC900",
          }}
          onPress={() => setScanning((s) => !s)}
        >
          <Ionicons name={scanning ? "stop-circle-outline" : "qr-code-outline"} size={20} color={scanning ? "#FBC900" : "#0F0032"} />
          <Text style={{ fontWeight: "800", fontSize: 16, color: scanning ? "#FBC900" : "#0F0032" }}>
            {scanning ? "Stop Scanning" : "Start Scanning"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Offer Selection / Redemption Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: "white", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: "82%" }}>

            {redeemSuccess ? (
              /* ── Success ── */
              <View style={{ alignItems: "center", paddingVertical: 16 }}>
                <ConfettiCannon visible={redeemSuccess} />
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(34,197,94,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Ionicons name="checkmark-circle" size={52} color="#22C55E" />
                </View>
                <Text style={{ color: "#0F0032", fontSize: 26, fontWeight: "900", marginBottom: 6 }}>Redeemed!</Text>
                    <Text style={{ color: "#0F0032", fontWeight: "700", fontSize: 15, textAlign: "center", marginBottom: 4 }}>
                  {voucherInfo ? voucherInfo.title : selectedOffer ? decodeHtml(selectedOffer.title) : ""}
                </Text>
                <Text style={{ color: "rgba(15,0,50,0.45)", fontSize: 13, textAlign: "center", marginBottom: 20 }}>
                  {voucherInfo ? `at ${voucherInfo.venue_name ?? "venue"}` : `for ${cardInfo?.name ?? "member"}`}
                </Text>
                {selectedRule && (
                  <View style={{ backgroundColor: "rgba(15,0,50,0.05)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, width: "100%" }}>
                    <Text style={{ color: "#0F0032", fontSize: 12, fontWeight: "800", marginBottom: 3 }}>Redemption Rule</Text>
                    <Text style={{ color: "rgba(15,0,50,0.58)", fontSize: 12 }}>
                      {selectedRule}
                    </Text>
                    {nextResetSummary ? (
                      <Text style={{ color: "rgba(15,0,50,0.58)", fontSize: 12, marginTop: 4 }}>
                        {nextResetSummary}
                      </Text>
                    ) : null}
                  </View>
                )}
                {!voucherInfo ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(251,201,0,0.12)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 28 }}>
                    <Ionicons name="star" size={14} color="#FBC900" />
                    <Text style={{ color: "#0F0032", fontWeight: "800", fontSize: 14 }}>{pointsAwarded} points awarded</Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: "rgba(15,0,50,0.05)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 28, width: "100%" }}>
                    <Text style={{ color: "#0F0032", fontSize: 12, fontWeight: "800", marginBottom: 3 }}>Voucher Updated</Text>
                    <Text style={{ color: "rgba(15,0,50,0.58)", fontSize: 12 }}>
                      This voucher is now marked as redeemed and can no longer be used.
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={{ width: "100%", backgroundColor: "rgba(15,0,50,0.06)", borderRadius: 16, paddingVertical: 15, alignItems: "center", marginBottom: 10 }}
                  onPress={() => {
                    resetScan();
                    setTimeout(() => router.push("/(business)" as any), 0);
                  }}
                >
                  <Text style={{ color: "#0F0032", fontSize: 15, fontWeight: "800" }}>View Updated Dashboard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ width: "100%", backgroundColor: "#0F0032", borderRadius: 16, paddingVertical: 16, alignItems: "center" }}
                  onPress={resetScan}
                >
                  <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : voucherInfo ? (
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
                  <View style={{ backgroundColor: "#FBC900", borderRadius: 24, width: 48, height: 48, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                    <Ionicons name="ticket-outline" size={22} color="#0F0032" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "rgba(15,0,50,0.4)", fontSize: 11, marginBottom: 2 }}>Voucher Scanned</Text>
                    <Text style={{ color: "#0F0032", fontWeight: "800", fontSize: 17 }}>{voucherInfo.title}</Text>
                    <Text style={{ color: "rgba(15,0,50,0.45)", fontSize: 12, marginTop: 3 }}>{voucherInfo.venue_name}</Text>
                  </View>
                </View>

                <View style={{ backgroundColor: "#F5F5F7", borderRadius: 16, padding: 16, marginBottom: 18 }}>
                  {voucherInfo.description ? (
                    <Text style={{ color: "#0F0032", fontSize: 14, lineHeight: 20, marginBottom: 10 }}>{voucherInfo.description}</Text>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    <View style={{ backgroundColor: "rgba(15,0,50,0.06)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ color: "rgba(15,0,50,0.74)", fontSize: 11, fontWeight: "800", textTransform: "uppercase" }}>{voucherInfo.status}</Text>
                    </View>
                    {voucherInfo.expires_at ? (
                      <View style={{ backgroundColor: "rgba(15,0,50,0.06)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <Text style={{ color: "rgba(15,0,50,0.74)", fontSize: 11, fontWeight: "800" }}>Expires {new Date(voucherInfo.expires_at).toLocaleDateString("en-GB")}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: "#F5F5F7", borderRadius: 14, paddingVertical: 15, alignItems: "center" }}
                    onPress={resetScan}
                  >
                    <Text style={{ color: "rgba(15,0,50,0.55)", fontWeight: "700" }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: "center", backgroundColor: voucherInfo.status === "active" ? "#FBC900" : "rgba(251,201,0,0.3)" }}
                    onPress={handleRedeemVoucher}
                    disabled={voucherInfo.status !== "active" || redeeming}
                  >
                    {redeeming
                      ? <ActivityIndicator color="#0F0032" />
                      : <Text style={{ fontWeight: "800", color: voucherInfo.status === "active" ? "#0F0032" : "rgba(15,0,50,0.35)" }}>Redeem Voucher</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* ── Offer Selection ── */
              <>
                {/* Member info */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
                  <View style={{ backgroundColor: "#FBC900", borderRadius: 24, width: 48, height: 48, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                    <Ionicons name="person" size={22} color="#0F0032" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "rgba(15,0,50,0.4)", fontSize: 11, marginBottom: 2 }}>Card Scanned</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Text style={{ color: "#0F0032", fontWeight: "800", fontSize: 17 }}>{cardInfo?.name}</Text>
                      <View style={{ backgroundColor: "rgba(34,197,94,0.1)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(34,197,94,0.35)" }}>
                        <Text style={{ color: "#16A34A", fontSize: 10, fontWeight: "700" }}>VALID MEMBER</Text>
                      </View>
                    </View>
                    {cardInfo?.points !== undefined && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <Ionicons name="star" size={11} color="#FBC900" />
                        <Text style={{ color: "rgba(15,0,50,0.45)", fontSize: 12 }}>{cardInfo.points} pts</Text>
                        {cardInfo.tier && cardInfo.tier !== "standard" && (
                          <View style={{ backgroundColor: cardInfo.tier === "gold" ? "rgba(251,201,0,0.15)" : cardInfo.tier === "silver" ? "rgba(192,192,192,0.15)" : "rgba(205,127,50,0.15)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 10, fontWeight: "700", color: cardInfo.tier === "gold" ? "#FBC900" : cardInfo.tier === "silver" ? "#C0C0C0" : "#CD7F32", textTransform: "uppercase" }}>
                              {cardInfo.tier}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>

                <Text style={{ color: "rgba(15,0,50,0.4)", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                  Redeem a reward
                </Text>
                <Text style={{ color: "rgba(15,0,50,0.54)", fontSize: 13, lineHeight: 18, marginBottom: 10 }}>
                  Loyalty stamps and offer redemptions are separate actions. Add a stamp for any qualifying purchase, or select a reward to redeem below.
                </Text>
                {scanHint ? (
                  <View style={{ backgroundColor: "rgba(251,201,0,0.12)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: "rgba(251,201,0,0.25)" }}>
                    <Text style={{ color: "#0F0032", fontSize: 12, fontWeight: "800" }}>{scanHint}</Text>
                    <Text style={{ color: "rgba(15,0,50,0.5)", fontSize: 11, marginTop: 2 }}>
                      Staff can still change the selected reward before redeeming.
                    </Text>
                  </View>
                ) : null}
                {venueMismatchHint ? (
                  <View style={{ backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: "rgba(245,158,11,0.28)" }}>
                    <Text style={{ color: "#0F0032", fontSize: 12, fontWeight: "800" }}>
                      This QR was opened for a different venue.
                    </Text>
                    <Text style={{ color: "rgba(15,0,50,0.56)", fontSize: 11, marginTop: 3, lineHeight: 16 }}>
                      {venueMismatchHint.offerTitle
                        ? `The member opened "${decodeHtml(venueMismatchHint.offerTitle)}", but you’re scanning at ${user?.venue_name ?? "your venue"}. Showing this venue’s valid rewards instead.`
                        : `You’re scanning at ${user?.venue_name ?? "your venue"}, so we’re showing this venue’s valid rewards instead.`}
                    </Text>
                  </View>
                ) : null}
                {loyaltyStatus?.enabled ? (
                  <View style={{ backgroundColor: "rgba(15,0,50,0.04)", borderRadius: 18, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "rgba(15,0,50,0.06)" }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: "rgba(15,0,50,0.42)", fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 }}>
                          Loyalty Card
                        </Text>
                        <Text style={{ color: "#0F0032", fontSize: 16, fontWeight: "900" }}>{loyaltyStatus.card_title}</Text>
                        <Text style={{ color: "rgba(15,0,50,0.54)", fontSize: 12, marginTop: 3 }}>
                          {loyaltyStatus.stamp_count}/{loyaltyStatus.target} {loyaltyStatus.stamp_label.toLowerCase()}{loyaltyStatus.stamp_count === 1 ? "" : "s"}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: "rgba(251,201,0,0.14)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <Text style={{ color: "#0F0032", fontSize: 11, fontWeight: "900" }}>{loyaltyStatus.stamps_remaining} left</Text>
                      </View>
                    </View>

                    <View style={{ height: 8, borderRadius: 999, backgroundColor: "rgba(15,0,50,0.08)", overflow: "hidden", marginBottom: 10 }}>
                      <View style={{ width: `${Math.max((loyaltyStatus.stamp_count / loyaltyStatus.target) * 100, loyaltyStatus.stamp_count > 0 ? 6 : 0)}%`, height: "100%", backgroundColor: "#FBC900", borderRadius: 999 }} />
                    </View>

                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                      <View style={{ backgroundColor: "rgba(251,201,0,0.14)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <Text style={{ color: "#0F0032", fontSize: 11, fontWeight: "800" }}>5 stamps = +{loyaltyStatus.points_milestone.points} pts</Text>
                      </View>
                      <View style={{ backgroundColor: "rgba(34,197,94,0.10)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <Text style={{ color: "#166534", fontSize: 11, fontWeight: "800" }}>10 stamps = {loyaltyStatus.reward_title}</Text>
                      </View>
                    </View>

                    {loyaltyFeedback ? (
                      <View style={{ backgroundColor: loyaltyFeedback.tone === "success" ? "rgba(34,197,94,0.10)" : "rgba(245,158,11,0.12)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: loyaltyFeedback.tone === "success" ? "rgba(34,197,94,0.18)" : "rgba(245,158,11,0.22)", marginBottom: 12 }}>
                        <Text style={{ color: loyaltyFeedback.tone === "success" ? "#15803D" : "#B45309", fontSize: 12, fontWeight: "900", marginBottom: 3 }}>
                          {loyaltyFeedback.title}
                        </Text>
                        <Text style={{ color: "rgba(15,0,50,0.62)", fontSize: 12, lineHeight: 18 }}>
                          {loyaltyFeedback.body}
                        </Text>
                      </View>
                    ) : null}

                    <TouchableOpacity
                      style={{ borderRadius: 14, paddingVertical: 14, alignItems: "center", backgroundColor: "#0F0032" }}
                      onPress={handleAddLoyaltyStamp}
                      disabled={stampingLoyalty}
                    >
                      {stampingLoyalty
                        ? <ActivityIndicator color="#FBC900" />
                        : (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Ionicons name="add-circle-outline" size={18} color="#FBC900" />
                            <Text style={{ fontWeight: "800", color: "#FBC900" }}>Add Loyalty Stamp</Text>
                          </View>
                        )}
                    </TouchableOpacity>
                  </View>
                ) : null}

                {selectedOffer ? (
                  <View style={{ backgroundColor: "rgba(251,201,0,0.1)", borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "rgba(251,201,0,0.22)" }}>
                    <Text style={{ color: "rgba(15,0,50,0.42)", fontSize: 11, fontWeight: "800", letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 4 }}>
                      Ready to Redeem
                    </Text>
                    <Text style={{ color: "#0F0032", fontSize: 15, fontWeight: "900", marginBottom: 2 }}>
                      {selectedOffer.title}
                    </Text>
                    {selectedOffer.description ? (
                      <Text style={{ color: "rgba(15,0,50,0.56)", fontSize: 12, lineHeight: 18 }} numberOfLines={2}>
                        {decodeHtml(selectedOffer.description)}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                <ScrollView style={{ marginBottom: 16 }} showsVerticalScrollIndicator={false}>
                  {offersLoading && <ActivityIndicator color="#0F0032" style={{ marginVertical: 16 }} />}
                  {!offersLoading && offers.length === 0 && (
                    <View style={{ alignItems: "center", paddingVertical: 24 }}>
                      <Text style={{ color: "rgba(15,0,50,0.3)", fontSize: 14 }}>No offers available for your venue.</Text>
                      <Text style={{ color: "rgba(15,0,50,0.2)", fontSize: 12, marginTop: 4 }}>Set your WP Post ID in Profile settings.</Text>
                    </View>
                  )}
                  {offers.map((offer) => (
                    (() => {
                      const status = offerStatuses.standard[offer.id];
                      const unavailable = status ? !status.available : false;
                      return (
                        <TouchableOpacity
                          key={offer.id}
                          disabled={unavailable}
                          style={{
                            borderRadius: 14, padding: 14, marginBottom: 8,
                            backgroundColor: selectedOffer?.id === offer.id ? "rgba(251,201,0,0.08)" : "#F5F5F7",
                            borderWidth: 1.5,
                            borderColor: selectedOffer?.id === offer.id ? "#FBC900" : unavailable ? "rgba(15,0,50,0.08)" : "transparent",
                            opacity: unavailable ? 0.6 : 1,
                          }}
                          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedOffer(offer); }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: "#0F0032", fontWeight: "700", fontSize: 14 }}>
                                {decodeHtml(offer.title)}
                              </Text>
                              {offer.description ? (
                                <Text style={{ color: "rgba(15,0,50,0.45)", fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                                  {decodeHtml(offer.description)}
                                </Text>
                              ) : null}
                              <Text style={{ color: "rgba(15,0,50,0.38)", fontSize: 11, marginTop: 5 }}>
                                {formatOfferRule(offer.limit_count, offer.limit_period)}
                              </Text>
                              {status ? (
                                <Text style={{ color: unavailable ? "#B45309" : "rgba(15,0,50,0.45)", fontSize: 11, marginTop: 4, fontWeight: "700" }}>
                                  {status.status_label}{status.next_available_text ? ` • ${status.next_available_text}` : ""}
                                </Text>
                              ) : null}
                            </View>
                            {selectedOffer?.id === offer.id ? (
                              <Ionicons name="checkmark-circle" size={22} color="#0F0032" style={{ marginLeft: 10 }} />
                            ) : unavailable ? (
                              <Ionicons name="lock-closed" size={18} color="#B45309" style={{ marginLeft: 10 }} />
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })()
                  ))}
                </ScrollView>

                {/* Tier offers section */}
                {wpPostId && cardInfo && (() => {
                  const TIER_MIN: Record<string, number> = { bronze: 200, silver: 600, gold: 1400 };
                  const TIER_COLOUR: Record<string, string> = { bronze: "#CD7F32", silver: "#C0C0C0", gold: "#FBC900" };
                  const memberPoints = cardInfo.points;
                  const qualifyingTierOffers = tierOffers.filter(to => memberPoints >= (TIER_MIN[to.tier] ?? 99999));
                  if (qualifyingTierOffers.length === 0) return null;
                  return (
                    <View style={{ marginBottom: 12 }}>
                      <Text style={{ color: "rgba(15,0,50,0.4)", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                        Tier Offers Available
                      </Text>
                      {qualifyingTierOffers.map((to) => {
                        const colour = TIER_COLOUR[to.tier] ?? "#FBC900";
                        const isSelected = selectedOffer?.id === -1 && (selectedOffer as any)._tier === to.tier;
                        const status = offerStatuses.tier[to.tier];
                        const unavailable = status ? !status.available : false;
                        return (
                          <TouchableOpacity
                            key={to.tier}
                            disabled={unavailable}
                            style={{
                              borderRadius: 14, padding: 14, marginBottom: 8,
                              backgroundColor: isSelected ? "rgba(251,201,0,0.08)" : "#F5F5F7",
                              borderWidth: 1.5,
                              borderColor: isSelected ? colour : unavailable ? colour + "55" : "transparent",
                              opacity: unavailable ? 0.6 : 1,
                            }}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setSelectedOffer({ id: -1, title: to.title, description: to.description, _tier: to.tier, limit_count: to.limit_count, limit_period: to.limit_period } as any);
                            }}
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                              <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                  <Ionicons name={TIER_META[to.tier].icon} size={13} color={colour} />
                                  <View style={{ backgroundColor: colour + "22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                                    <Text style={{ color: colour, fontSize: 10, fontWeight: "800" }}>{to.tier.toUpperCase()} OFFER</Text>
                                  </View>
                                </View>
                                <Text style={{ color: "#0F0032", fontWeight: "700", fontSize: 14 }}>{to.title}</Text>
                                {to.description ? (
                                  <Text style={{ color: "rgba(15,0,50,0.45)", fontSize: 12, marginTop: 2 }} numberOfLines={1}>{to.description}</Text>
                                ) : null}
                                <Text style={{ color: "rgba(15,0,50,0.38)", fontSize: 11, marginTop: 5 }}>
                                  {formatOfferRule(to.limit_count, to.limit_period)}
                                </Text>
                                {status ? (
                                  <Text style={{ color: unavailable ? "#B45309" : "rgba(15,0,50,0.45)", fontSize: 11, marginTop: 4, fontWeight: "700" }}>
                                    {status.status_label}{status.next_available_text ? ` • ${status.next_available_text}` : ""}
                                  </Text>
                                ) : null}
                              </View>
                              {isSelected ? <Ionicons name="checkmark-circle" size={22} color="#0F0032" style={{ marginLeft: 10 }} /> : unavailable ? <Ionicons name="lock-closed" size={18} color="#B45309" style={{ marginLeft: 10 }} /> : null}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })()}

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: "#F5F5F7", borderRadius: 14, paddingVertical: 15, alignItems: "center" }}
                    onPress={resetScan}
                  >
                    <Text style={{ color: "rgba(15,0,50,0.55)", fontWeight: "700" }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, borderRadius: 14, paddingVertical: 15, alignItems: "center", backgroundColor: selectedOffer ? "#FBC900" : "rgba(251,201,0,0.3)" }}
                    onPress={handleRedeem}
                    disabled={!selectedOffer || redeeming}
                  >
                    {redeeming
                      ? <ActivityIndicator color="#0F0032" />
                      : <Text style={{ fontWeight: "800", color: selectedOffer ? "#0F0032" : "rgba(15,0,50,0.35)" }}>{selectedOffer ? "Redeem Reward" : "Select a Reward"}</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}

          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
