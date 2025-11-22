import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { trpc } from '@/lib/trpc';

export default function TestPersistenceScreen() {
  const [status, setStatus] = React.useState<string>('Checking...');
  const [cruiseCount, setCruiseCount] = React.useState<number>(0);
  const [lastPersist, setLastPersist] = React.useState<string>('Unknown');

  const cruisesQuery = trpc.cruises.list.useQuery({ limit: 10000 });
  const createBackupMutation = trpc.backup.create.useMutation();
  const listBackupsQuery = trpc.backup.list.useQuery(undefined, { enabled: false });

  const checkStatus = async () => {
    try {
      setStatus('Fetching data from backend...');
      
      const result = await cruisesQuery.refetch();
      const cruises = result.data;
      const count = Array.isArray(cruises) ? cruises.length : cruises?.cruises?.length || 0;
      
      setCruiseCount(count);
      setStatus(`✅ Backend has ${count} cruises loaded`);
      setLastPersist(new Date().toLocaleString());
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const createSnapshot = async () => {
    try {
      setStatus('Creating snapshot...');
      
      const result = await createBackupMutation.mutateAsync({
        name: `Manual Snapshot - ${new Date().toLocaleString()}`,
        description: `Snapshot with ${cruiseCount} cruises`,
        persistToDisk: true
      });
      
      if (result.success) {
        Alert.alert('Success', `Snapshot created with ${result.stats?.cruises || 0} cruises`);
        setStatus(`✅ Snapshot created: ${result.backupId}`);
      } else {
        Alert.alert('Error', result.error || 'Failed to create snapshot');
        setStatus(`❌ Failed to create snapshot`);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
      setStatus(`❌ Error creating snapshot: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  };

  const listBackups = async () => {
    try {
      setStatus('Listing backups...');
      
      const result = await listBackupsQuery.refetch();
      const backups = result.data;
      
      if (backups && Array.isArray(backups) && backups.length > 0) {
        const backupList = backups.map((b: any) => 
          `${b.name} (${b.stats?.cruises || 0} cruises)`
        ).join('\n');
        
        Alert.alert('Available Backups', backupList);
        setStatus(`✅ Found ${backups.length} backups`);
      } else {
        Alert.alert('No Backups', 'No backups found');
        setStatus('⚠️ No backups found');
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
      setStatus(`❌ Error listing backups`);
    }
  };

  React.useEffect(() => {
    if (cruisesQuery.data) {
      const count = Array.isArray(cruisesQuery.data) ? cruisesQuery.data.length : cruisesQuery.data?.cruises?.length || 0;
      setCruiseCount(count);
      setStatus(`✅ Backend has ${count} cruises loaded`);
      setLastPersist(new Date().toLocaleString());
    }
  }, [cruisesQuery.data]);

  React.useEffect(() => {
    if (cruisesQuery.error) {
      setStatus(`❌ Error: ${cruisesQuery.error.message}`);
    }
  }, [cruisesQuery.error]);

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Persistence Test',
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff'
        }} 
      />
      
      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Backend Status</Text>
          <Text style={styles.status}>{status}</Text>
          <Text style={styles.info}>Cruises in memory: {cruiseCount}</Text>
          <Text style={styles.info}>Last checked: {lastPersist}</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={checkStatus}>
            <Text style={styles.buttonText}>🔄 Refresh Status</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]} 
            onPress={createSnapshot}
          >
            <Text style={styles.buttonText}>💾 Save Snapshot Now</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={listBackups}>
            <Text style={styles.buttonText}>📋 List Backups</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ℹ️ About Persistence</Text>
          <Text style={styles.infoText}>
            • The backend stores data in memory{'\n'}
            • Data is auto-saved to persist.json every 10 seconds{'\n'}
            • On reload, data is loaded from persist.json{'\n'}
            • If persist.json doesn't exist, data loads from DATA folder{'\n'}
            • Use "Save Snapshot" to manually persist current state
          </Text>
        </View>

        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>⚠️ If Data Disappears on Reload</Text>
          <Text style={styles.warningText}>
            1. Click "Save Snapshot Now" after loading data{'\n'}
            2. Check that persist.json was created in DATA folder{'\n'}
            3. Verify file permissions allow writing{'\n'}
            4. Check backend logs for persistence errors
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1e',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  status: {
    fontSize: 16,
    color: '#4ade80',
    marginBottom: 8,
    fontFamily: 'monospace' as any,
  },
  info: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2a2a3e',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a3a4e',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderColor: '#2563eb',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  warningCard: {
    backgroundColor: '#422006',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fbbf24',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#fde68a',
    lineHeight: 20,
  },
});
