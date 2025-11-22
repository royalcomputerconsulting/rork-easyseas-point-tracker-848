import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

import { useAppState } from '@/state/AppStateProvider';
import { STATIC_BOOKED_CRUISES } from '@/state/staticBooked';

export default function TestStartupScreen() {
  const { localData, hasLocalData, isLoading } = useAppState();
  const [testResults, setTestResults] = React.useState<any[]>([]);
  

  
  const runTests = React.useCallback(async () => {
    const results = [];
    
    // Test 1: App State
    results.push({
      test: 'App State Loading',
      status: isLoading ? 'LOADING' : 'COMPLETE',
      data: {
        hasLocalData,
        localCruisesCount: localData.cruises?.length || 0,
        localBookedCount: localData.booked?.length || 0,
      }
    });
    
    // Test 2: Static Data
    results.push({
      test: 'Static Booked Cruises',
      status: 'OK',
      data: {
        staticCount: STATIC_BOOKED_CRUISES.length,
        futureCount: STATIC_BOOKED_CRUISES.filter(c => new Date(c.startDate || '') > new Date()).length,
        pastCount: STATIC_BOOKED_CRUISES.filter(c => new Date(c.startDate || '') < new Date()).length,
      }
    });
    
    // Test 3: Backend Status
    results.push({
      test: 'Backend Status',
      status: 'DISABLED',
      data: 'Backend is disabled - app runs in offline mode with static data'
    });
    
    // Test 4: Booked Cruises Query
    results.push({
      test: 'Booked Cruises tRPC',
      status: 'DISABLED',
      data: {
        count: 0,
        error: 'Backend disabled - using static data',
        hasData: false
      }
    });
    
    // Test 5: Direct Booked Query
    results.push({
      test: 'Direct Booked Cruises tRPC',
      status: 'DISABLED',
      data: {
        count: 0,
        error: 'Backend disabled - using static data',
        hasData: false
      }
    });
    
    setTestResults(results);
  }, [isLoading, hasLocalData, localData.cruises, localData.booked]);
  
  React.useEffect(() => {
    runTests();
  }, [isLoading, hasLocalData, runTests]);
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OK': return '#22C55E';
      case 'LOADING': return '#F59E0B';
      case 'ERROR': return '#EF4444';
      case 'DISABLED': return '#9CA3AF';
      default: return '#6B7280';
    }
  };
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔧 Startup Diagnostics</Text>
        <Text style={styles.subtitle}>Testing booked cruises startup process</Text>
      </View>
      
      <TouchableOpacity style={styles.refreshButton} onPress={runTests}>
        <Text style={styles.refreshText}>🔄 Refresh Tests</Text>
      </TouchableOpacity>
      
      {testResults.map((result, index) => (
        <View key={index} style={styles.testCard}>
          <View style={styles.testHeader}>
            <Text style={styles.testName}>{result.test}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(result.status) }]}>
              <Text style={styles.statusText}>{result.status}</Text>
            </View>
          </View>
          
          <View style={styles.testData}>
            <Text style={styles.dataText}>{JSON.stringify(result.data, null, 2)}</Text>
          </View>
        </View>
      ))}
      
      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => router.push('/(tabs)/(booked)')}
        >
          <Text style={styles.actionText}>📋 Go to Booked Cruises</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => router.push('/import')}
        >
          <Text style={styles.actionText}>📥 Import Data</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: '#3B82F6',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  refreshText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  testCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  testName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  testData: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
  },
  dataText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#374151',
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});