import { View, Text, ScrollView, Share, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

function memberNumber(token: string): string {
  return "HUNOW-" + token.replace(/-/g, "").slice(0, 6).toUpperCase();
}

function memberSince(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export default function MyCardScreen() {
  const { user } = useAuth();
  if (!user) return null;

  async function handleShare() {
    await Share.share({ message: `My HU NOW member card: ${memberNumber(user!.card_token)}` });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>

        <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 4, marginBottom: 4 }}>My Card</Text>
        <Text style={{ color: "white", fontSize: 26, fontWeight: "900", marginBottom: 20, letterSpacing: -0.5 }}>
          {user.display_name}
        </Text>

        {/* The Card */}
        <View style={{
          borderRadius: 24, overflow: "hidden",
          shadowColor: YELLOW, shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25, shadowRadius: 24, elevation: 12, marginBottom: 16,
        }}>
          {/* Yellow Header */}
          <View style={{ backgroundColor: YELLOW, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <View>
                <Text style={{ color: "rgba(15,0,50,0.5)", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
                  Member Number
                </Text>
                <Text style={{ color: NAV, fontSize: 18, fontWeight: "800", letterSpacing: 1 }}>
                  {memberNumber(user.card_token)}
                </Text>
              </View>
              <View style={{ backgroundColor: NAV, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginTop: 2 }}>
                <Text style={{ color: YELLOW, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }}>MEMBER</Text>
              </View>
            </View>
            <Text style={{ color: "rgba(15,0,50,0.5)", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 3 }}>
              Member Since
            </Text>
            <Text style={{ color: NAV, fontWeight: "600", fontSize: 13 }}>
              {user.card_created ? memberSince(user.card_created) : "—"}
            </Text>
          </View>

          {/* White QR Section */}
          <View style={{ backgroundColor: "white", alignItems: "center", paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 }}>
            <QRCode value={user.card_token} size={200} color={NAV} backgroundColor="white" />
            <Text style={{ color: "rgba(15,0,50,0.35)", fontSize: 11, marginTop: 16, letterSpacing: 0.5 }}>
              Scan to verify membership
            </Text>
          </View>

          {/* Points strip */}
          <View style={{ backgroundColor: "rgba(15,0,50,0.04)", paddingHorizontal: 24, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: "rgba(15,0,50,0.45)", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>
              HU NOW Points
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Ionicons name="star" size={14} color={YELLOW} />
              <Text style={{ color: NAV, fontWeight: "800", fontSize: 15 }}>{user.points}</Text>
            </View>
          </View>

          {/* Navy Footer */}
          <View style={{ backgroundColor: NAV, paddingHorizontal: 24, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ color: "white", fontSize: 15, fontWeight: "700" }}>{user.display_name}</Text>
              <Text style={{ color: YELLOW, fontSize: 11, marginTop: 2 }}>hunow.co.uk</Text>
            </View>
            <Text style={{ color: "white", fontSize: 22, fontWeight: "900", letterSpacing: -0.5 }}>
              HU <Text style={{ color: YELLOW }}>NOW</Text>
            </Text>
          </View>
        </View>

        {/* Share */}
        <TouchableOpacity
          onPress={handleShare}
          style={{
            backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 18,
            paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center",
            marginBottom: 28, gap: 8,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
          }}
        >
          <Ionicons name="share-outline" size={18} color="white" />
          <Text style={{ color: "white", fontWeight: "700" }}>Share My Card</Text>
        </TouchableOpacity>

        {/* Redemptions */}
        <Text style={{ color: "white", fontWeight: "800", fontSize: 17, marginBottom: 12 }}>Recent Redemptions</Text>
        {user.redemptions.length === 0 ? (
          <View style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, textAlign: "center" }}>
              No offers redeemed yet.{"\n"}Visit a venue to get started!
            </Text>
          </View>
        ) : (
          user.redemptions.map((r, i) => (
            <View key={i} style={{
              backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 16, padding: 14,
              marginBottom: 10, flexDirection: "row", alignItems: "center",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
            }}>
              <View style={{ backgroundColor: YELLOW + "33", borderRadius: 12, width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="ticket-outline" size={18} color={YELLOW} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "white", fontWeight: "600", fontSize: 13 }}>{r.offer_title}</Text>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{r.venue_name}</Text>
              </View>
              <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                {new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </Text>
            </View>
          ))
        )}
        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
