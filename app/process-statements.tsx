import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { FileText, CheckCircle, AlertCircle, Wifi, WifiOff, RefreshCw } from 'lucide-react-native';
import { trpc, isBackendEnabled, backendStatus } from '@/lib/trpc';

export default function ProcessStatementsScreen() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [fileList, setFileList] = useState<{receipts: string[], statements: string[], total: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'failed'>('checking');
  
  const listFilesQuery = trpc.ocr.listDataFolderFiles.useQuery();
  const rescanMutation = trpc.ocr.rescanAndProcessDataFolders.useMutation();
  const pingQuery = trpc.ping.useQuery(undefined, {
    retry: 1,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (listFilesQuery.data) {
      setFileList(listFilesQuery.data);
      setLoading(false);
    }
  }, [listFilesQuery.data]);

  useEffect(() => {
    if (pingQuery.isSuccess) {
      console.log('[ProcessStatements] Backend connection successful');
      setConnectionStatus('connected');
    } else if (pingQuery.isError) {
      console.error('[ProcessStatements] Backend connection failed:', pingQuery.error);
      setConnectionStatus('failed');
    }
  }, [pingQuery.isSuccess, pingQuery.isError, pingQuery.error]);

  const handleTestConnection = async () => {
    console.log('[ProcessStatements] Testing backend connection...');
    setConnectionStatus('checking');
    
    try {
      await pingQuery.refetch();
    } catch (error) {
      console.error('[ProcessStatements] Connection test failed:', error);
      setConnectionStatus('failed');
    }
  };

  const refreshFileList = async () => {
    setLoading(true);
    await listFilesQuery.refetch();
  };

  const handleProcessStatements = async () => {
    if (connectionStatus !== 'connected') {
      Alert.alert(
        'Backend Connection Required',
        'Please ensure the backend is connected before processing statements.',
        [
          { text: 'Test Connection', onPress: handleTestConnection },
          { text: 'Cancel' }
        ]
      );
      return;
    }

    if (!fileList || fileList.total === 0) {
      Alert.alert('No Files Found', 'No files found in DATA/Receipts or DATA/Statements folders.');
      return;
    }

    setIsProcessing(true);
    setResults(null);
    
    console.log('[ProcessStatements] Starting rescan and process of DATA folders...');
    
    try {
      const result = await rescanMutation.mutateAsync({
        resetFinancials: true,
        resetReceiptsStatements: true
      });
      
      console.log('[ProcessStatements] Processing complete:', result);
      
      setResults(result);
      
      Alert.alert(
        'Processing Complete! ✅',
        `Successfully processed ${result.receiptsProcessed} receipts and ${result.statementsProcessed} statements.\n\nCreated ${result.cruisesCreated} new cruises, linked ${result.cruisesLinked} existing cruises.`,
        [
          {
            text: 'View Analytics',
            onPress: () => router.push('/(tabs)/(analytics)')
          },
          {
            text: 'View Cruises',
            onPress: () => router.push('/(tabs)/(cruises)')
          },
          { text: 'OK' }
        ]
      );
      
    } catch (error: any) {
      console.error('[ProcessStatements] Processing error:', error);
      Alert.alert('Processing Error', error.message || 'Failed to process files');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Process Files' }} />
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={styles.loadingText}>Scanning DATA folders...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{
          title: "Process All Files",
          headerBackTitle: "Back"
        }} 
      />
      <ScrollView style={styles.container}>
        {/* Header Section */}
        <View style={styles.section}>
          <Text style={styles.title}>Process All Files from DATA Folders</Text>
          <Text style={styles.description}>
            This will scan and process all files from DATA/Receipts and DATA/Statements folders:
            {"\n"}• Extract financial data and line items using AI OCR
            {"\n"}• Calculate Club Royale Entertainment charges
            {"\n"}• Match to existing cruises or create new ones
            {"\n"}• Populate the financials database for analytics
          </Text>
        </View>

        {/* File Count Summary */}
        <View style={styles.section}>
          <View style={styles.summaryRow}>
            <FileText size={20} color="#3B82F6" />
            <Text style={styles.summaryText}>
              Found {fileList?.receipts.length || 0} receipts and {fileList?.statements.length || 0} statements
            </Text>
            <TouchableOpacity onPress={refreshFileList} style={styles.refreshButton}>
              <RefreshCw size={16} color="#3B82F6" />
            </TouchableOpacity>
          </View>
          <Text style={styles.summarySubtext}>
            Total: {fileList?.total || 0} files ready for processing
          </Text>
        </View>

        {/* Connection Status */}
        <View style={styles.section}>
          <View style={styles.connectionStatus}>
            {connectionStatus === 'checking' ? (
              <ActivityIndicator size={16} color="#F59E0B" />
            ) : connectionStatus === 'connected' ? (
              <Wifi size={16} color="#22C55E" />
            ) : (
              <WifiOff size={16} color="#EF4444" />
            )}
            <Text style={[
              styles.connectionText,
              connectionStatus === 'connected' && styles.connectionTextSuccess,
              connectionStatus === 'failed' && styles.connectionTextError
            ]}>
              Backend: {connectionStatus === 'checking' ? 'Checking...' : 
                      connectionStatus === 'connected' ? 'Connected' : 'Connection Failed'}
            </Text>
            {connectionStatus === 'failed' && (
              <TouchableOpacity onPress={handleTestConnection} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.backendInfo}>
            Base URL: {backendStatus.baseUrl}
            {"\n"}Backend Enabled: {isBackendEnabled ? 'Yes' : 'No'}
          </Text>
        </View>

        {/* File Lists */}
        {fileList && fileList.receipts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Receipt Files ({fileList.receipts.length})</Text>
            {fileList.receipts.slice(0, 3).map((fileName, index) => (
              <View key={index} style={styles.statementItem}>
                <FileText size={16} color="#22C55E" />
                <Text style={styles.statementText}>{fileName}</Text>
              </View>
            ))}
            {fileList.receipts.length > 3 && (
              <Text style={styles.moreFiles}>...and {fileList.receipts.length - 3} more</Text>
            )}
          </View>
        )}

        {fileList && fileList.statements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Statement Files ({fileList.statements.length})</Text>
            {fileList.statements.slice(0, 3).map((fileName, index) => (
              <View key={index} style={styles.statementItem}>
                <FileText size={16} color="#3B82F6" />
                <Text style={styles.statementText}>{fileName}</Text>
              </View>
            ))}
            {fileList.statements.length > 3 && (
              <Text style={styles.moreFiles}>...and {fileList.statements.length - 3} more</Text>
            )}
          </View>
        )}

        {/* Process Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.processButton, 
              (isProcessing || connectionStatus !== 'connected' || !fileList || fileList.total === 0) && styles.buttonDisabled
            ]}
            onPress={handleProcessStatements}
            disabled={isProcessing || connectionStatus !== 'connected' || !fileList || fileList.total === 0}
            testID="process-statements-button"
          >
            {isProcessing ? (
              <ActivityIndicator size={20} color="#FFFFFF" />
            ) : (
              <CheckCircle size={20} color="#FFFFFF" />
            )}
            <Text style={styles.buttonText}>
              {isProcessing ? 'Processing Files...' : 
               connectionStatus !== 'connected' ? 'Backend Connection Required' :
               !fileList || fileList.total === 0 ? 'No Files Found' :
               `Process All ${fileList.total} Files`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Results Section */}
        {results && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Processing Results</Text>
            <Text style={styles.resultsSummary}>
              Receipts: {results.receiptsProcessed} | Statements: {results.statementsProcessed} | Cruises Created: {results.cruisesCreated} | Cruises Linked: {results.cruisesLinked}
            </Text>
            
            {results.errors && results.errors.length > 0 && (
              <View style={styles.errorsSection}>
                <Text style={styles.errorsTitle}>Errors ({results.errors.length})</Text>
                {results.errors.slice(0, 3).map((error: string, index: number) => (
                  <View key={index} style={styles.errorItem}>
                    <AlertCircle size={16} color="#EF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ))}
                {results.errors.length > 3 && (
                  <Text style={styles.moreErrors}>...and {results.errors.length - 3} more errors</Text>
                )}
              </View>
            )}
            
            {results.processedFiles && results.processedFiles.length > 0 && (
              <View style={styles.filesSection}>
                <Text style={styles.filesSectionTitle}>Processed Files ({results.processedFiles.length})</Text>
                {results.processedFiles.slice(0, 8).map((file: any, index: number) => (
                  <View key={index} style={[styles.processedFileItem, file.success ? styles.fileSuccess : styles.fileError]}>
                    {file.success ? (
                      <CheckCircle size={14} color="#22C55E" />
                    ) : (
                      <AlertCircle size={14} color="#EF4444" />
                    )}
                    <Text style={styles.processedFileName}>{file.fileName}</Text>
                    <Text style={styles.processedFileType}>({file.type})</Text>
                    {file.success && file.cruiseId && (
                      <Text style={styles.cruiseId}>→ {file.cruiseId.slice(0, 8)}</Text>
                    )}
                  </View>
                ))}
                {results.processedFiles.length > 8 && (
                  <Text style={styles.moreFiles}>...and {results.processedFiles.length - 8} more files</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.infoTitle}>What This Does</Text>
          <Text style={styles.infoText}>
            • Uses AI OCR to extract all financial data from each statement
            {"\n"}• Identifies and sums all &quot;Club Royale Entertainment Games&quot; charges
            {"\n"}• Extracts line items with dates, categories, and amounts
            {"\n"}• Matches statements to existing cruises by ship name and date
            {"\n"}• Creates new cruise records if no match is found
            {"\n"}• Populates analytics with real financial data for accurate reporting
          </Text>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginLeft: 8,
  },
  summarySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 28,
  },
  refreshButton: {
    padding: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  statementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  statementText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
  },
  moreFiles: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  processButton: {
    backgroundColor: '#22C55E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resultsSummary: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  errorsSection: {
    marginBottom: 16,
  },
  errorsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 8,
  },
  errorItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
    gap: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
  },
  moreErrors: {
    fontSize: 12,
    color: '#EF4444',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  filesSection: {
    marginTop: 16,
  },
  filesSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  processedFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
    gap: 6,
  },
  fileSuccess: {
    backgroundColor: '#F0FDF4',
  },
  fileError: {
    backgroundColor: '#FEF2F2',
  },
  processedFileName: {
    fontSize: 12,
    color: '#374151',
    flex: 1,
  },
  processedFileType: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
  cruiseId: {
    fontSize: 10,
    color: '#22C55E',
    fontWeight: '500',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  connectionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  connectionTextSuccess: {
    color: '#22C55E',
  },
  connectionTextError: {
    color: '#EF4444',
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  backendInfo: {
    fontSize: 10,
    color: '#9CA3AF',
    fontFamily: 'monospace',
  },
  errorContent: {
    flex: 1,
  },
  errorHint: {
    fontSize: 10,
    color: '#F59E0B',
    marginTop: 4,
    fontStyle: 'italic',
  },
});