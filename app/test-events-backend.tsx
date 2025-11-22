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
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";

export default function TestEventsBackend() {
  const router = useRouter();
  const [testResults, setTestResults] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  // Test queries
  const eventsQuery = trpc.calendar.events.useQuery(undefined, {
    enabled: false,
  });
  
  const debugQuery = trpc.calendar.debugStore.useQuery(undefined, {
    enabled: false,
  });
  
  const rawEventsQuery = trpc.calendar.getRawEvents.useQuery(undefined, {
    enabled: false,
  });

  // Test mutations
  const clearEventsMutation = trpc.calendar.clearAllEvents.useMutation();
  const addSampleEventsMutation = trpc.calendar.addSampleEvents.useMutation();
  const importTripItMutation = trpc.calendar.importTripItDirect.useMutation();

  const addResult = (message: string) => {
    console.log('[Test]', message);
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runTests = async () => {
    setTesting(true);
    setTestResults([]);
    
    try {
      addResult("Starting backend event tests...");
      
      // Test 1: Check debug store
      addResult("Test 1: Checking debug store...");
      const debugResult = await debugQuery.refetch();
      if (debugResult.data) {
        addResult(`✅ Debug store accessible`);
        addResult(`  - Total events: ${debugResult.data.totalEventsInStore}`);
        addResult(`  - TripIt events: ${debugResult.data.tripitEventsInStore}`);
        addResult(`  - Manual events: ${debugResult.data.manualEventsInStore}`);
      } else {
        addResult("❌ Debug store returned no data");
      }
      
      // Test 2: Check raw events
      addResult("\nTest 2: Checking raw events query...");
      const rawResult = await rawEventsQuery.refetch();
      if (rawResult.data) {
        addResult(`✅ Raw events accessible`);
        addResult(`  - Total events: ${rawResult.data.totalEvents}`);
        addResult(`  - Events array length: ${rawResult.data.events?.length || 0}`);
      } else {
        addResult("❌ Raw events returned no data");
      }
      
      // Test 3: Check main events query
      addResult("\nTest 3: Checking main events query...");
      const eventsResult = await eventsQuery.refetch();
      if (eventsResult.data) {
        addResult(`✅ Main events query successful`);
        addResult(`  - Events returned: ${eventsResult.data.length}`);
        if (eventsResult.data.length > 0) {
          const firstEvent = eventsResult.data[0];
          addResult(`  - First event: "${firstEvent.summary}" on ${firstEvent.startDate}`);
        }
      } else {
        addResult("❌ Main events query returned no data");
      }
      
      // Test 4: Clear and add sample events
      addResult("\nTest 4: Testing clear and add sample events...");
      try {
        const clearResult = await clearEventsMutation.mutateAsync();
        addResult(`✅ Cleared ${clearResult.clearedCount} events`);
        
        const addResult2 = await addSampleEventsMutation.mutateAsync();
        addResult(`✅ Added ${addResult2.eventsAdded} sample events`);
        
        // Verify events were added
        const verifyResult = await eventsQuery.refetch();
        addResult(`  - Verification: ${verifyResult.data?.length || 0} events now in system`);
      } catch (error) {
        addResult(`❌ Error in clear/add test: ${error}`);
      }
      
      // Test 5: Import TripIt events
      addResult("\nTest 5: Testing TripIt import...");
      try {
        const importResult = await importTripItMutation.mutateAsync();
        addResult(`✅ Imported ${importResult.eventsImported} TripIt events`);
        addResult(`  - Total in store: ${importResult.totalInStore}`);
        
        // Wait a moment for backend to stabilize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify import
        const verifyResult = await eventsQuery.refetch();
        addResult(`  - Verification: ${verifyResult.data?.length || 0} events now available`);
        
        const debugVerify = await debugQuery.refetch();
        if (debugVerify.data) {
          addResult(`  - Debug verification: ${debugVerify.data.totalEventsInStore} total, ${debugVerify.data.tripitEventsInStore} TripIt`);
        }
      } catch (error) {
        addResult(`❌ Error importing TripIt: ${error}`);
      }
      
      // Final check
      addResult("\n=== FINAL STATUS ===");
      const finalDebug = await debugQuery.refetch();
      const finalEvents = await eventsQuery.refetch();
      const finalRaw = await rawEventsQuery.refetch();
      
      addResult(`Debug store: ${finalDebug.data?.totalEventsInStore || 0} events`);
      addResult(`Main query: ${finalEvents.data?.length || 0} events`);
      addResult(`Raw query: ${finalRaw.data?.totalEvents || 0} events`);
      
      if (finalEvents.data && finalEvents.data.length > 0) {
        addResult("\n✅ EVENTS ARE LOADING CORRECTLY!");
      } else if (finalRaw.data?.events && finalRaw.data.events.length > 0) {
        addResult("\n⚠️ Events exist in raw query but not main query");
      } else if (finalDebug.data?.totalEventsInStore && finalDebug.data.totalEventsInStore > 0) {
        addResult("\n⚠️ Events exist in debug store but not in queries");
      } else {
        addResult("\n❌ NO EVENTS FOUND IN ANY QUERY");
      }
      
    } catch (error) {
      addResult(`❌ Test error: ${error}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#6C5CE7" />
        </TouchableOpacity>
        <Text style={styles.title}>Events Backend Test</Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={[styles.testButton, testing && styles.testButtonDisabled]}
          onPress={runTests}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.testButtonText}>Run Backend Tests</Text>
          )}
        </TouchableOpacity>

        <ScrollView style={styles.resultsContainer}>
          {testResults.map((result, index) => (
            <Text key={index} style={styles.resultText}>
              {result}
            </Text>
          ))}
        </ScrollView>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={async () => {
              try {
                const result = await clearEventsMutation.mutateAsync();
                Alert.alert("Success", `Cleared ${result.clearedCount} events`);
                addResult(`Cleared ${result.clearedCount} events`);
              } catch (error) {
                Alert.alert("Error", `Failed to clear: ${error}`);
              }
            }}
          >
            <Text style={styles.actionButtonText}>Clear All Events</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={async () => {
              try {
                const result = await addSampleEventsMutation.mutateAsync();
                Alert.alert("Success", `Added ${result.eventsAdded} sample events`);
                addResult(`Added ${result.eventsAdded} sample events`);
              } catch (error) {
                Alert.alert("Error", `Failed to add samples: ${error}`);
              }
            }}
          >
            <Text style={styles.actionButtonText}>Add Sample Events</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/(tabs)/(events)")}
          >
            <Text style={styles.actionButtonText}>Go to Events Page</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "600" as const,
    color: "#1F2937",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  testButton: {
    backgroundColor: "#6C5CE7",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  testButtonDisabled: {
    opacity: 0.7,
  },
  testButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  resultText: {
    fontSize: 12,
    color: "#374151",
    marginBottom: 4,
    fontFamily: "monospace",
  },
  quickActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#6C5CE7",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#6C5CE7",
    fontSize: 12,
    fontWeight: "600" as const,
  },
});