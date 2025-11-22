import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { getBaseUrl, isBackendEnabled, backendStatus } from '@/lib/trpc';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { RefreshCw } from 'lucide-react-native';

export default function ConnectionStatusScreen() {
  const [testResult, setTestResult] = React.useState<string>('Not tested');
  const [isTesting, setIsTesting] = React.useState(false);

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult('Testing...');
    
    try {
      const baseUrl = getBaseUrl();
      const healthUrl = `${baseUrl}/api/health`;
      
      console.log('[ConnectionStatus] Testing connection to:', healthUrl);
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      const text = await response.text();
      console.log('[ConnectionStatus] Response:', text);
      
      if (response.ok) {
        setTestResult(`✅ Connected successfully!\n\nStatus: ${response.status}\nResponse: ${text.substring(0, 200)}`);
      } else {
        setTestResult(`❌ Connection failed\n\nStatus: ${response.status}\nResponse: ${text.substring(0, 200)}`);
      }
    } catch (error: any) {
      console.error('[ConnectionStatus] Test failed:', error);
      setTestResult(`❌ Connection error\n\n${error?.message || 'Unknown error'}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Connection Status' }} />
      <ScrollView style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backend Status</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.label}>Enabled:</Text>
              <Text style={[styles.value, isBackendEnabled ? styles.success : styles.error]}>
                {isBackendEnabled ? '✅ Yes' : '❌ No (Offline Mode)'}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.label}>Base URL:</Text>
              <Text style={styles.value}>{backendStatus.baseUrl}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.label}>Platform:</Text>
              <Text style={styles.value}>{Platform.OS}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Environment</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.label}>EXPO_PUBLIC_RORK_API_BASE_URL:</Text>
              <Text style={styles.value}>
                {process.env.EXPO_PUBLIC_RORK_API_BASE_URL || '(not set)'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expo Constants</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.label}>hostUri:</Text>
              <Text style={styles.value}>
                {(Constants.expoConfig as any)?.hostUri || '(not available)'}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.label}>debuggerHost:</Text>
              <Text style={styles.value}>
                {(Constants.manifest2 as any)?.extra?.expoGo?.debuggerHost || 
                 (Constants as any).manifest?.debuggerHost || 
                 '(not available)'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection Test</Text>
          <TouchableOpacity 
            style={[styles.testButton, isTesting && styles.testButtonDisabled]}
            onPress={testConnection}
            disabled={isTesting}
          >
            <RefreshCw size={20} color="#FFFFFF" />
            <Text style={styles.testButtonText}>
              {isTesting ? 'Testing...' : 'Test Connection'}
            </Text>
          </TouchableOpacity>
          
          <View style={styles.resultCard}>
            <Text style={styles.resultText}>{testResult}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How to Fix</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              If the backend is not connecting, you have two options:
            </Text>
            <Text style={styles.infoText}>
              {'\n'}1. <Text style={styles.bold}>Use Offline Mode</Text> (Current)
              {'\n'}   • All data is stored locally on your device
              {'\n'}   • No backend connection required
              {'\n'}   • Import data using the Import button
            </Text>
            <Text style={styles.infoText}>
              {'\n'}2. <Text style={styles.bold}>Enable Backend</Text>
              {'\n'}   • Set EXPO_PUBLIC_RORK_API_BASE_URL environment variable
              {'\n'}   • Restart the app
              {'\n'}   • Backend features will be available
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusRow: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    fontWeight: '600',
  },
  value: {
    fontSize: 14,
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  success: {
    color: '#10B981',
  },
  error: {
    color: '#EF4444',
  },
  testButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  testButtonDisabled: {
    opacity: 0.6,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resultCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
  },
  resultText: {
    fontSize: 14,
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
  },
  backButton: {
    backgroundColor: '#6B7280',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
