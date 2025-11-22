import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { FileText, RefreshCw } from 'lucide-react-native';

export default function DebugFilesPage() {
  const [loading, setLoading] = useState(false);
  const debugQuery = trpc.ocr.debugFileSystem.useQuery();
  const listFilesQuery = trpc.ocr.listDataFolderFiles.useQuery();

  const refresh = async () => {
    setLoading(true);
    await Promise.all([
      debugQuery.refetch(),
      listFilesQuery.refetch()
    ]);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Debug File System' }} />
      
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>File System Debug</Text>
          <TouchableOpacity onPress={refresh} style={styles.refreshButton} disabled={loading}>
            {loading ? (
              <ActivityIndicator size={16} color="#007AFF" />
            ) : (
              <RefreshCw size={16} color="#007AFF" />
            )}
          </TouchableOpacity>
        </View>

        {debugQuery.data && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Working Directories</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Current Working Directory:</Text>
              <Text style={styles.infoValue}>{debugQuery.data.cwd}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Module Directory:</Text>
              <Text style={styles.infoValue}>{debugQuery.data.moduleDir}</Text>
            </View>
          </View>
        )}

        {debugQuery.data?.pathResults && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Path Test Results</Text>
            {debugQuery.data.pathResults.map((result, index) => (
              <View key={index} style={[styles.pathCard, result.exists ? styles.pathExists : styles.pathMissing]}>
                <Text style={styles.pathText}>{result.path}</Text>
                <View style={styles.pathStatus}>
                  <Text style={[styles.statusText, result.exists ? styles.existsText : styles.missingText]}>
                    {result.exists ? '✅ EXISTS' : '❌ MISSING'}
                  </Text>
                  {result.isDirectory && (
                    <Text style={styles.dirText}>📁 Directory</Text>
                  )}
                </View>
                {result.files && result.files.length > 0 && (
                  <View style={styles.filesContainer}>
                    <Text style={styles.filesTitle}>Files ({result.files.length}):</Text>
                    {result.files.map((file, fileIndex) => (
                      <Text key={fileIndex} style={styles.fileName}>• {file}</Text>
                    ))}
                  </View>
                )}
                {result.error && (
                  <Text style={styles.errorText}>Error: {result.error}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {listFilesQuery.data && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>List Files Result</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Data Root:</Text>
              <Text style={styles.infoValue}>{listFilesQuery.data.dataRoot}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Receipts Dir:</Text>
              <Text style={styles.infoValue}>{listFilesQuery.data.receiptsDir}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Statements Dir:</Text>
              <Text style={styles.infoValue}>{listFilesQuery.data.statementsDir}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Source:</Text>
              <Text style={styles.infoValue}>{listFilesQuery.data.source}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Total Files:</Text>
              <Text style={styles.infoValue}>{listFilesQuery.data.total}</Text>
            </View>
            
            {listFilesQuery.data.receipts.length > 0 && (
              <View style={styles.filesList}>
                <Text style={styles.filesListTitle}>Receipts ({listFilesQuery.data.receipts.length}):</Text>
                {listFilesQuery.data.receipts.slice(0, 10).map((file, index) => (
                  <View key={index} style={styles.fileItem}>
                    <FileText size={14} color="#22C55E" />
                    <Text style={styles.fileItemText}>{file}</Text>
                  </View>
                ))}
                {listFilesQuery.data.receipts.length > 10 && (
                  <Text style={styles.moreFiles}>...and {listFilesQuery.data.receipts.length - 10} more</Text>
                )}
              </View>
            )}
            
            {listFilesQuery.data.statements.length > 0 && (
              <View style={styles.filesList}>
                <Text style={styles.filesListTitle}>Statements ({listFilesQuery.data.statements.length}):</Text>
                {listFilesQuery.data.statements.slice(0, 10).map((file, index) => (
                  <View key={index} style={styles.fileItem}>
                    <FileText size={14} color="#3B82F6" />
                    <Text style={styles.fileItemText}>{file}</Text>
                  </View>
                ))}
                {listFilesQuery.data.statements.length > 10 && (
                  <Text style={styles.moreFiles}>...and {listFilesQuery.data.statements.length - 10} more</Text>
                )}
              </View>
            )}
          </View>
        )}

        {(debugQuery.isLoading || listFilesQuery.isLoading) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading debug info...</Text>
          </View>
        )}

        {(debugQuery.error || listFilesQuery.error) && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorMessage}>
              {debugQuery.error?.message || listFilesQuery.error?.message}
            </Text>
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
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  refreshButton: {
    padding: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontFamily: 'monospace',
  },
  pathCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  pathExists: {
    borderColor: '#22C55E',
    backgroundColor: '#F0FDF4',
  },
  pathMissing: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  pathText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#111827',
    marginBottom: 8,
  },
  pathStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  existsText: {
    color: '#22C55E',
  },
  missingText: {
    color: '#EF4444',
  },
  dirText: {
    fontSize: 12,
    color: '#6B7280',
  },
  filesContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  filesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  fileName: {
    fontSize: 11,
    color: '#374151',
    fontFamily: 'monospace',
  },
  filesList: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filesListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 6,
  },
  fileItemText: {
    fontSize: 12,
    color: '#374151',
    fontFamily: 'monospace',
  },
  moreFiles: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#DC2626',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
});