import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { wordpress, extractOffers, formatOfferRule, type WPOffer, type WPTierOffer } from "@/lib/wordpress";
import { lookupCard, wpRedeem, type OfferStatus } from "@/lib/wpAuth";
import { decodeHtml } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { ConfettiCannon } from "@/components/ConfettiCannon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BusinessSetupGate } from "@/components/BusinessSetupGate";

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
  const [redeeming, setRedeeming] = useState(false);
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

    try {
      const member = await lookupCard(data, token, wpPostId);
      setCardToken(data);
      setCardInfo({ name: member.name, points: member.points, tier: member.tier ?? "standard" });
      setOfferStatuses({
        standard: Object.fromEntries((member.offer_statuses?.standard ?? []).map((s) => [s.offer_index ?? 0, s])),
        tier: Object.fromEntries((member.offer_statuses?.tier ?? []).map((s) => [s.tier ?? "", s])),
      });
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

  function resetScan() {
    setModalVisible(false);
    setSelectedOffer(null);
    setCardToken(null);
    setCardInfo(null);
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
                  {selectedOffer ? decodeHtml(selectedOffer.title) : ""}
                </Text>
                <Text style={{ color: "rgba(15,0,50,0.45)", fontSize: 13, textAlign: "center", marginBottom: 20 }}>
                  for {cardInfo?.name ?? "member"}
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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(251,201,0,0.12)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 28 }}>
                  <Ionicons name="star" size={14} color="#FBC900" />
                  <Text style={{ color: "#0F0032", fontWeight: "800", fontSize: 14 }}>{pointsAwarded} points awarded</Text>
                </View>
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

                <Text style={{ color: "rgba(15,0,50,0.4)", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
                  Select offer to redeem
                </Text>

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
                  const TIER_EMOJI: Record<string, string> = { bronze: "🥉", silver: "🥈", gold: "🥇" };
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
                                  <Text style={{ fontSize: 12 }}>{TIER_EMOJI[to.tier]}</Text>
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
                      : <Text style={{ fontWeight: "800", color: selectedOffer ? "#0F0032" : "rgba(15,0,50,0.35)" }}>Redeem</Text>
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
