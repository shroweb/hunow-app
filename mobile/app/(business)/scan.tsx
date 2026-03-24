import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { wordpress, extractOffers, type WPOffer } from "@/lib/wordpress";
import { decodeHtml } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

export default function ScanScreen() {
  const { user, token } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [wpPostId, setWpPostId] = useState<number | null>(null);
  const [offers, setOffers] = useState<WPOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [cardInfo, setCardInfo] = useState<{ cardId: string; userName: string } | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<WPOffer | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [apiUrl] = useState(process.env.EXPO_PUBLIC_API_URL ?? "");
  const lastScan = useRef<string>("");

  useEffect(() => {
    async function load() {
      if (!user) { setOffersLoading(false); return; }

      // Get Supabase business record via wp_post_id stored in WP user meta
      const venueId = user.venue_id;
      setWpPostId(venueId || null);

      if (venueId) {
        // Load Supabase business ID (still needed for redemption recording)
        const { data: biz } = await supabase
          .from("businesses")
          .select("id")
          .eq("wp_post_id", venueId)
          .single();
        if (biz) setBusinessId(biz.id);

        // Load offers from WordPress ACF
        try {
          const venue = await wordpress.getEatById(venueId);
          if (venue?.acf) {
            setOffers(extractOffers(venue.acf as Record<string, unknown>));
          }
        } catch {
          // venue might be in a different CPT
        }
      }
      setOffersLoading(false);
    }
    load();
  }, [user]);

  async function handleScan({ data }: { data: string }) {
    if (data === lastScan.current || !businessId) return;
    lastScan.current = data;
    setScanning(false);

    const { data: card, error } = await supabase
      .from("cards")
      .select("id, user_id, profiles!inner(name)")
      .eq("qr_token", data)
      .single();

    if (error || !card) {
      Alert.alert("Invalid Card", "This QR code is not a valid HU NOW card.");
      lastScan.current = "";
      setScanning(true);
      return;
    }

    setScannedToken(data);
    setCardInfo({ cardId: card.id, userName: (card as any).profiles?.name ?? "Member" });
    setModalVisible(true);
  }

  async function handleRedeem() {
    if (!selectedOffer || !cardInfo || !businessId) return;
    setRedeeming(true);

    try {
      const response = await fetch(`${apiUrl}/redeem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          card_id: cardInfo.cardId,
          offer_title: selectedOffer.title,
          offer_index: selectedOffer.index,
          business_id: businessId,
          wp_post_id: wpPostId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        Alert.alert("Redemption Failed", result.message ?? "Could not redeem offer.");
      } else {
        Alert.alert(
          "Redeemed! 🎉",
          `${selectedOffer.title} redeemed for ${cardInfo.userName}.`,
          [{ text: "Done", onPress: resetScan }]
        );
      }
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    }

    setRedeeming(false);
  }

  function resetScan() {
    setModalVisible(false);
    setSelectedOffer(null);
    setScannedToken(null);
    setCardInfo(null);
    lastScan.current = "";
    setScanning(true);
  }

  if (!permission) return <View className="flex-1 bg-[#F5F5F7]" />;

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-[#F5F5F7] items-center justify-center px-8">
        <View className="bg-[#0F0032]/5 rounded-full w-20 h-20 items-center justify-center mb-6">
          <Ionicons name="camera-outline" size={36} color="#0F0032" />
        </View>
        <Text className="text-[#0F0032] text-xl font-bold mb-3 text-center">Camera Access Required</Text>
        <Text className="text-[#0F0032]/50 text-sm text-center mb-8">
          Camera permission is needed to scan HU NOW member cards.
        </Text>
        <TouchableOpacity className="bg-brand-yellow rounded-2xl px-8 py-4" onPress={requestPermission}>
          <Text className="text-[#0F0032] font-bold">Grant Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const hasNoWpId = !wpPostId;

  return (
    <SafeAreaView className="flex-1 bg-[#F5F5F7]">
      <View className="px-5 pt-6 pb-4">
        <Text className="text-[#0F0032] text-2xl font-bold mb-1">Scan Card</Text>
        <Text className="text-[#0F0032]/40 text-sm">Point camera at a customer's HU NOW QR code</Text>
      </View>

      {hasNoWpId && (
        <View className="mx-5 bg-brand-yellow/20 border border-brand-yellow/40 rounded-2xl p-4 mb-4">
          <Text className="text-[#0F0032] text-sm font-semibold mb-1">Venue not linked</Text>
          <Text className="text-[#0F0032]/60 text-xs">Set your WordPress Post ID in Profile to load your offers.</Text>
        </View>
      )}

      {/* Camera */}
      <View className="mx-5 rounded-3xl overflow-hidden flex-1 max-h-72 mb-5"
        style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16 }}
      >
        <CameraView
          className="flex-1"
          facing="back"
          onBarcodeScanned={scanning ? handleScan : undefined}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        />
        <View className="absolute inset-0 items-center justify-center">
          <View className="w-52 h-52 border-2 border-brand-yellow rounded-3xl opacity-80" />
          <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-yellow rounded-tl-3xl" />
          <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-yellow rounded-tr-3xl" />
          <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-yellow rounded-bl-3xl" />
          <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-yellow rounded-br-3xl" />
        </View>
      </View>

      <View className="px-5">
        <TouchableOpacity
          className={`rounded-2xl py-4 items-center flex-row justify-center gap-2 ${scanning ? "bg-[#0F0032]" : "bg-brand-yellow"}`}
          onPress={() => setScanning((s) => !s)}
        >
          <Ionicons name={scanning ? "stop-circle-outline" : "qr-code-outline"} size={20} color={scanning ? "#FBC900" : "#0F0032"} />
          <Text className={`font-bold ${scanning ? "text-brand-yellow" : "text-[#0F0032]"}`}>
            {scanning ? "Stop Scanning" : "Start Scanning"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Offer Selection Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 max-h-[80%]">
            {/* Member info */}
            <View className="flex-row items-center mb-5">
              <View className="bg-brand-yellow rounded-full w-12 h-12 items-center justify-center mr-3">
                <Ionicons name="person" size={22} color="#0F0032" />
              </View>
              <View>
                <Text className="text-[#0F0032]/50 text-xs">Card Scanned</Text>
                <Text className="text-[#0F0032] font-bold text-lg">{cardInfo?.userName}</Text>
              </View>
            </View>

            <Text className="text-[#0F0032]/50 text-xs font-semibold uppercase tracking-wide mb-3">
              Select offer to redeem
            </Text>

            <ScrollView className="mb-4" showsVerticalScrollIndicator={false}>
              {offersLoading && (
                <ActivityIndicator color="#0F0032" className="my-4" />
              )}
              {!offersLoading && offers.length === 0 && (
                <View className="items-center py-6">
                  <Text className="text-[#0F0032]/30 text-sm">No offers available for your venue.</Text>
                  <Text className="text-[#0F0032]/20 text-xs mt-1">Set your WP Post ID in Profile settings.</Text>
                </View>
              )}
              {offers.map((offer) => (
                <TouchableOpacity
                  key={offer.index}
                  className={`rounded-2xl p-4 mb-2 border ${selectedOffer?.index === offer.index
                    ? "bg-brand-yellow/10 border-brand-yellow"
                    : "bg-[#F5F5F7] border-transparent"
                    }`}
                  onPress={() => setSelectedOffer(offer)}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className={`font-semibold text-sm ${selectedOffer?.index === offer.index ? "text-[#0F0032]" : "text-[#0F0032]"}`}>
                        {decodeHtml(offer.title)}
                      </Text>
                      {offer.description ? (
                        <Text className="text-[#0F0032]/50 text-xs mt-0.5" numberOfLines={1}>
                          {decodeHtml(offer.description)}
                        </Text>
                      ) : null}
                    </View>
                    {selectedOffer?.index === offer.index && (
                      <Ionicons name="checkmark-circle" size={22} color="#0F0032" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-[#F5F5F7] rounded-2xl py-4 items-center"
                onPress={resetScan}
              >
                <Text className="text-[#0F0032]/60 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 rounded-2xl py-4 items-center ${selectedOffer ? "bg-brand-yellow" : "bg-brand-yellow/30"}`}
                onPress={handleRedeem}
                disabled={!selectedOffer || redeeming}
              >
                {redeeming
                  ? <ActivityIndicator color="#0F0032" />
                  : <Text className={`font-bold ${selectedOffer ? "text-[#0F0032]" : "text-[#0F0032]/40"}`}>Redeem</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
