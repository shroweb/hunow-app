import type { Ionicons } from "@expo/vector-icons";

export const TIER_META = {
  standard: { label: "Standard", color: "rgba(255,255,255,0.5)", icon: "ellipse" as keyof typeof Ionicons.glyphMap },
  bronze: { label: "Bronze", color: "#CD7F32", icon: "medal-outline" as keyof typeof Ionicons.glyphMap },
  silver: { label: "Silver", color: "#C0C0C0", icon: "diamond-outline" as keyof typeof Ionicons.glyphMap },
  gold: { label: "Gold", color: "#FBC900", icon: "trophy-outline" as keyof typeof Ionicons.glyphMap },
} as const;

