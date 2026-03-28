import { useEffect } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";

export default function BusinessLayout() {
  const { token, refreshUser } = useAuth();

  useEffect(() => {
    if (!token) return;
    refreshUser();
  }, [token]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0F0032",
          borderTopColor: "rgba(255,255,255,0.1)",
          height: 74,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#FBC900",
        tabBarInactiveTintColor: "rgba(255,255,255,0.4)",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 2 },
        tabBarItemStyle: { justifyContent: "center" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "grid" : "grid-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="offers"
        options={{
          title: "Offers",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "pricetags" : "pricetags-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="loyalty"
        options={{
          title: "Loyalty",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "card" : "card-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="vouchers"
        options={{
          title: "Vouchers",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "ticket" : "ticket-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "scan-circle" : "scan-circle-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
