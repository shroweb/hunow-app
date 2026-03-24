import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";

export default function CustomerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0F0032",
          borderTopColor: "rgba(255,255,255,0.08)",
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: "#FBC900",
        tabBarInactiveTintColor: "rgba(255,255,255,0.35)",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Browse",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="venues"
        options={{
          title: "Eat & Drink",
          tabBarIcon: ({ color, size }) => <Ionicons name="restaurant" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="card"
        options={{
          title: "My Card",
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              backgroundColor: focused ? "#FBC900" : "rgba(255,255,255,0.1)",
              borderRadius: 14,
              width: 44,
              height: 30,
              alignItems: "center",
              justifyContent: "center",
              marginTop: -2,
            }}>
              <Ionicons name="card" size={18} color={focused ? "#0F0032" : "rgba(255,255,255,0.5)"} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: "Events",
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="venue/[id]" options={{ href: null }} />
    </Tabs>
  );
}
