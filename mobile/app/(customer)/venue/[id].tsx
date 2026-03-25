import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, Linking, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as Haptics from "expo-haptics";
import * as Brightness from "expo-brightness";
import Animated, {
  useSharedValue, withSpring, withSequence, withTiming, useAnimatedStyle,
} from "react-native-reanimated";
import { wordpress, getFeaturedImage, extractOffers, type WPEat, type WPOffer } from "@/lib/wordpress";
import { decodeHtml, stripHtml } from "@/lib/utils";
import { getExpiryBadgeLabel } from "@/lib/offerExpiry";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/Skeleton";

const NAV = "#0F0032";
const YELLOW = "#FBC900";
const AMBER = "#F59E0B";

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, token } = useAuth();
  const [venue, setVenue] = useState<WPEat | null>(null);
  const [offers, setOffers] = useState<WPOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavourite, setIsFavourite] = useState(false);
  const [qrModalOffer, setQrModalOffer] = useState<WPOffer | null>(null);
  const savedBrightness = useRef<number | null>(null);

  // Favourite heart animation
  const heartScale = useSharedValue(1);
  // QR modal reveal animation
  const qrRevealScale = useSharedValue(0.7);
  const qrRevealOpacity = useSharedValue(0);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const wpVenue = await wordpress.getEatById(Number(id)).catch(() => null);
      setVenue(wpVenue);
      if (wpVenue) setOffers(extractOffers(wpVenue));
      setLoading(false);
    }
    load();
  }, [id]);

  // Load real favourite state from WP
  useEffect(() => {
    if (!token || !id) return;
    wordpress.getFavourites(token).then((favs) => {
      setIsFavourite(favs.some((f: { post_id: number }) => f.post_id === Number(id)));
    }).catch(() => {});
  }, [id, token]);

  // Brightness: max on QR modal open, restore on close
  useEffect(() => {
    if (qrModalOffer) {
      Brightness.getBrightnessAsync().then((b) => {
        savedBrightness.current = b;
        Brightness.setBrightnessAsync(1.0).catch(() => {});
      }).catch(() => {});
      // Animate QR card in
      qrRevealScale.value = withSpring(1, { damping: 14, stiffness: 180 });
      qrRevealOpacity.value = withTiming(1, { duration: 300 });
    } else {
      if (savedBrightness.current !== null) {
        Brightness.setBrightnessAsync(savedBrightness.current).catch(() => {});
        savedBrightness.current = null;
      }
      qrRevealScale.value = 0.7;
      qrRevealOpacity.value = 0;
    }
  }, [qrModalOffer]);

  const heartAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const qrRevealStyle = useAnimatedStyle(() => ({
    transform: [{ scale: qrRevealScale.value }],
    opacity: qrRevealOpacity.value,
  }));

  async function handleFavouriteToggle() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    heartScale.value = withSequence(
      withSpring(1.35, { damping: 6, stiffness: 300 }),
      withSpring(1, { damping: 8, stiffness: 200 }),
    );
    const newState = !isFavourite;
    setIsFavourite(newState);
    if (!token) return;
    try {
      if (newState) {
        await wordpress.addFavourite(Number(id), token);
      } else {
        await wordpress.removeFavourite(Number(id), token);
      }
    } catch {
      setIsFavourite(!newState); // revert on failure
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: NAV }}>
        <Skeleton width="100%" height={240} borderRadius={0} />
        <View style={{ padding: 20, gap: 12 }}>
          <Skeleton width={220} height={28} borderRadius={8} />
          <Skeleton width={300} height={14} borderRadius={6} />
          <Skeleton width={260} height={14} borderRadius={6} />
        </View>
      </View>
    );
  }

  if (!venue) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: NAV, paddingHorizontal: 20 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, marginBottom: 16, flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="chevron-back" size={20} color="white" />
          <Text style={{ color: "white", fontSize: 14, marginLeft: 4 }}>Back</Text>
        </TouchableOpacity>
        <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, textAlign: "center", marginTop: 80 }}>Venue not found</Text>
      </SafeAreaView>
    );
  }

  const img = getFeaturedImage(venue);
  const ctaUrl = venue.acf?.offer_cta_url as string | undefined;
  const ctaText = venue.acf?.offer_cta_text as string | undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Hero Image */}
        <View style={{ position: "relative" }}>
          {img ? (
            <Image source={{ uri: img }} style={{ width: "100%", height: 240 }} resizeMode="cover" />
          ) : (
            <View style={{ width: "100%", height: 240, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="storefront-outline" size={56} color="rgba(255,255,255,0.12)" />
            </View>
          )}

          {/* Back button */}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
            style={{
              position: "absolute", top: 16, left: 16,
              backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 20,
              width: 36, height: 36, alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={20} color="white" />
          </TouchableOpacity>

          {/* Animated Favourite button */}
          <TouchableOpacity
            onPress={handleFavouriteToggle}
            style={{
              position: "absolute", top: 16, right: 16,
              backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 20,
              width: 36, height: 36, alignItems: "center", justifyContent: "center",
            }}
          >
            <Animated.View style={heartAnimStyle}>
              <Ionicons
                name={isFavourite ? "heart" : "heart-outline"}
                size={20}
                color={isFavourite ? "#FF4D6D" : "white"}
              />
            </Animated.View>
          </TouchableOpacity>

          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, backgroundColor: "rgba(15,0,50,0.5)" }} />
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <Text style={{ color: "white", fontSize: 26, fontWeight: "900", marginBottom: 6, letterSpacing: -0.5 }}>
            {decodeHtml(venue.title.rendered)}
          </Text>
          {venue.excerpt?.rendered ? (
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 20, marginBottom: 20 }}>
              {stripHtml(venue.excerpt.rendered)}
            </Text>
          ) : null}

          {/* Contact */}
          {(venue.acf?.phone || venue.acf?.website) && (
            <View style={{
              backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18, padding: 16,
              marginBottom: 16, gap: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
            }}>
              {venue.acf?.phone && (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                  onPress={() => Linking.openURL(`tel:${venue.acf!.phone}`)}
                >
                  <View style={{ backgroundColor: YELLOW + "22", borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="call-outline" size={18} color={YELLOW} />
                  </View>
                  <Text style={{ color: "white", fontSize: 14, fontWeight: "500" }}>{venue.acf.phone as string}</Text>
                </TouchableOpacity>
              )}
              {venue.acf?.website && (
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                  onPress={() => Linking.openURL(venue.acf!.website as string)}
                >
                  <View style={{ backgroundColor: YELLOW + "22", borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="globe-outline" size={18} color={YELLOW} />
                  </View>
                  <Text style={{ color: "white", fontSize: 14, fontWeight: "500" }} numberOfLines={1}>{venue.acf.website as string}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Opening Hours */}
          {venue.acf?.opening_hours && (venue.acf.opening_hours as any[]).length > 0 && (
            <View style={{
              backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18, padding: 16,
              marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
            }}>
              <Text style={{ color: "white", fontWeight: "800", fontSize: 14, marginBottom: 12 }}>Opening Hours</Text>
              {(venue.acf.opening_hours as { day: string; hours: string }[]).map((h, i) => (
                <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{h.day}</Text>
                  <Text style={{ color: "white", fontSize: 13, fontWeight: "600" }}>{h.hours}</Text>
                </View>
              ))}
            </View>
          )}

          {/* HU NOW Offers */}
          <View style={{ marginBottom: 32 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ color: "white", fontWeight: "800", fontSize: 18 }}>HU NOW Offers</Text>
              {offers.length > 0 && (
                <View style={{ backgroundColor: YELLOW + "33", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: YELLOW, fontSize: 12, fontWeight: "700" }}>{offers.length} available</Text>
                </View>
              )}
            </View>

            {offers.length === 0 ? (
              <View style={{
                backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 18, padding: 20,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <View style={{ backgroundColor: YELLOW + "22", borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="pricetag-outline" size={18} color={YELLOW} />
                  </View>
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600" }}>No active offers right now</Text>
                </View>
                {venue.excerpt?.rendered ? (
                  <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 19 }}>
                    {stripHtml(venue.excerpt.rendered)}
                  </Text>
                ) : null}
              </View>
            ) : (
              offers.map((offer) => {
                const expiryRaw = venue.acf?.offer_expiry as string | undefined;
                const expiryLabel = expiryRaw ? getExpiryBadgeLabel(expiryRaw) : null;

                return (
                  <View
                    key={offer.id}
                    style={{
                      backgroundColor: "white", borderRadius: 18, overflow: "hidden",
                      marginBottom: 12,
                      shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
                    }}
                  >
                    <View style={{ backgroundColor: YELLOW, height: 4 }} />
                    <View style={{ padding: 16 }}>
                      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: NAV, fontWeight: "800", fontSize: 15 }}>{decodeHtml(offer.title)}</Text>
                          {offer.description ? (
                            <Text style={{ color: "rgba(15,0,50,0.5)", fontSize: 13, marginTop: 4 }}>{decodeHtml(offer.description)}</Text>
                          ) : null}
                        </View>
                        <View style={{ backgroundColor: YELLOW + "33", borderRadius: 20, width: 38, height: 38, alignItems: "center", justifyContent: "center", marginLeft: 12 }}>
                          <Ionicons name="ticket-outline" size={18} color={NAV} />
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: YELLOW + "22", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                          <Ionicons name="star" size={11} color={NAV} />
                          <Text style={{ color: NAV, fontSize: 12, fontWeight: "700" }}>+35 pts</Text>
                        </View>
                        {expiryLabel && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: AMBER + "22", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                            <Ionicons name="time-outline" size={12} color={AMBER} />
                            <Text style={{ color: AMBER, fontSize: 12, fontWeight: "600" }}>{expiryLabel}</Text>
                          </View>
                        )}
                      </View>

                      {ctaText && ctaUrl && (
                        <TouchableOpacity
                          style={{ marginTop: 12, backgroundColor: NAV, borderRadius: 12, paddingVertical: 10, alignItems: "center" }}
                          onPress={() => Linking.openURL(ctaUrl)}
                        >
                          <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>{decodeHtml(ctaText)}</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={{
                          marginTop: 10, backgroundColor: YELLOW, borderRadius: 12,
                          paddingVertical: 12, alignItems: "center", flexDirection: "row",
                          justifyContent: "center", gap: 6,
                        }}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setQrModalOffer(offer);
                        }}
                      >
                        <Ionicons name="qr-code-outline" size={16} color={NAV} />
                        <Text style={{ color: NAV, fontSize: 14, fontWeight: "800" }}>Show QR to Redeem</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* QR Redemption Modal — full screen, max brightness */}
      <Modal
        visible={qrModalOffer !== null}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setQrModalOffer(null)}
      >
        <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 8 }}>
            Present to staff
          </Text>
          <Text style={{ color: "white", fontSize: 20, fontWeight: "900", textAlign: "center", marginBottom: 28, letterSpacing: -0.5 }}>
            {qrModalOffer ? decodeHtml(qrModalOffer.title) : ""}
          </Text>

          {/* Animated QR card */}
          <Animated.View style={[{
            backgroundColor: "white", borderRadius: 28, padding: 28, alignItems: "center",
            shadowColor: YELLOW, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 20,
          }, qrRevealStyle]}>
            {user?.card_token ? (
              <QRCode value={user.card_token} size={220} color={NAV} backgroundColor="transparent" />
            ) : (
              <View style={{ width: 220, height: 220, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "rgba(15,0,50,0.4)", fontSize: 13 }}>No card token</Text>
              </View>
            )}
            <Text style={{ color: "rgba(15,0,50,0.35)", fontSize: 11, marginTop: 12, letterSpacing: 1, textTransform: "uppercase" }}>
              HU NOW Member
            </Text>
          </Animated.View>

          <View style={{
            flexDirection: "row", alignItems: "center", gap: 6, marginTop: 24,
            backgroundColor: YELLOW + "22", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
          }}>
            <Ionicons name="star" size={14} color={YELLOW} />
            <Text style={{ color: YELLOW, fontSize: 14, fontWeight: "700" }}>+35 pts on redemption</Text>
          </View>

          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setQrModalOffer(null); }}
            style={{
              marginTop: 32, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 16,
              paddingHorizontal: 40, paddingVertical: 14,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
            }}
          >
            <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
