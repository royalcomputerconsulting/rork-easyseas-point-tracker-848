import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";

export default function TestEventsDebug() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Direct debug query
  const debugQuery = trpc.calendar.debugStore.useQuery(undefined, {
    refetchOnWindowFocus: false,
    enabled: true,
  });

  // Direct events query
  const eventsQuery = trpc.calendar.events.useQuery({}, {
    refetchOnWindowFocus: false,
    enabled: true,
  });

  // Force reload mutation
  const forceReloadMutation = trpc.calendar.forceReloadEvents.useMutation({
    onSuccess: (data) => {
      console.log("[TestDebug] Force reload success:", data);
      setDebugInfo(data);
      Alert.alert("Success", `Loaded ${data.eventCount} events from store`);
    },
    onError: (error) => {
      console.error("[TestDebug] Force reload error:", error);
      Alert.alert("Error", "Failed to force reload events");
    },
  });

  const handleForceReload = async () => {
    setLoading(true);
    try {
      await forceReloadMutation.mutateAsync();
      await debugQuery.refetch();
      await eventsQuery.refetch();
    } catch (error) {
      console.error("[TestDebug] Error:", error);
    }
    setLoading(false);
  };

  const handleImportTestData = async () => {
    setLoading(true);
    try {
      // Import ICS data directly with hardcoded content
      const testIcsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test Calendar//EN
BEGIN:VEVENT
DTSTART:20250201
DTEND:20250202
SUMMARY:Test Event 1
LOCATION:Test Location 1
DESCRIPTION:This is a test event
END:VEVENT
BEGIN:VEVENT
DTSTART:20250205
DTEND:20250207
SUMMARY:Test Event 2
LOCATION:Test Location 2
DESCRIPTION:This is another test event
END:VEVENT
BEGIN:VEVENT
DTSTART:20250210
DTEND:20250210
SUMMARY:Test Event 3
LOCATION:Test Location 3
DESCRIPTION:Single day test event
END:VEVENT
END:VCALENDAR`;

      const importMutation = trpc.calendar.importIcs.useMutation();
      const result = await importMutation.mutateAsync({ icsContent: testIcsContent });
      
      console.log("[TestDebug] Import result:", result);
      Alert.alert("Success", `Imported ${result.imported} test events`);
      
      // Refresh queries
      await debugQuery.refetch();
      await eventsQuery.refetch();
    } catch (error) {
      console.error("[TestDebug] Import error:", error);
      Alert.alert("Error", "Failed to import test data");
    }
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Events Debug Panel</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      {/* Debug Store Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backend Store Status</Text>
        {debugQuery.isLoading ? (
          <ActivityIndicator size="small" color="#6C5CE7" />
        ) : debugQuery.data ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Total Events in Store: {debugQuery.data.totalEventsInStore}
            </Text>
            <Text style={styles.infoText}>
              TripIt Events: {debugQuery.data.tripitEventsInStore}
            </Text>
            <Text style={styles.infoText}>
              Manual/iCal Events: {debugQuery.data.manualEventsInStore}
            </Text>
            {debugQuery.data.eventsBySource && (
              <Text style={styles.infoText}>
                By Source: {JSON.stringify(debugQuery.data.eventsBySource)}
              </Text>
            )}
          </View>
        ) : (
          <Text style={styles.errorText}>Failed to load debug info</Text>
        )}
      </View>

      {/* Events Query Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Events Query Status</Text>
        {eventsQuery.isLoading ? (
          <ActivityIndicator size="small" color="#6C5CE7" />
        ) : (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Query Status: {eventsQuery.status}
            </Text>
            <Text style={styles.infoText}>
              Events Returned: {eventsQuery.data?.length || 0}
            </Text>
            {eventsQuery.isError && (
              <Text style={styles.errorText}>
                Error: {eventsQuery.error?.message}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Force Reload Info */}
      {debugInfo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Force Reload Result</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Event Count: {debugInfo.eventCount}
            </Text>
            <Text style={styles.infoText}>
              Success: {debugInfo.success ? "Yes" : "No"}
            </Text>
          </View>
        </View>
      )}

      {/* Sample Events */}
      {debugQuery.data?.allEvents && debugQuery.data.allEvents.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Sample Events (First 5 of {debugQuery.data.allEvents.length})
          </Text>
          {debugQuery.data.allEvents.slice(0, 5).map((event: any, index: number) => (
            <View key={index} style={styles.eventBox}>
              <Text style={styles.eventTitle}>{event.summary}</Text>
              <Text style={styles.eventDetail}>
                Source: {event.source} | Date: {event.startDate}
              </Text>
              {event.location && (
                <Text style={styles.eventDetail}>Location: {event.location}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleForceReload}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Force Reload Events</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary, loading && styles.buttonDisabled]}
          onPress={handleImportTestData}
          disabled={loading}
        >
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
            Import Test Events
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => {
            debugQuery.refetch();
            eventsQuery.refetch();
          }}
        >
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
            Refresh Queries
          </Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6C5CE7" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: "#1F2937",
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#6B7280",
  },
  section: {
    margin: 16,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#1F2937",
    marginBottom: 12,
  },
  infoBox: {
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#6B7280",
  },
  errorText: {
    fontSize: 14,
    color: "#EF4444",
  },
  eventBox: {
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#1F2937",
    marginBottom: 4,
  },
  eventDetail: {
    fontSize: 12,
    color: "#6B7280",
  },
  buttonContainer: {
    padding: 16,
    gap: 12,
  },
  button: {
    backgroundColor: "#6C5CE7",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonSecondary: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#6C5CE7",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
  buttonTextSecondary: {
    color: "#6C5CE7",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600" as const,
  },
});