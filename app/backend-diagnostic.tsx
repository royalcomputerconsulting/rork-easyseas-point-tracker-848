import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBaseUrl, isBackendEnabled } from '@/lib/trpc';

export default function BackendDiagnosticScreen() {
  const insets = useSafeAreaInsets();
  const [testResults, setTestResults] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const runDiagnostics = async () => {
    setTesting(true);
    const results: any = {
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      baseUrl: getBaseUrl(),
      isBackendEnabled,
      tests: []
    };

    // Test 1: Check base URL
    results.tests.push({
      name: 'Base URL Configuration',
      status: isBackendEnabled ? 'pass' : 'fail',
      details: `Base URL: ${getBaseUrl()}`,
      message: isBackendEnabled ? 'Backend is enabled' : 'Backend is in offline mode'
    });

    // Test 2: Try to fetch root health endpoint
    if (isBackendEnabled) {
      try {
        const healthUrl = `${getBaseUrl()}/api/health`;
        console.log('[Diagnostic] Testing health endpoint:', healthUrl);
        
        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        const contentType = response.headers.get('content-type');
        const text = await response.text();
        
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          console.error('[Diagnostic] Failed to parse JSON:', text.substring(0, 200));
        }

        results.tests.push({
          name: 'Health Endpoint',
          status: response.ok && json ? 'pass' : 'fail',
          details: `Status: ${response.status}, Content-Type: ${contentType}`,
          message: json ? `Response: ${JSON.stringify(json).substring(0, 100)}` : `Raw text: ${text.substring(0, 100)}`,
          response: json || text.substring(0, 500)
        });
      } catch (error: any) {
        results.tests.push({
          name: 'Health Endpoint',
          status: 'fail',
          details: error.message,
          message: 'Failed to connect to health endpoint'
        });
      }

      // Test 3: Try a simple tRPC call
      try {
        const trpcUrl = `${getBaseUrl()}/api/trpc/ping`;
        console.log('[Diagnostic] Testing tRPC ping:', trpcUrl);
        
        const response = await fetch(trpcUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });

        const contentType = response.headers.get('content-type');
        const text = await response.text();
        
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          console.error('[Diagnostic] Failed to parse tRPC JSON:', text.substring(0, 200));
        }

        results.tests.push({
          name: 'tRPC Ping',
          status: response.ok && json ? 'pass' : 'fail',
          details: `Status: ${response.status}, Content-Type: ${contentType}`,
          message: json ? `Response: ${JSON.stringify(json).substring(0, 100)}` : `Raw text: ${text.substring(0, 100)}`,
          response: json || text.substring(0, 500)
        });
      } catch (error: any) {
        results.tests.push({
          name: 'tRPC Ping',
          status: 'fail',
          details: error.message,
          message: 'Failed to connect to tRPC endpoint'
        });
      }
    }

    setTestResults(results);
    setTesting(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ title: 'Backend Diagnostics' }} />
      
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        <View style={styles.section}>
          <Text style={styles.title}>Backend Connection Diagnostics</Text>
          <Text style={styles.subtitle}>
            This tool helps diagnose backend connectivity issues
          </Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={runDiagnostics}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Run Diagnostics</Text>
          )}
        </TouchableOpacity>

        {testResults && (
          <View style={styles.results}>
            <View style={styles.resultSection}>
              <Text style={styles.resultTitle}>Configuration</Text>
              <Text style={styles.resultText}>Platform: {testResults.platform}</Text>
              <Text style={styles.resultText}>Base URL: {testResults.baseUrl}</Text>
              <Text style={styles.resultText}>
                Backend Status: {testResults.isBackendEnabled ? '✅ Enabled' : '❌ Offline'}
              </Text>
              <Text style={styles.resultText}>Timestamp: {testResults.timestamp}</Text>
            </View>

            {testResults.tests.map((test: any, index: number) => (
              <View key={index} style={styles.resultSection}>
                <View style={styles.testHeader}>
                  <Text style={styles.testName}>{test.name}</Text>
                  <Text style={[
                    styles.testStatus,
                    test.status === 'pass' ? styles.statusPass : styles.statusFail
                  ]}>
                    {test.status === 'pass' ? '✅ PASS' : '❌ FAIL'}
                  </Text>
                </View>
                <Text style={styles.testDetails}>{test.details}</Text>
                <Text style={styles.testMessage}>{test.message}</Text>
                {test.response && (
                  <View style={styles.responseBox}>
                    <Text style={styles.responseLabel}>Response:</Text>
                    <Text style={styles.responseText}>
                      {typeof test.response === 'string' 
                        ? test.response 
                        : JSON.stringify(test.response, null, 2)}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  results: {
    gap: 16,
  },
  resultSection: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  resultText: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  testName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  testStatus: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusPass: {
    color: '#4CAF50',
  },
  statusFail: {
    color: '#F44336',
  },
  testDetails: {
    fontSize: 13,
    color: '#999',
    marginBottom: 4,
  },
  testMessage: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 8,
  },
  responseBox: {
    backgroundColor: '#0a0a0a',
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333',
    marginTop: 8,
  },
  responseLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
    fontWeight: '600',
  },
  responseText: {
    fontSize: 12,
    color: '#4CAF50',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
