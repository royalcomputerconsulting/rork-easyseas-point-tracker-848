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
import { Calendar, CheckCircle, XCircle, AlertCircle } from "lucide-react-native";

export default function TestCalendarScreen() {
  const router = useRouter();
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<any>(null);

  // Test queries
  const debugQuery = trpc.calendar.debugStore.useQuery();
  const eventsQuery = trpc.calendar.events.useQuery({});
  
  // Test mutations
  const importTripItMutation = trpc.calendar.importTripItDirect.useMutation();
  const addSampleMutation = trpc.calendar.addSampleEvents.useMutation();

  const runFullTest = async () => {
    setTesting(true);
    const testResults: any = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    try {
      // Test 1: Check current store state
      console.log("Test 1: Checking store state...");
      const storeState = await debugQuery.refetch();
      testResults.tests.push({
        name: "Store State",
        success: true,
        data: {
          totalEvents: storeState.data?.totalEventsInStore || 0,
          tripitEvents: storeState.data?.tripitEventsInStore || 0,
          eventsBySource: storeState.data?.eventsBySource || {}
        }
      });

      // Test 2: Query events
      console.log("Test 2: Querying events...");
      const eventsResult = await eventsQuery.refetch();
      testResults.tests.push({
        name: "Query Events",
        success: true,
        data: {
          eventsReturned: eventsResult.data?.length || 0,
          sampleEvents: eventsResult.data?.slice(0, 3).map(e => ({
            summary: e.summary,
            source: e.source,
            startDate: e.startDate
          })) || []
        }
      });

      // Test 3: Import TripIt
      console.log("Test 3: Importing TripIt events...");
      try {
        const importResult = await importTripItMutation.mutateAsync();
        testResults.tests.push({
          name: "Import TripIt",
          success: true,
          data: {
            eventsImported: importResult.eventsImported,
            totalInStore: importResult.totalInStore,
            tripItEventsInStore: importResult.tripItEventsInStore
          }
        });
      } catch (error) {
        testResults.tests.push({
          name: "Import TripIt",
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }

      // Test 4: Verify events after import
      console.log("Test 4: Verifying events after import...");
      const verifyEvents = await eventsQuery.refetch();
      const verifyStore = await debugQuery.refetch();
      testResults.tests.push({
        name: "Verify After Import",
        success: true,
        data: {
          eventsInQuery: verifyEvents.data?.length || 0,
          eventsInStore: verifyStore.data?.totalEventsInStore || 0,
          tripitInStore: verifyStore.data?.tripitEventsInStore || 0,
          eventsBySource: verifyStore.data?.eventsBySource || {}
        }
      });

      setResults(testResults);
      Alert.alert("Test Complete", `Imported ${testResults.tests[2]?.data?.eventsImported || 0} events`);
    } catch (error) {
      console.error("Test failed:", error);
      testResults.error = error instanceof Error ? error.message : "Unknown error";
      setResults(testResults);
      Alert.alert("Test Failed", "Check the results for details");
    } finally {
      setTesting(false);
    }
  };

  const clearTripItEvents = async () => {
    try {
      // This will clear TripIt events by adding sample events (which clears first)
      await addSampleMutation.mutateAsync();
      await eventsQuery.refetch();
      await debugQuery.refetch();
      Alert.alert("Success", "TripIt events cleared");
    } catch (error) {
      Alert.alert("Error", "Failed to clear events");
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Calendar size={32} color="#6C5CE7" />
        <Text style={styles.title}>Calendar Test Suite</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current State</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {debugQuery.data?.totalEventsInStore || 0}
            </Text>
            <Text style={styles.statLabel}>Total Events</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {debugQuery.data?.tripitEventsInStore || 0}
            </Text>
            <Text style={styles.statLabel}>TripIt Events</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {eventsQuery.data?.length || 0}
            </Text>
            <Text style={styles.statLabel}>Query Result</Text>
          </View>
        </View>

        {debugQuery.data?.eventsBySource && (
          <View style={styles.sourceBreakdown}>
            <Text style={styles.subTitle}>Events by Source:</Text>
            {Object.entries(debugQuery.data.eventsBySource).map(([source, count]) => (
              <Text key={source} style={styles.sourceItem}>
                {source}: {count}
              </Text>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={runFullTest}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <CheckCircle size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Run Full Test</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={clearTripItEvents}
          disabled={testing}
        >
          <XCircle size={20} color="#6C5CE7" />
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            Clear TripIt Events
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => router.push("/(tabs)/(events)")}
        >
          <Calendar size={20} color="#6C5CE7" />
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            Go to Events Tab
          </Text>
        </TouchableOpacity>
      </View>

      {results && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Results</Text>
          <Text style={styles.timestamp}>Run at: {new Date(results.timestamp).toLocaleString()}</Text>
          
          {results.tests.map((test: any, index: number) => (
            <View key={index} style={styles.testResult}>
              <View style={styles.testHeader}>
                {test.success ? (
                  <CheckCircle size={20} color="#10B981" />
                ) : (
                  <XCircle size={20} color="#EF4444" />
                )}
                <Text style={[styles.testName, test.success ? styles.success : styles.error]}>
                  {test.name}
                </Text>
              </View>
              {test.data && (
                <View style={styles.testData}>
                  <Text style={styles.dataText}>
                    {JSON.stringify(test.data, null, 2)}
                  </Text>
                </View>
              )}
              {test.error && (
                <Text style={styles.errorText}>{test.error}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {eventsQuery.data && eventsQuery.data.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sample Events</Text>
          {eventsQuery.data.slice(0, 5).map((event, index) => (
            <View key={event.id} style={styles.eventCard}>
              <Text style={styles.eventTitle}>{event.summary}</Text>
              <Text style={styles.eventDetails}>
                {event.startDate} - {event.endDate}
              </Text>
              <Text style={styles.eventSource}>Source: {event.source}</Text>
            </View>
          ))}
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
    alignItems: "center",
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: "#1F2937",
  },
  section: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: "#1F2937",
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: "#6C5CE7",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  sourceBreakdown: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#4B5563",
    marginBottom: 8,
  },
  sourceItem: {
    fontSize: 14,
    color: "#6B7280",
    marginVertical: 2,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    marginVertical: 6,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: "#6C5CE7",
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#6C5CE7",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
  secondaryButtonText: {
    color: "#6C5CE7",
  },
  timestamp: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 12,
  },
  testResult: {
    marginVertical: 8,
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
  },
  testHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  testName: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
  success: {
    color: "#10B981",
  },
  error: {
    color: "#EF4444",
  },
  testData: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
  },
  dataText: {
    fontSize: 12,
    color: "#4B5563",
    fontFamily: "monospace",
  },
  errorText: {
    fontSize: 14,
    color: "#EF4444",
    marginTop: 8,
  },
  eventCard: {
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    marginVertical: 6,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#1F2937",
  },
  eventDetails: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  eventSource: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
});