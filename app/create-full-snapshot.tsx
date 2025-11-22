import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { trpc } from '@/lib/trpc';
import { useRouter } from 'expo-router';
import { ArrowLeft, Archive, CheckCircle } from 'lucide-react-native';

export default function CreateFullSnapshot() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const createBackupMutation = trpc.backup.create.useMutation();
  const cruisesQuery = trpc.cruises.list.useQuery({ limit: 10000, offset: 0 });

  const handleCreateSnapshot = async () => {
    setIsCreating(true);
    setResult(null);

    try {
      const backupResult = await createBackupMutation.mutateAsync({
        name: `Full Snapshot - ${new Date().toLocaleString()}`,
        description: `Complete backup with ${cruisesQuery.data?.total || 0} cruises and all data. Created on ${new Date().toLocaleString()}. This snapshot contains all cruises, offers, booked cruises, receipts, statements, financials, certificates, calendar events, user profile, settings, and thresholds.`,
        persistToDisk: true,
      });

      setResult(backupResult);
      console.log('[CreateFullSnapshot] Backup created:', backupResult);
    } catch (error) {
      console.error('[CreateFullSnapshot] Error creating backup:', error);
      setResult({ success: false, error: String(error) });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Create Full Snapshot</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Current Data Status</Text>
          
          {cruisesQuery.isLoading ? (
            <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
          ) : (
            <View style={styles.statsContainer}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Total Cruises:</Text>
                <Text style={styles.statValue}>{cruisesQuery.data?.total || 0}</Text>
              </View>
              <Text style={styles.infoText}>
                This will create a complete backup of all your data including cruises, offers, 
                booked cruises, receipts, statements, financials, certificates, calendar events, 
                user profile, settings, and thresholds.
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.createButton, isCreating && styles.buttonDisabled]}
          onPress={handleCreateSnapshot}
          disabled={isCreating || cruisesQuery.isLoading}
        >
          {isCreating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Archive size={24} color="#fff" />
          )}
          <Text style={styles.createButtonText}>
            {isCreating ? 'Creating Snapshot...' : 'Create Full Snapshot'}
          </Text>
        </TouchableOpacity>

        {result && (
          <View style={[styles.resultCard, result.success ? styles.successCard : styles.errorCard]}>
            {result.success ? (
              <>
                <CheckCircle size={32} color="#4CAF50" />
                <Text style={styles.resultTitle}>Snapshot Created Successfully!</Text>
                <Text style={styles.resultText}>Backup ID: {result.backupId}</Text>
                <Text style={styles.resultText}>Name: {result.name}</Text>
                <Text style={styles.resultText}>Timestamp: {new Date(result.timestamp).toLocaleString()}</Text>
                
                {result.stats && (
                  <View style={styles.statsBox}>
                    <Text style={styles.statsTitle}>Data Saved:</Text>
                    <Text style={styles.statItem}>• Cruises: {result.stats.cruises}</Text>
                    <Text style={styles.statItem}>• Booked Cruises: {result.stats.bookedCruises}</Text>
                    <Text style={styles.statItem}>• Casino Offers: {result.stats.casinoOffers}</Text>
                    <Text style={styles.statItem}>• Receipts: {result.stats.receipts}</Text>
                    <Text style={styles.statItem}>• Statements: {result.stats.statements}</Text>
                    <Text style={styles.statItem}>• Financials: {result.stats.financials}</Text>
                    <Text style={styles.statItem}>• Certificates: {result.stats.certificates}</Text>
                    <Text style={styles.statItem}>• Calendar Events: {result.stats.calendar}</Text>
                    <Text style={styles.statItem}>• Casino Performance: {result.stats.casinoPerformance}</Text>
                  </View>
                )}

                <Text style={styles.successNote}>
                  ✅ This snapshot has been saved to memory and persisted to disk at DATA/BACKUPS/{result.backupId}.json
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.resultTitle}>Error Creating Snapshot</Text>
                <Text style={styles.errorText}>{result.error || 'Unknown error occurred'}</Text>
              </>
            )}
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>About This Snapshot</Text>
          <Text style={styles.infoText}>
            • This creates a complete backup of ALL data in the app
          </Text>
          <Text style={styles.infoText}>
            • The snapshot is saved both in memory and to disk (DATA/BACKUPS folder)
          </Text>
          <Text style={styles.infoText}>
            • You can restore this snapshot later from the Backup Manager
          </Text>
          <Text style={styles.infoText}>
            • The snapshot includes: cruises, offers, booked cruises, receipts, statements, 
            financials, certificates, calendar events, user profile, settings, thresholds, 
            and all other app data
          </Text>
          <Text style={styles.infoText}>
            • This is your safety net - create it now while all data is loaded!
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  statsContainer: {
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statLabel: {
    fontSize: 16,
    color: '#666',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  loader: {
    marginVertical: 20,
  },
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  resultCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    gap: 12,
  },
  successCard: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  errorCard: {
    backgroundColor: '#FFEBEE',
    borderWidth: 2,
    borderColor: '#F44336',
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  resultText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  statsBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    marginTop: 8,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  statItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  successNote: {
    fontSize: 12,
    color: '#4CAF50',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
});
