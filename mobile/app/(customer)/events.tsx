import { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { wordpress, type WPEvent } from "@/lib/wordpress";

function formatEventDate(ymd: string): string {
  if (!ymd || ymd.length !== 8) return ymd;
  const year = ymd.slice(0, 4);
  const month = ymd.slice(4, 6);
  const day = ymd.slice(6, 8);
  return new Date(`${year}-${month}-${day}`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function EventsScreen() {
  const [events, setEvents] = useState<WPEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    wordpress.getEvents({ perPage: 20, orderby: "date", order: "asc" }).then((data) => {
      setEvents(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View className="flex-1 bg-brand-navy items-center justify-center">
        <ActivityIndicator color="#FBC900" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-navy">
      <View className="px-5 pt-4 pb-2">
        <Text className="text-white text-2xl font-bold mb-4">Events</Text>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
        renderItem={({ item }) => (
          <View className="bg-white/10 border border-white/20 rounded-2xl p-4 mb-3">
            <Text className="text-white font-semibold text-base">{item.title.rendered}</Text>
            {item.acf?.event_date && (
              <Text className="text-brand-yellow text-xs mt-1 font-semibold">
                {formatEventDate(item.acf.event_date)}
              </Text>
            )}
            {item.excerpt?.rendered ? (
              <Text className="text-white/50 text-xs mt-1" numberOfLines={2}>
                {item.excerpt.rendered.replace(/<[^>]+>/g, "")}
              </Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <Text className="text-white/40 text-sm text-center mt-8">No upcoming events</Text>
        }
      />
    </SafeAreaView>
  );
}
