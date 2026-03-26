import { useEffect, useMemo, useState } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Image, ScrollView, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { wordpress, getFeaturedImage, extractOffers, type WPEat, type WPEvent } from "@/lib/wordpress";
import { decodeHtml, getDisplayAddress, getTodayOpeningHours, getTodayOpeningStatus } from "@/lib/utils";
import { VenueCardSkeleton } from "@/components/VenueCardSkeleton";
import { HUNowPickBadge } from "@/components/HUNowPickBadge";

const NAV = "#0F0032";
const YELLOW = "#FBC900";
const SURFACE = "rgba(255,255,255,0.07)";
const BORDER = "rgba(255,255,255,0.1)";
const BRAND_LOGO_URL = "https://hunow.co.uk/wp-content/uploads/2025/02/Group-1-1.png";

interface OfferFilter { id: number | string | null; name: string; itemKeys?: string[] }

interface OfferBrowseItem {
  key: string;
  kind: "venue" | "event";
  id: number;
  title: string;
  offerTitle: string | null;
  offerCount: number;
  img: string | null;
  featured: boolean;
  location: string | null;
  todayHours: string | null;
  todayStatus: ReturnType<typeof getTodayOpeningStatus>;
  filters: string[];
}

export default function VenuesScreen() {
  const [items, setItems] = useState<OfferBrowseItem[]>([]);
  const [filters, setFilters] = useState<OfferFilter[]>([{ id: null, name: "All" }]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<number | string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [results, eventResults] = await Promise.all([
      wordpress.getEat({ page: 1, perPage: 100 }),
      wordpress.getEvents({ page: 1, perPage: 100, order: "desc" }).catch(() => [] as WPEvent[]),
    ]);

    const venuesWithOffers = results.filter(hasVenueOffers);
    const venueItems: OfferBrowseItem[] = venuesWithOffers.map((venue) => {
      const offers = extractOffers(venue);
      const firstOfferTitle = offers[0]?.title ?? venue.acf?.offer_title ?? null;
      const offerImg = offers[0]?.image_url ?? getFeaturedImage(venue);
      const offerCount = offers.length;
      const location = getDisplayAddress(venue.acf?.address);
      const todayHours = getTodayOpeningHours(venue.acf?.opening_hours);
      const todayStatus = getTodayOpeningStatus(venue.acf?.opening_hours);
      return {
        key: `venue:${venue.id}`,
        kind: "venue",
        id: venue.id,
        title: decodeHtml(venue.title.rendered),
        offerTitle: firstOfferTitle ? decodeHtml(String(firstOfferTitle)) : null,
        offerCount,
        img: offerImg,
        featured: Boolean(offers[0]?.featured),
        location,
        todayHours,
        todayStatus,
        filters: (venue.filters ?? []).map((filter) => filter.name),
      };
    });

    const eventItems: OfferBrowseItem[] = eventResults
      .filter((event) => typeof event.acf?.offer_title === "string" && event.acf.offer_title.trim().length > 0)
      .map((event) => ({
        key: `event:${event.id}`,
        kind: "event",
        id: event.id,
        title: decodeHtml(event.title.rendered),
        offerTitle: decodeHtml(String(event.acf?.offer_title ?? "")),
        offerCount: 1,
        img: getFeaturedImage(event),
        featured: false,
        location: typeof event.acf?.location === "string"
          ? event.acf.location
          : typeof event.acf?.venue === "string"
            ? event.acf.venue
            : null,
        todayHours: null,
        todayStatus: null,
        filters: ["Events"],
      }));

    const allItems = [...venueItems, ...eventItems];
    const filterMap = new Map<number | string, OfferFilter>();

    venuesWithOffers.forEach((venue) => {
      const itemKey = `venue:${venue.id}`;
      (venue.filters ?? []).forEach((filter) => {
        const existing = filterMap.get(filter.id);
        if (existing) {
          existing.itemKeys = Array.from(new Set([...(existing.itemKeys ?? []), itemKey]));
        } else {
          filterMap.set(filter.id, {
            id: filter.id,
            name: filter.name,
            itemKeys: [itemKey],
          });
        }
      });
    });

    if (eventItems.length > 0) {
      filterMap.set("events", {
        id: "events",
        name: "Events",
        itemKeys: eventItems.map((item) => item.key),
      });
    }

    const availableCats = Array.from(filterMap.values())
      .filter((cat) => (cat.itemKeys?.length ?? 0) > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    setItems(allItems);
    setFilters([{ id: null, name: "All", itemKeys: allItems.map((item) => item.key) }, ...availableCats]);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    if (activeFilter !== null && !filters.some((c) => c.id === activeFilter)) {
      setActiveFilter(null);
    }
  }, [activeFilter, filters]);

  function onRefresh() { setRefreshing(true); load(); }

  function hasVenueOffers(item: WPEat): boolean {
    if (item.offers?.items?.some((o) => o.title?.trim())) return true;
    return !!(item.acf?.offer_title?.trim());
  }

  const filtered = useMemo(() => {
    let nextItems = items;

    if (search.trim()) {
      const q = search.toLowerCase();
      nextItems = nextItems.filter((item) =>
        item.title.toLowerCase().includes(q) || item.offerTitle?.toLowerCase().includes(q)
      );
    }

    if (activeFilter !== null) {
      const selectedFilter = filters.find((c) => c.id === activeFilter);
      const allowedKeys = new Set(selectedFilter?.itemKeys ?? []);
      nextItems = nextItems.filter((item) => allowedKeys.has(item.key));
    }

    return nextItems;
  }, [activeFilter, filters, items, search]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NAV }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
        <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 6 }}>
          Browse Rewards
        </Text>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "900", letterSpacing: -0.5, marginBottom: 8 }}>
          Offers
        </Text>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 }}>
        <View style={{
          flexDirection: "row", alignItems: "center",
          backgroundColor: SURFACE,
          borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, gap: 8,
          borderWidth: 1, borderColor: BORDER,
        }}>
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={{ flex: 1, color: "white", fontSize: 14 }}
            placeholder="Search offers..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter chips from API */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 10, gap: 10, alignItems: "center" }}
      >
        {filters.map((c) => {
          const active = activeFilter === c.id;
          const label = c.name?.trim() || "All";
          return (
            <TouchableOpacity
              key={c.id ?? "all"}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveFilter(c.id); }}
              style={{
                minWidth: 56,
                minHeight: 42,
                paddingHorizontal: 16,
                paddingVertical: 9,
                borderRadius: 999,
                backgroundColor: active ? YELLOW : SURFACE,
                borderWidth: 1, borderColor: active ? YELLOW : "rgba(255,255,255,0.15)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  lineHeight: 16,
                  fontWeight: active ? "800" : "700",
                  color: active ? NAV : "rgba(255,255,255,0.82)",
                  textAlign: "center",
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <VenueCardSkeleton count={6} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 110, gap: 16, paddingTop: 8, paddingHorizontal: 20 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={YELLOW}
              title="Loading offers..."
              titleColor="rgba(255,255,255,0.4)"
            />
          }
          renderItem={({ item }) => {
            return (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(item.kind === "event" ? `/(customer)/event/${item.id}` : `/(customer)/venue/${item.id}`);
                }}
                style={{
                  backgroundColor: "white", borderRadius: 26, overflow: "hidden",
                  shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.18, shadowRadius: 14, elevation: 6,
                }}
              >
                <View style={{ position: "relative" }}>
                  {item.img ? (
                    <Image source={{ uri: item.img }} style={{ width: "100%", height: 176 }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: "100%", height: 176, backgroundColor: "rgba(15,0,50,0.08)", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={item.kind === "event" ? "calendar-outline" : "storefront-outline"} size={32} color="rgba(15,0,50,0.2)" />
                    </View>
                  )}
                  <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 78, backgroundColor: "rgba(15,0,50,0.32)" }} />
                  <View style={{ position: "absolute", top: 10, left: 10 }}>
                    {item.featured ? <HUNowPickBadge /> : (
                      <View style={{ backgroundColor: item.kind === "event" ? "rgba(15,0,50,0.78)" : YELLOW, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <Text style={{ color: item.kind === "event" ? "white" : NAV, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 }}>
                          {item.kind === "event" ? "EVENT" : "STANDARD"}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ position: "absolute", top: 10, right: 10, backgroundColor: "rgba(15,0,50,0.72)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: "white", fontSize: 10, fontWeight: "800" }}>{item.offerCount} {item.offerCount === 1 ? "offer" : "offers"}</Text>
                  </View>
                  <View style={{ position: "absolute", left: 14, right: 14, bottom: 14 }}>
                    <Text style={{ color: "rgba(255,255,255,0.78)", fontWeight: "700", fontSize: 12, marginBottom: 4 }} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.offerTitle ? (
                      <Text style={{ color: "white", fontSize: 24, fontWeight: "900", lineHeight: 28 }} numberOfLines={2}>
                        {item.offerTitle}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={{ padding: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <View style={{ backgroundColor: "rgba(15,0,50,0.06)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ color: NAV, fontSize: 11, fontWeight: "800" }}>+35 pts</Text>
                    </View>
                    <View style={{ backgroundColor: "rgba(15,0,50,0.06)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ color: "rgba(15,0,50,0.6)", fontSize: 11, fontWeight: "700" }}>
                        {item.offerCount > 1 ? `${item.offerCount} live rewards` : "1 live reward"}
                      </Text>
                    </View>
                    {item.todayStatus ? (
                      <View style={{ backgroundColor: item.todayStatus.isOpen ? "rgba(21,128,61,0.12)" : "rgba(180,83,9,0.12)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <Text style={{ color: item.todayStatus.isOpen ? "#15803D" : "#B45309", fontSize: 11, fontWeight: "800" }}>
                          {item.todayStatus.label}
                        </Text>
                      </View>
                    ) : item.kind === "event" ? (
                      <View style={{ backgroundColor: "rgba(15,0,50,0.06)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                        <Text style={{ color: "rgba(15,0,50,0.6)", fontSize: 11, fontWeight: "700" }}>Event reward</Text>
                      </View>
                    ) : null}
                  </View>

                  {(item.location || item.todayHours) ? (
                    <View style={{ gap: 8, marginBottom: 12 }}>
                      {item.location ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Ionicons name="location-outline" size={13} color="rgba(15,0,50,0.42)" />
                          <Text style={{ color: "rgba(15,0,50,0.54)", fontSize: 12, flex: 1 }} numberOfLines={1}>
                            {item.location}
                          </Text>
                        </View>
                      ) : null}
                      {item.todayHours ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Ionicons name="time-outline" size={13} color="rgba(15,0,50,0.42)" />
                          <Text style={{ color: "rgba(15,0,50,0.54)", fontSize: 12, flex: 1 }} numberOfLines={1}>
                            Today: {item.todayHours}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(15,0,50,0.08)" }}>
                    <Text style={{ color: NAV, fontSize: 12, fontWeight: "800" }}>View reward details</Text>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: YELLOW + "22", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="arrow-forward" size={15} color={NAV} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 44, marginHorizontal: 20, backgroundColor: SURFACE, borderRadius: 22, padding: 24, borderWidth: 1, borderColor: BORDER }}>
              <Image source={{ uri: BRAND_LOGO_URL }} style={{ width: 72, height: 34, marginLeft: -10, marginBottom: 12 }} resizeMode="contain" />
              <Text style={{ color: "white", fontSize: 16, fontWeight: "800", marginBottom: 6 }}>No offers found</Text>
              <Text style={{ color: "rgba(255,255,255,0.42)", fontSize: 13, textAlign: "center", lineHeight: 19 }}>
                Try another search or category to explore live HU NOW rewards across the city.
              </Text>
            </View>
          }
          ListHeaderComponent={
            <View style={{ paddingBottom: 12 }}>
              <View style={{ backgroundColor: SURFACE, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: BORDER }}>
                <Text style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>
                  Live Rewards
                </Text>
                <Text style={{ color: "white", fontSize: 18, fontWeight: "800", marginBottom: 6 }}>
                  {filtered.length} {filtered.length === 1 ? "reward listing" : "reward listings"} available
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.48)", fontSize: 13, lineHeight: 19 }}>
                  Browse venue rewards and event-based rewards in one place.
                </Text>
              </View>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
