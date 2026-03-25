import { View } from "react-native";
import { Skeleton } from "./Skeleton";

interface Props { count?: number }

export function OfferCardSkeleton({ count = 3 }: Props) {
  return (
    <View style={{ flexDirection: "row", paddingHorizontal: 20, gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 200, height: 130,
            backgroundColor: "rgba(255,255,255,0.05)",
            borderRadius: 16, overflow: "hidden",
          }}
        >
          <Skeleton width={200} height={70} borderRadius={0} />
          <View style={{ padding: 8, gap: 5 }}>
            <Skeleton width={80} height={10} borderRadius={5} />
            <Skeleton width={140} height={13} borderRadius={5} />
          </View>
        </View>
      ))}
    </View>
  );
}
