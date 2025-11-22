import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Stack, router } from "expo-router";
import { WebOffersProvider, useWebOffers } from "@/state/WebOffersProvider";
import { formatDate, formatTradeValue, computePerks, sortByColumn } from "@/lib/webOffers/utils";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react-native";
import { trpcClient } from "@/lib/trpc";

type SortDirection = "asc" | "desc" | null;
type SortColumn = "offerCode" | "offerName" | "ship" | "sailDate" | "nights" | "destination" | "tradeInValue";

function OffersListInner() {
  const insets = useSafeAreaInsets();
  const { flattenedOffers, isLoading, activeProfileKey, getSession, saveOffers } = useWebOffers();

  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [fetching, setFetching] = useState<boolean>(false);

  const sortedOffers = React.useMemo(() => {
    if (!sortColumn || !sortDirection) return flattenedOffers;
    return sortByColumn(flattenedOffers, sortColumn, sortDirection);
  }, [flattenedOffers, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortDirection(null);
        setSortColumn(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleFetchOffers = async () => {
    if (!activeProfileKey) {
      router.push("/connect-club-royale");
      return;
    }

    try {
      setFetching(true);
      const session = await getSession(activeProfileKey);

      if (!session) {
        alert("Session expired. Please reconnect.");
        router.push("/connect-club-royale");
        return;
      }

      console.log("[casino-offers-web] Fetching offers...");

      const result = await trpcClient.webOffers.mutate({
        token: session.token,
        accountId: session.accountId,
        loyaltyId: session.loyaltyId,
        brand: "royal",
      });

      if (result.success && result.data?.offers) {
        console.log("[casino-offers-web] Received", result.data.offers.length, "offers");
        await saveOffers(result.data.offers, activeProfileKey);
        alert(`Successfully loaded ${result.data.offers.length} offers!`);
      } else {
        alert("No offers data returned");
      }
    } catch (error) {
      console.error("[casino-offers-web] Error fetching offers:", error);
      alert(error instanceof Error ? error.message : "Failed to fetch offers");
    } finally {
      setFetching(false);
    }
  };

  const renderSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return null;
    return sortDirection === "asc" ? (
      <ChevronUp size={14} color="#1e293b" />
    ) : (
      <ChevronDown size={14} color="#1e293b" />
    );
  };

  const renderItem = ({ item }: { item: typeof flattenedOffers[0] }) => {
    const perks = computePerks(item);

    return (
      <View style={styles.row}>
        <View style={styles.cell}>
          <Text style={styles.cellText}>{item.offerCode}</Text>
        </View>
        <View style={[styles.cell, styles.flexCell]}>
          <Text style={styles.cellText} numberOfLines={2}>
            {item.offerName}
          </Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellText}>{item.shipName}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellText}>{formatDate(item.sailDate, "short")}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellText}>{item.nights}N</Text>
        </View>
        <View style={[styles.cell, styles.flexCell]}>
          <Text style={styles.cellText} numberOfLines={2}>
            {item.itineraryDescription}
          </Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellText}>{formatTradeValue(item.tradeInValue || 0)}</Text>
        </View>
        <View style={[styles.cell, styles.flexCell]}>
          <Text style={styles.cellTextSmall} numberOfLines={3}>
            {perks.length > 0 ? perks.join(", ") : "-"}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading || fetching) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.loadingText}>
          {fetching ? "Fetching offers..." : "Loading offers..."}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Casino Offers {flattenedOffers.length > 0 && `(${flattenedOffers.length})`}
        </Text>
        <Pressable style={styles.fetchButton} onPress={handleFetchOffers}>
          <Text style={styles.fetchButtonText}>
            {flattenedOffers.length > 0 ? "Refresh" : "Fetch Offers"}
          </Text>
        </Pressable>
      </View>

      {flattenedOffers.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No offers loaded</Text>
          <Text style={styles.emptySubtext}>
            {activeProfileKey
              ? "Tap 'Fetch Offers' to load your casino offers"
              : "Connect your Club Royale account first"}
          </Text>
        </View>
      ) : (
        <View style={styles.tableContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={styles.headerRow}>
                <Pressable
                  style={styles.headerCell}
                  onPress={() => handleSort("offerCode")}
                >
                  <Text style={styles.headerText}>Offer Code</Text>
                  {renderSortIndicator("offerCode")}
                </Pressable>
                <Pressable
                  style={[styles.headerCell, styles.flexCell]}
                  onPress={() => handleSort("offerName")}
                >
                  <Text style={styles.headerText}>Offer Name</Text>
                  {renderSortIndicator("offerName")}
                </Pressable>
                <Pressable
                  style={styles.headerCell}
                  onPress={() => handleSort("ship")}
                >
                  <Text style={styles.headerText}>Ship</Text>
                  {renderSortIndicator("ship")}
                </Pressable>
                <Pressable
                  style={styles.headerCell}
                  onPress={() => handleSort("sailDate")}
                >
                  <Text style={styles.headerText}>Sail Date</Text>
                  {renderSortIndicator("sailDate")}
                </Pressable>
                <Pressable
                  style={styles.headerCell}
                  onPress={() => handleSort("nights")}
                >
                  <Text style={styles.headerText}>Nights</Text>
                  {renderSortIndicator("nights")}
                </Pressable>
                <Pressable
                  style={[styles.headerCell, styles.flexCell]}
                  onPress={() => handleSort("destination")}
                >
                  <Text style={styles.headerText}>Destination</Text>
                  {renderSortIndicator("destination")}
                </Pressable>
                <Pressable
                  style={styles.headerCell}
                  onPress={() => handleSort("tradeInValue")}
                >
                  <Text style={styles.headerText}>Trade Value</Text>
                  {renderSortIndicator("tradeInValue")}
                </Pressable>
                <View style={[styles.headerCell, styles.flexCell]}>
                  <Text style={styles.headerText}>Perks</Text>
                </View>
              </View>

              <FlatList
                data={sortedOffers}
                renderItem={renderItem}
                keyExtractor={(item, index) =>
                  `${item.offerCode}-${item.shipCode}-${item.sailDate}-${index}`
                }
                style={styles.list}
              />
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function CasinoOffersWebScreen() {
  return (
    <WebOffersProvider>
      <Stack.Screen
        options={{
          title: "Casino Offers",
          headerShown: true,
          headerLeft: () => (
            <Pressable onPress={() => router.back()}>
              <ArrowLeft size={24} color="#0066cc" />
            </Pressable>
          ),
        }}
      />
      <OffersListInner />
    </WebOffersProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#64748b",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1e293b",
  },
  fetchButton: {
    backgroundColor: "#0066cc",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  fetchButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  tableContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 2,
    borderBottomColor: "#cbd5e1",
  },
  headerCell: {
    width: 120,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  flexCell: {
    width: 200,
  },
  headerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e293b",
    textTransform: "uppercase",
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  cell: {
    width: 120,
    padding: 12,
    justifyContent: "center",
  },
  cellText: {
    fontSize: 14,
    color: "#1e293b",
  },
  cellTextSmall: {
    fontSize: 12,
    color: "#64748b",
  },
});
