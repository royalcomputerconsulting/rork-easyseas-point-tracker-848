import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { trpc } from '@/lib/trpc';
import { ArrowLeft, Archive, RotateCcw, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function BackupManager() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupName, setBackupName] = useState('');
  const [backupDescription, setBackupDescription] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [persistToDisk] = useState(true);

  const backupsQuery = trpc.backup.list.useQuery();
  const createBackupMutation = trpc.backup.create.useMutation();
  const restoreBackupMutation = trpc.backup.restore.useMutation();

  const handleCreateBackup = async () => {
    if (!backupName.trim()) {
      Alert.alert('Error', 'Please enter a backup name');
      return;
    }

    setIsCreating(true);
    try {
      const result = await createBackupMutation.mutateAsync({
        name: backupName.trim(),
        description: backupDescription.trim() || undefined,
        persistToDisk,
      });

      if (result.success) {
        const stats = result.stats as any || {};
        Alert.alert(
          'Backup Created',
          `Successfully created backup "${result.name}"\n\nData saved:\n• ${stats.cruises || 0} cruises\n• ${stats.bookedCruises || 0} booked cruises\n• ${stats.casinoOffers || 0} casino offers\n• ${stats.receipts || 0} receipts\n• ${stats.statements || 0} statements\n• ${stats.financials || 0} financial records\n• ${stats.certificates || 0} certificates\n• ${stats.calendar || 0} calendar events`,
          [{ text: 'OK' }]
        );
        setBackupName('');
        setBackupDescription('');
        setShowCreateForm(false);
        await backupsQuery.refetch();
      } else {
        Alert.alert('Error', result.error || 'Failed to create backup');
      }
    } catch (error) {
      console.error('[BackupManager] Create backup error:', error);
      Alert.alert('Error', 'Failed to create backup');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestoreBackup = async (backupId: string, backupName: string) => {
    Alert.alert(
      'Restore Backup',
      `Are you sure you want to restore "${backupName}"? This will replace all current data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setIsRestoring(true);
            try {
              const result = await restoreBackupMutation.mutateAsync({ backupId });

              if (result.success) {
                Alert.alert(
                  'Backup Restored',
                  result.message || 'Successfully restored backup',
                  [{ text: 'OK' }]
                );
                await backupsQuery.refetch();
              } else {
                Alert.alert('Error', result.error || 'Failed to restore backup');
              }
            } catch (error) {
              console.error('[BackupManager] Restore backup error:', error);
              Alert.alert('Error', 'Failed to restore backup');
            } finally {
              setIsRestoring(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Backup Manager</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Create Backup Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Create New Backup</Text>
            <TouchableOpacity
              onPress={() => setShowCreateForm(!showCreateForm)}
              style={styles.toggleButton}
            >
              <Plus size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>

          {showCreateForm && (
            <View style={styles.createForm}>
              <TextInput
                style={styles.input}
                placeholder="Backup Name"
                value={backupName}
                onChangeText={setBackupName}
                editable={!isCreating}
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (optional)"
                value={backupDescription}
                onChangeText={setBackupDescription}
                multiline
                numberOfLines={3}
                editable={!isCreating}
              />
              <TouchableOpacity
                style={[styles.createButton, isCreating && styles.buttonDisabled]}
                onPress={handleCreateBackup}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Archive size={20} color="#fff" />
                )}
                <Text style={styles.createButtonText}>
                  {isCreating ? 'Creating...' : 'Create Backup'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Backups List */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Available Backups</Text>

          {backupsQuery.isLoading ? (
            <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
          ) : backupsQuery.data?.backups && backupsQuery.data.backups.length > 0 ? (
            backupsQuery.data.backups.map((backup) => (
              <View key={backup.id} style={styles.backupItem}>
                <View style={styles.backupInfo}>
                  <Text style={styles.backupName}>{backup.name}</Text>
                  {backup.description && (
                    <Text style={styles.backupDescription}>{backup.description}</Text>
                  )}
                  <Text style={styles.backupDate}>{formatDate(backup.timestamp)}</Text>
                  <View style={styles.backupStats}>
                    <Text style={styles.statText}>
                      Cruises: {backup.stats?.cruises || 0}
                    </Text>
                    <Text style={styles.statText}>
                      Offers: {(backup.stats as any)?.casinoOffers || 0}
                    </Text>
                    <Text style={styles.statText}>
                      Booked: {backup.stats?.bookedCruises || 0}
                    </Text>
                    <Text style={styles.statText}>
                      Financials: {(backup.stats as any)?.financials || 0}
                    </Text>
                    <Text style={styles.statText}>
                      Certificates: {(backup.stats as any)?.certificates || 0}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.restoreButton, isRestoring && styles.buttonDisabled]}
                  onPress={() => handleRestoreBackup(backup.id, backup.name)}
                  disabled={isRestoring}
                >
                  <RotateCcw size={18} color="#007AFF" />
                  <Text style={styles.restoreButtonText}>Restore</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No backups available</Text>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>About Backups</Text>
          <Text style={styles.infoText}>
            • Backups save ALL data: cruises, offers, booked cruises, receipts, statements, financials, certificates, calendar events, user profile, settings, and thresholds
          </Text>
          <Text style={styles.infoText}>
            • Restoring a backup will replace all current data with the backup data
          </Text>
          <Text style={styles.infoText}>
            • A snapshot is automatically created before restoring (for rollback)
          </Text>
          <Text style={styles.infoText}>
            • Backups can be persisted to disk (DATA/BACKUPS folder) for permanent storage
          </Text>
          <Text style={styles.infoText}>
            • Data automatically persists to DATA/persist.json on every change
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  toggleButton: {
    padding: 4,
  },
  createForm: {
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loader: {
    marginVertical: 20,
  },
  backupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backupInfo: {
    flex: 1,
    marginRight: 12,
  },
  backupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  backupDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  backupDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  backupStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statText: {
    fontSize: 12,
    color: '#666',
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 6,
  },
  restoreButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginVertical: 20,
  },
  infoCard: {
    backgroundColor: '#f0f8ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 20,
  },
});