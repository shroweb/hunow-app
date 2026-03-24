import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/supabase";

type Offer = Database["public"]["Tables"]["offers"]["Row"];

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [cardInfo, setCardInfo] = useState<{ cardId: string; userName: string } | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [apiUrl] = useState(process.env.EXPO_PUBLIC_API_URL ?? "");
  const lastScan = useRef<string>("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: biz } = await supabase.from("businesses").select("id").eq("user_id", user.id).single();
      if (!biz) return;
      setBusinessId(biz.id);
      const { data } = await supabase.from("offers").select("*").eq("business_id", biz.id).eq("is_active", true);
      setOffers(data ?? []);
    }
    load();
  }, []);

  async function handleScan({ data }: { data: string }) {
    if (data === lastScan.current || !businessId) return;
    lastScan.current = data;
    setScanning(false);

    // Look up the card
    const { data: card, error } = await supabase
      .from("cards")
      .select("id, user_id, profiles!inner(name)")
      .eq("qr_token", data)
      .single();

    if (error || !card) {
      Alert.alert("Invalid Card", "This QR code is not a valid HU NOW card.");
      setScanning(true);
      lastScan.current = "";
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
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${apiUrl}/redeem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          card_id: cardInfo.cardId,
          offer_id: selectedOffer.id,
          business_id: businessId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        Alert.alert("Redemption Failed", result.message ?? "Could not redeem offer.");
      } else {
        Alert.alert("Success!", `Offer redeemed for ${cardInfo.userName}.`);
        setModalVisible(false);
        setSelectedOffer(null);
        setScannedToken(null);
        setCardInfo(null);
        lastScan.current = "";
        setScanning(true);
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

  if (!permission) return <View className="flex-1 bg-brand-navy" />;

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-brand-navy items-center justify-center px-8">
        <Text className="text-white text-lg font-bold mb-3 text-center">Camera Access Required</Text>
        <Text className="text-white/50 text-sm text-center mb-6">Camera permission is needed to scan HU NOW member cards.</Text>
        <TouchableOpacity className="bg-brand-yellow rounded-xl px-6 py-4" onPress={requestPermission}>
          <Text className="text-brand-navy font-bold">Grant Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-navy">
      <View className="px-5 pt-4 pb-2">
        <Text className="text-white text-2xl font-bold mb-1">Scan Card</Text>
        <Text className="text-white/50 text-sm mb-4">Point camera at a customer's HU NOW card QR code</Text>
      </View>

      {/* Camera */}
      <View className="mx-5 rounded-3xl overflow-hidden flex-1 max-h-80 mb-5">
        <CameraView
          className="flex-1"
          facing="back"
          onBarcodeScanned={scanning ? handleScan : undefined}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        />
        {/* Overlay guides */}
        <View className="absolute inset-0 items-center justify-center">
          <View className="w-48 h-48 border-2 border-brand-yellow rounded-2xl opacity-70" />
        </View>
      </View>

      <View className="px-5">
        <TouchableOpacity
          className={`rounded-xl py-4 items-center ${scanning ? "bg-red-500/20 border border-red-500/40" : "bg-brand-yellow"}`}
          onPress={() => setScanning((s) => !s)}
        >
          <Text className={`font-bold ${scanning ? "text-red-400" : "text-brand-navy"}`}>
            {scanning ? "Stop Scanning" : "Start Scanning"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Offer Selection Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-[#1a0a4a] rounded-t-3xl p-6 max-h-[75%]">
            <Text className="text-white font-bold text-lg mb-1">Card Scanned</Text>
            <Text className="text-brand-yellow text-sm mb-5">{cardInfo?.userName}</Text>

            <Text className="text-white/60 text-xs mb-3">Select an offer to redeem:</Text>
            <ScrollView className="mb-4" showsVerticalScrollIndicator={false}>
              {offers.length === 0 && (
                <Text className="text-white/40 text-sm">No active offers available.</Text>
              )}
              {offers.map((offer) => (
                <TouchableOpacity
                  key={offer.id}
                  className={`rounded-2xl p-4 mb-2 border ${selectedOffer?.id === offer.id ? "bg-brand-yellow/20 border-brand-yellow" : "bg-white/10 border-white/20"}`}
                  onPress={() => setSelectedOffer(offer)}
                >
                  <Text className={`font-semibold ${selectedOffer?.id === offer.id ? "text-brand-yellow" : "text-white"}`}>
                    {offer.title}
                  </Text>
                  {offer.description && (
                    <Text className="text-white/50 text-xs mt-1" numberOfLines={1}>{offer.description}</Text>
                  )}
                  <Text className="text-white/30 text-xs mt-1">{offer.redemption_type.replace(/_/g, " ")}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View className="flex-row gap-3">
              <TouchableOpacity className="flex-1 bg-white/10 rounded-xl py-4 items-center" onPress={resetScan}>
                <Text className="text-white/70 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 rounded-xl py-4 items-center ${selectedOffer ? "bg-brand-yellow" : "bg-brand-yellow/30"}`}
                onPress={handleRedeem}
                disabled={!selectedOffer || redeeming}
              >
                {redeeming ? <ActivityIndicator color="#0F0032" /> : <Text className="text-brand-navy font-bold">Redeem</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
