import { View, Text } from "react-native";

const NAV = "#0F0032";
const YELLOW = "#FBC900";

export function HUNowPickBadge({
  label = "HU NOW PICK",
  inverted = false,
}: {
  label?: string;
  inverted?: boolean;
}) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: inverted ? "rgba(251,201,0,0.14)" : YELLOW,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      <Text
        style={{
          color: inverted ? YELLOW : NAV,
          fontSize: 10,
          fontWeight: "900",
          letterSpacing: 0.8,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
