import { View, useWindowDimensions } from "react-native";
import { Skeleton } from "./Skeleton";

interface Props { count?: number }

export function VenueCardSkeleton({ count = 6 }: Props) {
  const { width } = useWindowDimensions();
  const CARD_W = (width - 48) / 2;

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 12, marginTop: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: CARD_W, backgroundColor: "rgba(255,255,255,0.05)",
            borderRadius: 16, overflow: "hidden",
          }}
        >
          <Skeleton width={CARD_W} height={130} borderRadius={0} />
          <View style={{ padding: 10, gap: 6 }}>
            <Skeleton width={CARD_W * 0.7} height={14} borderRadius={6} />
            <Skeleton width={CARD_W * 0.5} height={11} borderRadius={6} />
            <Skeleton width={CARD_W * 0.4} height={11} borderRadius={6} />
          </View>
        </View>
      ))}
    </View>
  );
}
