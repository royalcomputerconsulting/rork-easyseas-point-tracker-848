import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { trpc } from '@/lib/trpc';
import { COLORS } from '@/constants/theme';
import { Database, CheckCircle, AlertCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function TestFinancialsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('');
  
  // Queries
  const countsQ = trpc.financials.countOverview.useQuery();
  const listQ = trpc.financials.list.useQuery();
  
  // Mutations
  const insertReceiptsMut = trpc.financials.insertHardcodedReceipts.useMutation({
    onSuccess: (result) => {
      setStatus(`✅ Inserted ${result.inserted} receipts`);
      countsQ.refetch();
      listQ.refetch();
    },
    onError: (error) => {
      setStatus(`❌ Failed to insert receipts: ${error.message}`);
    }
  });
  
  const insertStatementsMut = trpc.financials.insertHardcodedStatements.useMutation({
    onSuccess: (result) => {
      setStatus(`✅ Inserted ${result.inserted} statements`);
      countsQ.refetch();
      listQ.refetch();
    },
    onError: (error) => {
      setStatus(`❌ Failed to insert statements: ${error.message}`);
    }
  });
  
  const rebuildMut = trpc.financials.rebuildFromSources.useMutation({
    onSuccess: (result) => {
      setStatus(`✅ Rebuilt financials: ${result.inserted} records`);
      countsQ.refetch();
      listQ.refetch();
    },
    onError: (error) => {
      setStatus(`❌ Failed to rebuild: ${error.message}`);
    }
  });
  
  const loadFromCSVMut = trpc.financials.loadFromCSV.useMutation({
    onSuccess: (result) => {
      setStatus(`✅ Loaded ${result.inserted} records from CSV`);
      countsQ.refetch();
      listQ.refetch();
    },
    onError: (error) => {
      setStatus(`❌ Failed to load CSV: ${error.message}`);
    }
  });
  
  const handlePopulateAll = async () => {
    try {
      setStatus('🔄 Populating all data...');
      
      // Insert receipts
      const receiptsResult = await insertReceiptsMut.mutateAsync();
      console.log('Receipts inserted:', receiptsResult);
      
      // Insert statements
      const statementsResult = await insertStatementsMut.mutateAsync();
      console.log('Statements inserted:', statementsResult);
      
      // Rebuild financials
      const rebuildResult = await rebuildMut.mutateAsync();
      console.log('Financials rebuilt:', rebuildResult);
      
      setStatus(`✅ Successfully populated all data!`);
      Alert.alert('Success', 'Financials database has been populated with hardcoded data');
    } catch (error) {
      console.error('Failed to populate:', error);
      setStatus(`❌ Failed to populate: ${error}`);
    }
  };
  
  const financialRows = listQ.data || [];
  const receiptRows = financialRows.filter(r => r.sourceType === 'receipt');
  const statementRows = financialRows.filter(r => r.sourceType === 'statement');
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.title}>Test Financials Database</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>Back</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Database Status</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Database size={20} color={COLORS.primary} />
              <Text style={styles.statLabel}>Total Rows</Text>
              <Text style={styles.statValue}>{countsQ.data?.financialRows || 0}</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Receipts</Text>
              <Text style={styles.statValue}>{countsQ.data?.receipts || 0}</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Statements</Text>
              <Text style={styles.statValue}>{countsQ.data?.statements || 0}</Text>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>TripIt Events</Text>
              <Text style={styles.statValue}>{countsQ.data?.tripItEvents || 0}</Text>
            </View>
          </View>
          
          {status && (
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>{status}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handlePopulateAll}
            disabled={insertReceiptsMut.isPending || insertStatementsMut.isPending || rebuildMut.isPending}
          >
            <CheckCircle size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>
              {insertReceiptsMut.isPending || insertStatementsMut.isPending || rebuildMut.isPending
                ? 'Populating...'
                : 'Populate All Hardcoded Data'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.button}
            onPress={() => insertReceiptsMut.mutate()}
            disabled={insertReceiptsMut.isPending}
          >
            <Text style={styles.buttonTextSecondary}>
              {insertReceiptsMut.isPending ? 'Inserting...' : 'Insert Hardcoded Receipts Only'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.button}
            onPress={() => insertStatementsMut.mutate()}
            disabled={insertStatementsMut.isPending}
          >
            <Text style={styles.buttonTextSecondary}>
              {insertStatementsMut.isPending ? 'Inserting...' : 'Insert Hardcoded Statements Only'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.button}
            onPress={() => rebuildMut.mutate()}
            disabled={rebuildMut.isPending}
          >
            <Text style={styles.buttonTextSecondary}>
              {rebuildMut.isPending ? 'Rebuilding...' : 'Rebuild From Sources'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.successButton]}
            onPress={() => loadFromCSVMut.mutate()}
            disabled={loadFromCSVMut.isPending}
          >
            <Text style={styles.buttonText}>
              {loadFromCSVMut.isPending ? 'Loading...' : 'Load From CSV File (278 rows)'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Records Preview</Text>
          
          <Text style={styles.subTitle}>Receipt Records ({receiptRows.length})</Text>
          {receiptRows.slice(0, 3).map((row, idx) => (
            <View key={row.id || idx} style={styles.recordCard}>
              <Text style={styles.recordShip}>{row.shipName || 'Unknown Ship'}</Text>
              <Text style={styles.recordDetail}>Cruise: {row.cruiseId}</Text>
              <Text style={styles.recordDetail}>Amount: ${row.lineTotal || 0}</Text>
              <Text style={styles.recordDetail}>Date: {row.sailDateStart || 'N/A'}</Text>
            </View>
          ))}
          
          <Text style={[styles.subTitle, { marginTop: 16 }]}>Statement Records ({statementRows.length})</Text>
          {statementRows.slice(0, 3).map((row, idx) => (
            <View key={row.id || idx} style={styles.recordCard}>
              <Text style={styles.recordShip}>{row.shipName || 'Unknown Ship'}</Text>
              <Text style={styles.recordDetail}>Cruise: {row.cruiseId}</Text>
              <Text style={styles.recordDetail}>Amount: ${row.amount || 0}</Text>
              <Text style={styles.recordDetail}>Department: {row.department || 'N/A'}</Text>
            </View>
          ))}
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Navigation</Text>
          
          <TouchableOpacity
            style={[styles.button, styles.successButton]}
            onPress={() => router.push('/(tabs)/(analytics)')}
          >
            <Text style={styles.buttonText}>Go to Analytics Tab</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/unlinked')}
          >
            <Text style={styles.buttonTextSecondary}>View Unlinked Records</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  backButton: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: COLORS.white,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6E7C99',
    marginTop: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
  },
  statusBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  statusText: {
    fontSize: 13,
    color: COLORS.text,
  },
  button: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.divider,
    marginBottom: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  successButton: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  recordCard: {
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    marginBottom: 6,
  },
  recordShip: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  recordDetail: {
    fontSize: 11,
    color: '#6E7C99',
    marginTop: 2,
  },
});