import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Stack, router } from 'expo-router';
import { trpc } from '@/lib/trpc';

export default function TestFetchPricingButton() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [logs, setLogs] = React.useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev, logMessage]);
  };

  const fetchWebPricingMutation = trpc.cruises.fetchWebPricing.useMutation({
    onMutate: (variables) => {
      addLog(`🔵 MUTATION STARTED`);
      addLog(`📦 Variables: ${JSON.stringify(variables)}`);
    },
    onSuccess: (data) => {
      addLog(`✅ MUTATION SUCCESS`);
      addLog(`📊 Response data: ${JSON.stringify(data, null, 2)}`);
    },
    onError: (error) => {
      addLog(`❌ MUTATION ERROR`);
      addLog(`🔴 Error: ${error.message}`);
      addLog(`🔴 Error shape: ${JSON.stringify(error.shape || 'No shape')}`);
      addLog(`🔴 Error data: ${JSON.stringify(error.data || 'No data')}`);
    },
    onSettled: () => {
      addLog(`🏁 MUTATION SETTLED (completed)`);
    }
  });

  const handleTest = async () => {
    addLog('🚀 TEST STARTED');
    addLog('🔧 Resetting state...');
    setIsLoading(true);
    setError(null);
    setResult(null);
    setLogs([]);

    addLog('📋 Test Configuration:');
    addLog(`  - Cruise ID: booked-liberty-1`);
    addLog(`  - Ship: Liberty of the Seas`);
    addLog(`  - Sail Date: 10/16/2025`);
    addLog(`  - Fetch Itinerary: true`);

    addLog('🔍 Checking tRPC client...');
    addLog(`  - tRPC client exists: ${!!trpc}`);
    addLog(`  - cruises router exists: ${!!trpc.cruises}`);
    addLog(`  - fetchWebPricing exists: ${!!trpc.cruises.fetchWebPricing}`);
    addLog(`  - useMutation exists: ${!!trpc.cruises.fetchWebPricing.useMutation}`);

    addLog('🔍 Checking mutation object...');
    addLog(`  - mutation exists: ${!!fetchWebPricingMutation}`);
    addLog(`  - mutateAsync exists: ${!!fetchWebPricingMutation.mutateAsync}`);
    addLog(`  - mutation status: ${fetchWebPricingMutation.status}`);
    addLog(`  - mutation isPending: ${fetchWebPricingMutation.isPending}`);
    addLog(`  - mutation isError: ${fetchWebPricingMutation.isError}`);
    addLog(`  - mutation isSuccess: ${fetchWebPricingMutation.isSuccess}`);

    try {
      addLog('📞 Calling fetchWebPricing mutation...');
      addLog('⏳ Waiting for response...');
      
      const startTime = Date.now();
      const res = await fetchWebPricingMutation.mutateAsync({
        cruiseId: 'booked-liberty-1',
        fetchItinerary: true
      });
      const endTime = Date.now();
      const duration = endTime - startTime;

      addLog(`✅ SUCCESS! (took ${duration}ms)`);
      addLog('📊 Response received:');
      addLog(`  - Type: ${typeof res}`);
      addLog(`  - Keys: ${res ? Object.keys(res).join(', ') : 'null'}`);
      addLog(`  - Full response: ${JSON.stringify(res, null, 2)}`);
      
      setResult(res);
      Alert.alert('Success', `Pricing fetched successfully in ${duration}ms!`);
    } catch (err: any) {
      addLog('❌ ERROR CAUGHT');
      addLog(`  - Error type: ${typeof err}`);
      addLog(`  - Error constructor: ${err?.constructor?.name}`);
      addLog(`  - Error message: ${err?.message || 'No message'}`);
      addLog(`  - Error code: ${err?.code || 'No code'}`);
      addLog(`  - Error data: ${JSON.stringify(err?.data, null, 2) || 'No data'}`);
      addLog(`  - Error stack: ${err?.stack || 'No stack'}`);
      addLog(`  - Full error object: ${JSON.stringify(err, null, 2)}`);
      
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      addLog('🏁 TEST COMPLETED');
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Test Fetch Pricing Button',
          headerStyle: { backgroundColor: '#FFFFFF' },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>Test Fetch Pricing Button</Text>
        <Text style={styles.subtitle}>Testing fetchWebPricing mutation for Liberty of the Seas</Text>

        <TouchableOpacity
          testID="test-fetch-pricing-button"
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleTest}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Test Fetch Pricing</Text>
          )}
        </TouchableOpacity>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Error:</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {result && (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>Result:</Text>
            <Text style={styles.resultText}>{JSON.stringify(result, null, 2)}</Text>
          </View>
        )}

        {logs.length > 0 && (
          <View style={styles.logsBox}>
            <Text style={styles.logsTitle}>📝 Detailed Logs ({logs.length}):</Text>
            {logs.map((log, index) => (
              <Text key={index} style={styles.logText}>{log}</Text>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#991B1B',
  },
  resultBox: {
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#15803D',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 12,
    color: '#166534',
    fontFamily: 'monospace',
  },
  backButton: {
    backgroundColor: '#6B7280',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  logsBox: {
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 12,
  },
  logText: {
    fontSize: 11,
    color: '#D1D5DB',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});
