import { Modal, View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

const TIERS = [
  { name: "Standard", min: 0,    max: 499,  colour: "rgba(255,255,255,0.3)", benefit: "Access to all HU NOW offers" },
  { name: "Bronze",   min: 500,  max: 999,  colour: "#CD7F32",               benefit: "Early access to new venues" },
  { name: "Silver",   min: 1000, max: 1999, colour: "#C0C0C0",               benefit: "Exclusive member-only events" },
  { name: "Gold",     min: 2000, max: 9999, colour: YELLOW,                  benefit: "Priority booking + VIP perks" },
];

const EARN = [
  { label: "Redeem an offer",  pts: "+35 pts", icon: "pricetag-outline" as const },
  { label: "Daily check-in",   pts: "+10 pts", icon: "calendar-outline" as const },
  { label: "Join HU NOW",      pts: "+10 pts", icon: "person-add-outline" as const },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  currentPoints: number;
}

export function PointsInfoModal({ visible, onClose, currentPoints }: Props) {
  const currentTier = TIERS.slice().reverse().find((t) => currentPoints >= t.min) ?? TIERS[0];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View style={{
          backgroundColor: NAV, borderTopLeftRadius: 28, borderTopRightRadius: 28,
          paddingTop: 20, paddingBottom: 40, maxHeight: "85%",
        }}>
          {/* Handle */}
          <View style={{ width: 36, height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2, alignSelf: "center", marginBottom: 20 }} />

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, marginBottom: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ backgroundColor: YELLOW + "22", borderRadius: 12, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="star" size={20} color={YELLOW} />
              </View>
              <View>
                <Text style={{ color: "white", fontSize: 20, fontWeight: "900" }}>HU NOW Points</Text>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Earn, climb, unlock</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20 }}>

            {/* How to earn */}
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
              How to earn
            </Text>
            <View style={{ gap: 8, marginBottom: 28 }}>
              {EARN.map((e) => (
                <View key={e.label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, padding: 14 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Ionicons name={e.icon} size={18} color={YELLOW} />
                    <Text style={{ color: "white", fontSize: 14, fontWeight: "500" }}>{e.label}</Text>
                  </View>
                  <View style={{ backgroundColor: YELLOW + "22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color: YELLOW, fontSize: 12, fontWeight: "800" }}>{e.pts}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Tiers */}
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
              Member tiers
            </Text>
            <View style={{ gap: 8 }}>
              {TIERS.map((tier) => {
                const isActive = tier.name === currentTier.name;
                return (
                  <View
                    key={tier.name}
                    style={{
                      backgroundColor: isActive ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
                      borderRadius: 16, padding: 14,
                      borderWidth: isActive ? 1 : 0,
                      borderColor: isActive ? tier.colour : "transparent",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tier.colour }} />
                        <Text style={{ color: "white", fontWeight: "800", fontSize: 14 }}>
                          {tier.name}
                          {isActive && <Text style={{ color: YELLOW, fontSize: 11 }}>  ★ Your tier</Text>}
                        </Text>
                      </View>
                      <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                        {tier.min}–{tier.max === 9999 ? "∞" : tier.max} pts
                      </Text>
                    </View>
                    <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>{tier.benefit}</Text>
                  </View>
                );
              })}
            </View>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
