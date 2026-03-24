import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

function memberNumber(token: string): string {
  return "HUNOW-" + token.replace(/-/g, "").slice(0, 6).toUpperCase();
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  if (!user) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
        <Text style={{ color: "white", fontSize: 26, fontWeight: "900", marginTop: 20, marginBottom: 20, letterSpacing: -0.5 }}>Profile</Text>

        {/* Avatar + name */}
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <View style={{
            backgroundColor: YELLOW, borderRadius: 40, width: 80, height: 80,
            alignItems: "center", justifyContent: "center", marginBottom: 12,
            shadowColor: YELLOW, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12,
          }}>
            <Text style={{ color: NAV, fontSize: 28, fontWeight: "900" }}>
              {user.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={{ color: "white", fontSize: 20, fontWeight: "800" }}>{user.display_name}</Text>
          <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginTop: 4 }}>{memberNumber(user.card_token)}</Text>
        </View>

        {/* Points */}
        <View style={{
          backgroundColor: YELLOW, borderRadius: 18, padding: 18,
          flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16,
          shadowColor: YELLOW, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12,
        }}>
          <View>
            <Text style={{ color: "rgba(15,0,50,0.55)", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>
              HU NOW Points
            </Text>
            <Text style={{ color: NAV, fontSize: 34, fontWeight: "900", marginTop: 2 }}>{user.points}</Text>
          </View>
          <View style={{ backgroundColor: "rgba(15,0,50,0.12)", borderRadius: 20, width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="star" size={22} color={NAV} />
          </View>
        </View>

        {/* Account details */}
        <View style={{
          backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18, overflow: "hidden",
          marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
        }}>
          <View style={{ paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
            <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginBottom: 3 }}>Name</Text>
            <Text style={{ color: "white", fontWeight: "600" }}>{user.display_name}</Text>
          </View>
          <View style={{ paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
            <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginBottom: 3 }}>Email</Text>
            <Text style={{ color: "white", fontWeight: "600" }}>{user.email}</Text>
          </View>
          <View style={{ paddingHorizontal: 18, paddingVertical: 14 }}>
            <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginBottom: 3 }}>Member since</Text>
            <Text style={{ color: "white", fontWeight: "600" }}>
              {user.card_created
                ? new Date(user.card_created).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
                : "—"}
            </Text>
          </View>
        </View>

        {/* Recent redemptions */}
        {user.redemptions.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "white", fontWeight: "800", fontSize: 16, marginBottom: 12 }}>Recent Redemptions</Text>
            {user.redemptions.map((r, i) => (
              <View key={i} style={{
                backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 16, padding: 14,
                marginBottom: 8, flexDirection: "row", alignItems: "center",
                borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
              }}>
                <View style={{ backgroundColor: YELLOW + "33", borderRadius: 12, width: 38, height: 38, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                  <Ionicons name="ticket-outline" size={16} color={YELLOW} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "white", fontWeight: "600", fontSize: 13 }}>{r.offer_title}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{r.venue_name}</Text>
                </View>
                <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                  {new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Sign out */}
        <TouchableOpacity
          onPress={signOut}
          style={{
            borderWidth: 1, borderColor: "rgba(255,80,80,0.3)",
            backgroundColor: "rgba(255,80,80,0.08)",
            borderRadius: 18, paddingVertical: 16, alignItems: "center", marginBottom: 32,
          }}
        >
          <Text style={{ color: "#ff6b6b", fontWeight: "700" }}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
