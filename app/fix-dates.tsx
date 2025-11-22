import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Calendar, CheckCircle, AlertCircle } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function FixDatesScreen() {
  const insets = useSafeAreaInsets();
  const [isRunning, setIsRunning] = React.useState(false);
  const [result, setResult] = React.useState<{ success: boolean; fixedCount: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fixDatesMutation = trpc.cruises.fixDates.useMutation();

  const handleFixDates = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fixDatesMutation.mutateAsync();
      setResult(res);
      console.log('[FixDates] Migration complete:', res);
    } catch (err) {
      console.error('[FixDates] Migration failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
          testID="back-button"
        >
          <ArrowLeft size={24} color="#6C5CE7" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fix Cruise Dates</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.content}>
        <View style={styles.infoCard}>
          <Calendar size={48} color="#6C5CE7" />
          <Text style={styles.infoTitle}>Date Migration Tool</Text>
          <Text style={styles.infoText}>
            This tool will fix cruise dates that have 2-digit years (like &quot;03&quot;) and convert them to the correct 4-digit years (like &quot;2025&quot;).
          </Text>
          <Text style={styles.infoText}>
            This is safe to run multiple times - it will only update dates that need fixing.
          </Text>
        </View>

        {!result && !error && (
          <TouchableOpacity
            style={[styles.button, isRunning && styles.buttonDisabled]}
            onPress={handleFixDates}
            disabled={isRunning}
            testID="fix-dates-button"
          >
            {isRunning ? (
              <>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.buttonText}>Running Migration...</Text>
              </>
            ) : (
              <>
                <Calendar size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>Fix Dates</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {result && (
          <View style={styles.resultCard}>
            <CheckCircle size={48} color="#10B981" />
            <Text style={styles.resultTitle}>Migration Complete!</Text>
            <Text style={styles.resultText}>
              Fixed {result.fixedCount} cruise{result.fixedCount !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                setResult(null);
                setError(null);
              }}
              testID="run-again-button"
            >
              <Calendar size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Run Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {error && (
          <View style={styles.errorCard}>
            <AlertCircle size={48} color="#EF4444" />
            <Text style={styles.errorTitle}>Migration Failed</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                setResult(null);
                setError(null);
              }}
              testID="try-again-button"
            >
              <Calendar size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#111827',
  },
  headerRight: {
    width: 40,
  },
  content: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
    marginTop: 16,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  resultText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    lineHeight: 20,
  },
});
