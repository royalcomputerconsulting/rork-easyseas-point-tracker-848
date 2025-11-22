import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBaseUrl, isBackendEnabled, backendStatus, trpc } from '@/lib/trpc';
import { COLORS } from '@/constants/theme';

export default function ConnectionDiagnosticScreen() {
  const insets = useSafeAreaInsets();
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  const pingQuery = trpc.ping.useQuery(undefined, {
    enabled: false,
    retry: false,
  });

  const runDiagnostics = useCallback(async () => {
    setTesting(true);
    const results: any = {
      timestamp: new Date().toISOString(),
      baseUrl: getBaseUrl(),
      isBackendEnabled,
      backendStatus,
      platform: Platform.OS,
      window: typeof window !== 'undefined' ? {
        origin: window.location?.origin,
        href: window.location?.href,
        hostname: window.location?.hostname,
        port: window.location?.port,
      } : 'N/A',
    };

    // Test fetch to backend
    try {
      const testUrl = `${getBaseUrl()}/api/health`;
      console.log('[Diagnostic] Testing fetch to:', testUrl);
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      results.healthCheck = {
        url: testUrl,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      };
      
      if (response.ok) {
        const data = await response.json();
        results.healthCheck.data = data;
      } else {
        const text = await response.text();
        results.healthCheck.errorText = text.substring(0, 200);
      }
    } catch (error: any) {
      results.healthCheck = {
        error: error.message,
        name: error.name,
        stack: error.stack?.substring(0, 300),
      };
    }

    // Test tRPC ping
    try {
      const pingResult = await pingQuery.refetch();
      results.trpcPing = {
        success: true,
        data: pingResult.data,
      };
    } catch (error: any) {
      results.trpcPing = {
        success: false,
        error: error.message,
        name: error.name,
      };
    }

    setDiagnostics(results);
    setTesting(false);
  }, [pingQuery]);

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ title: 'Connection Diagnostic' }} />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Backend Connection Diagnostic</Text>
        
        {testing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Running diagnostics...</Text>
          </View>
        )}

        {diagnostics && (
          <View style={styles.resultsContainer}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Configuration</Text>
              <Text style={styles.label}>Base URL:</Text>
              <Text style={styles.value}>{diagnostics.baseUrl}</Text>
              
              <Text style={styles.label}>Backend Enabled:</Text>
              <Text style={[styles.value, diagnostics.isBackendEnabled ? styles.success : styles.error]}>
                {diagnostics.isBackendEnabled ? 'Yes' : 'No'}
              </Text>
              
              <Text style={styles.label}>Platform:</Text>
              <Text style={styles.value}>{diagnostics.platform}</Text>
              
              {diagnostics.window !== 'N/A' && (
                <>
                  <Text style={styles.label}>Window Origin:</Text>
                  <Text style={styles.value}>{diagnostics.window.origin}</Text>
                  
                  <Text style={styles.label}>Window Href:</Text>
                  <Text style={styles.value}>{diagnostics.window.href}</Text>
                </>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Health Check (/api/health)</Text>
              {diagnostics.healthCheck.error ? (
                <>
                  <Text style={[styles.label, styles.error]}>Error:</Text>
                  <Text style={styles.value}>{diagnostics.healthCheck.error}</Text>
                  <Text style={styles.value}>{diagnostics.healthCheck.name}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Status:</Text>
                  <Text style={[styles.value, diagnostics.healthCheck.ok ? styles.success : styles.error]}>
                    {diagnostics.healthCheck.status} {diagnostics.healthCheck.statusText}
                  </Text>
                  
                  {diagnostics.healthCheck.data && (
                    <>
                      <Text style={styles.label}>Response:</Text>
                      <Text style={styles.value}>{JSON.stringify(diagnostics.healthCheck.data, null, 2)}</Text>
                    </>
                  )}
                  
                  {diagnostics.healthCheck.errorText && (
                    <>
                      <Text style={[styles.label, styles.error]}>Error Response:</Text>
                      <Text style={styles.value}>{diagnostics.healthCheck.errorText}</Text>
                    </>
                  )}
                </>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>tRPC Ping</Text>
              {diagnostics.trpcPing.success ? (
                <>
                  <Text style={[styles.label, styles.success]}>Success!</Text>
                  <Text style={styles.value}>{JSON.stringify(diagnostics.trpcPing.data, null, 2)}</Text>
                </>
              ) : (
                <>
                  <Text style={[styles.label, styles.error]}>Failed:</Text>
                  <Text style={styles.value}>{diagnostics.trpcPing.error}</Text>
                </>
              )}
            </View>
          </View>
        )}

        <TouchableOpacity 
          style={styles.button} 
          onPress={runDiagnostics}
          disabled={testing}
        >
          <Text style={styles.buttonText}>
            {testing ? 'Testing...' : 'Run Diagnostics Again'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: COLORS.text,
    marginBottom: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  resultsContainer: {
    gap: 24,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: COLORS.text,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  value: {
    fontSize: 14,
    color: COLORS.text,
    fontFamily: 'monospace' as const,
  },
  success: {
    color: '#10b981',
  },
  error: {
    color: '#ef4444',
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
