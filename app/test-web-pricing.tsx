import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { COLORS } from '@/constants/theme';

export default function TestWebPricingScreen() {
  const [testResult, setTestResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const webPricingQuery = trpc.cruises.webPricing.useQuery(
    { forceRefresh: false },
    { enabled: false }
  );

  const handleTestWebPricing = async () => {
    setIsLoading(true);
    setTestResult('Testing web pricing...');
    
    try {
      const result = await webPricingQuery.refetch();
      
      if (result.data) {
        const summary = result.data.summary;
        setTestResult(
          `✅ Web Pricing Test Successful!\n\n` +
          `Cruises Checked: ${summary.totalCruisesChecked}\n` +
          `Total Alerts: ${summary.totalAlerts}\n` +
          `Price Drop Alerts: ${summary.priceDropAlerts}\n` +
          `Sources Used: ${summary.sourcesUsed.join(', ')}\n` +
          `Last Updated: ${new Date(summary.lastUpdated).toLocaleString()}\n\n` +
          `Results: ${result.data.results.length} cruise pricing records`
        );
      } else {
        setTestResult('❌ No data returned from web pricing');
      }
    } catch (error) {
      setTestResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Test Web Pricing',
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: '#FFFFFF'
        }} 
      />
      
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.title}>Web Pricing System Test</Text>
          <Text style={styles.description}>
            This page tests the web pricing functionality that fetches current cruise prices from multiple sources.
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleTestWebPricing}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Run Web Pricing Test</Text>
          )}
        </TouchableOpacity>

        {testResult ? (
          <View style={styles.resultContainer}>
            <Text style={styles.resultText}>{testResult}</Text>
          </View>
        ) : null}

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>How It Works:</Text>
          <Text style={styles.infoText}>
            • Fetches pricing from iCruise, RoyalPriceTracker, and CruiseMapper{'\n'}
            • Checks booked cruises and cruises departing in next 90 days{'\n'}
            • Detects price drops and generates alerts{'\n'}
            • Stores historical pricing data for past cruises{'\n'}
            • Caches results to avoid excessive API calls
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  resultText: {
    fontSize: 14,
    color: COLORS.text,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  infoSection: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});
