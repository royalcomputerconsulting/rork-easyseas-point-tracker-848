import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Stack } from "expo-router";
import { trpc } from "@/lib/trpc";

export default function TestEventsFlow() {
  const [logs, setLogs] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  // tRPC hooks
  const debugStoreQuery = trpc.calendar.debugStore.useQuery();
  const eventsQuery = trpc.calendar.events.useQuery();
  const forceReloadMutation = trpc.calendar.forceReloadEvents.useMutation();
  const importTripItMutation = trpc.calendar.importTripItDirect.useMutation();

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[TestEventsFlow] ${message}`);
  };

  const runTests = async () => {
    setTesting(true);
    setLogs([]);
    addLog("Starting event flow tests...");

    try {
      // Test 1: Check debug store
      addLog("Test 1: Checking debug store...");
      await debugStoreQuery.refetch();
      const debugResult = debugStoreQuery.data;
      if (debugResult) {
        addLog(`Debug store has ${debugResult.totalEventsInStore} total events`);
        addLog(`- TripIt: ${debugResult.tripitEventsInStore}`);
        addLog(`- Manual: ${debugResult.manualEventsInStore}`);
        addLog(`Events by source: ${JSON.stringify(debugResult.eventsBySource)}`);
        
        if (debugResult.allEvents && debugResult.allEvents.length > 0) {
          addLog(`Sample events from debug:`);
          debugResult.allEvents.slice(0, 3).forEach((e: any, i: number) => {
            addLog(`  ${i + 1}. [${e.source}] "${e.summary}" on ${e.startDate}`);
          });
        }
      } else {
        addLog("Debug store query returned no data");
      }

      // Test 2: Check events query
      addLog("\nTest 2: Checking events query...");
      await eventsQuery.refetch();
      const eventsResult = eventsQuery.data;
      if (eventsResult) {
        addLog(`Events query returned ${eventsResult.length} events`);
        if (eventsResult.length > 0) {
          addLog(`Sample events from query:`);
          eventsResult.slice(0, 3).forEach((e: any, i: number) => {
            addLog(`  ${i + 1}. [${e.source}] "${e.summary}" on ${e.startDate}`);
          });
        }
      } else {
        addLog("Events query returned no data");
      }

      // Test 3: Force reload events
      addLog("\nTest 3: Force reloading events...");
      const reloadResult = await forceReloadMutation.mutateAsync();
      if (reloadResult) {
        addLog(`Force reload returned ${reloadResult.eventCount} events`);
        if (reloadResult.events && reloadResult.events.length > 0) {
          addLog(`Sample events after reload:`);
          reloadResult.events.slice(0, 3).forEach((e: any, i: number) => {
            addLog(`  ${i + 1}. [${e.source}] "${e.summary}" on ${e.startDate}`);
          });
        }
      }

      // Test 4: Direct import TripIt
      addLog("\nTest 4: Testing direct TripIt import...");
      try {
        const importResult = await importTripItMutation.mutateAsync();
        if (importResult) {
          addLog(`TripIt import successful!`);
          addLog(`- Events imported: ${importResult.eventsImported}`);
          addLog(`- Total in store: ${importResult.totalInStore}`);
          addLog(`- TripIt events in store: ${importResult.tripItEventsInStore}`);
        }
      } catch (error) {
        addLog(`TripIt import failed: ${error}`);
      }

      // Test 5: Re-check events after import
      addLog("\nTest 5: Re-checking events after import...");
      await eventsQuery.refetch();
      const finalEventsResult = eventsQuery.data;
      if (finalEventsResult) {
        addLog(`Final events query returned ${finalEventsResult.length} events`);
      }

      await debugStoreQuery.refetch();
      const finalDebugResult = debugStoreQuery.data;
      if (finalDebugResult) {
        addLog(`Final debug store has ${finalDebugResult.totalEventsInStore} total events`);
      }

      addLog("\n✅ All tests completed!");
    } catch (error) {
      addLog(`❌ Error during tests: ${error}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Test Events Flow" }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Events Data Flow Test</Text>
          <Text style={styles.subtitle}>
            This page tests the flow of event data from backend to frontend
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, testing && styles.buttonDisabled]}
          onPress={runTests}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Run Tests</Text>
          )}
        </TouchableOpacity>

        <ScrollView style={styles.logsContainer}>
          <Text style={styles.logsTitle}>Test Logs:</Text>
          {logs.length === 0 ? (
            <Text style={styles.logEntry}>Press "Run Tests" to begin...</Text>
          ) : (
            logs.map((log, index) => (
              <Text key={index} style={styles.logEntry}>
                {log}
              </Text>
            ))
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: "#1F2937",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
  },
  button: {
    backgroundColor: "#6C5CE7",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  logsContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#1F2937",
    marginBottom: 12,
  },
  logEntry: {
    fontSize: 12,
    color: "#4B5563",
    marginBottom: 4,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
});