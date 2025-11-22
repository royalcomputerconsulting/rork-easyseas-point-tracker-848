import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { FileText, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react-native';

export default function ProcessReceiptsPage() {
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [fileList, setFileList] = useState<{receipts: string[], statements: string[], total: number} | null>(null);
  const [loading, setLoading] = useState(true);

  const listFilesQuery = trpc.ocr.listDataFolderFiles.useQuery();
  const fileCountQuery = trpc.ocr.getUnprocessedFileCount.useQuery();
  const debugQuery = trpc.ocr.debugFileSystem.useQuery();
  const rescanMutation = trpc.ocr.rescanAndProcessDataFolders.useMutation();

  useEffect(() => {
    if (listFilesQuery.data) {
      setFileList(listFilesQuery.data);
      setLoading(false);
    }
  }, [listFilesQuery.data]);

  const processReceipts = async () => {
    if (!fileList || fileList.receipts.length === 0) {
      Alert.alert('No Files Found', 'No receipt files found in DATA/Receipts folder.');
      return;
    }

    setProcessing(true);
    setResults(null);

    try {
      console.log('[ProcessReceipts] Starting rescan and process of DATA folders');
      const result = await rescanMutation.mutateAsync({
        resetFinancials: true,
        resetReceiptsStatements: true
      });

      setResults(result);
      
      if (result.success) {
        Alert.alert(
          'Success! ✅',
          `Processed ${result.receiptsProcessed} receipts and ${result.statementsProcessed} statements.\n\nCreated ${result.cruisesCreated} new cruises, linked ${result.cruisesLinked} existing cruises.`
        );
      } else {
        Alert.alert(
          'Processing Complete',
          `Some files failed to process. Check the results below.`
        );
      }
    } catch (error: any) {
      console.error('Error processing receipts:', error);
      Alert.alert('Error', error.message || 'Failed to process receipts. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const refreshFileList = async () => {
    setLoading(true);
    await Promise.all([
      listFilesQuery.refetch(),
      fileCountQuery.refetch()
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: 'Process Receipts' }} />
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Scanning DATA folders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Process Receipts & Statements' }} />
      
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Process All Files from DATA Folders</Text>
        <Text style={styles.subtitle}>
          This will scan and process all receipt and statement files from your DATA/Receipts and DATA/Statements folders, extract financial data using AI OCR, and populate the financials database.
        </Text>

        {/* File Count Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <FileText size={20} color="#007AFF" />
            <Text style={styles.summaryText}>
              Found {fileList?.receipts.length || 0} receipts and {fileList?.statements.length || 0} statements
            </Text>
            <TouchableOpacity onPress={refreshFileList} style={styles.refreshButton}>
              <RefreshCw size={16} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.summarySubtext}>
            Total: {fileList?.total || 0} files ready for processing
          </Text>
          
          {/* Enhanced File Count Information */}
          {fileCountQuery.data && (
            <View style={styles.enhancedCountCard}>
              <Text style={styles.enhancedCountTitle}>📊 Detailed File Analysis</Text>
              <View style={styles.countRow}>
                <Text style={styles.countLabel}>Total Files Available:</Text>
                <Text style={styles.countValue}>{fileCountQuery.data.totalFiles}</Text>
              </View>
              <View style={styles.countRow}>
                <Text style={styles.countLabel}>Already Processed:</Text>
                <Text style={styles.countValue}>{fileCountQuery.data.totalProcessed}</Text>
              </View>
              <View style={styles.countRow}>
                <Text style={styles.countLabel}>Unprocessed Files:</Text>
                <Text style={[styles.countValue, fileCountQuery.data.unprocessedCount > 0 ? styles.countHighlight : styles.countSuccess]}>
                  {fileCountQuery.data.unprocessedCount}
                </Text>
              </View>
              {fileCountQuery.data.unprocessedCount > 0 && (
                <View style={styles.actionNeededBanner}>
                  <AlertCircle size={16} color="#F59E0B" />
                  <Text style={styles.actionNeededText}>
                    {fileCountQuery.data.unprocessedCount} files need to be processed to add to current data
                  </Text>
                </View>
              )}
              <View style={styles.countBreakdown}>
                <Text style={styles.breakdownTitle}>Breakdown:</Text>
                <Text style={styles.breakdownText}>• Receipts: {fileCountQuery.data.receiptsFound} found, {fileCountQuery.data.processedReceipts} processed</Text>
                <Text style={styles.breakdownText}>• Statements: {fileCountQuery.data.statementsFound} found, {fileCountQuery.data.processedStatements} processed</Text>
                <Text style={styles.breakdownText}>• Data Source: {fileCountQuery.data.dataSource === 'local' ? 'Local DATA folder' : 'GitHub repository'}</Text>
              </View>
            </View>
          )}
          
          {listFilesQuery.data && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugTitle}>Debug Info:</Text>
              <Text style={styles.debugText}>Data Root: {listFilesQuery.data.dataRoot}</Text>
              <Text style={styles.debugText}>Receipts Dir: {listFilesQuery.data.receiptsDir}</Text>
              <Text style={styles.debugText}>Statements Dir: {listFilesQuery.data.statementsDir}</Text>
              <Text style={styles.debugText}>Source: {listFilesQuery.data.source}</Text>
            </View>
          )}
        </View>

        {/* File Lists */}
        {fileList && fileList.receipts.length > 0 && (
          <View style={styles.fileSection}>
            <Text style={styles.sectionTitle}>Receipt Files ({fileList.receipts.length})</Text>
            {fileList.receipts.slice(0, 5).map((fileName, index) => (
              <View key={index} style={styles.fileItem}>
                <FileText size={16} color="#22C55E" />
                <Text style={styles.fileName}>{fileName}</Text>
              </View>
            ))}
            {fileList.receipts.length > 5 && (
              <Text style={styles.moreFiles}>...and {fileList.receipts.length - 5} more</Text>
            )}
          </View>
        )}

        {fileList && fileList.statements.length > 0 && (
          <View style={styles.fileSection}>
            <Text style={styles.sectionTitle}>Statement Files ({fileList.statements.length})</Text>
            {fileList.statements.slice(0, 5).map((fileName, index) => (
              <View key={index} style={styles.fileItem}>
                <FileText size={16} color="#3B82F6" />
                <Text style={styles.fileName}>{fileName}</Text>
              </View>
            ))}
            {fileList.statements.length > 5 && (
              <Text style={styles.moreFiles}>...and {fileList.statements.length - 5} more</Text>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.processButton, (processing || !fileList || fileList.total === 0) && styles.processButtonDisabled]}
          onPress={processReceipts}
          disabled={processing || !fileList || fileList.total === 0}
        >
          {processing ? (
            <ActivityIndicator size={20} color="#FFFFFF" />
          ) : (
            <CheckCircle size={20} color="#FFFFFF" />
          )}
          <Text style={styles.processButtonText}>
            {processing ? 'Processing Files...' : 
             !fileList || fileList.total === 0 ? 'No Files Found' :
             `Process All ${fileList.total} Files`}
          </Text>
        </TouchableOpacity>

        {results && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Processing Results</Text>
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
                {results.processedFiles.slice(0, 10).map((file: any, index: number) => (
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
                {results.processedFiles.length > 10 && (
                  <Text style={styles.moreFiles}>...and {results.processedFiles.length - 10} more files</Text>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
  fileSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    marginBottom: 6,
  },
  fileName: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
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
    marginBottom: 20,
    gap: 8,
  },
  processButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  processButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  resultsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#111827',
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
  debugInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  debugText: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  enhancedCountCard: {
    backgroundColor: '#F0F9FF',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#0EA5E9',
  },
  enhancedCountTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0C4A6E',
    marginBottom: 12,
    textAlign: 'center',
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  countLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  countValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  countHighlight: {
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  countSuccess: {
    color: '#059669',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  actionNeededBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 6,
    marginTop: 8,
    marginBottom: 12,
    gap: 8,
  },
  actionNeededText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
  },
  countBreakdown: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#BAE6FD',
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0C4A6E',
    marginBottom: 6,
  },
  breakdownText: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 3,
    lineHeight: 16,
  },
});