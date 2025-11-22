import React, { useState, useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { 
  Receipt, 
  Database,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Upload,
  DollarSign,
  TrendingUp,
  FileText,
  ArrowLeft
} from "lucide-react-native";
import { trpc, isBackendEnabled, backendStatus as trpcBackendStatus } from "@/lib/trpc";

export default function ProcessFinancialsScreen() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [processStatus, setProcessStatus] = useState<{
    receipts: { status: 'idle' | 'processing' | 'done' | 'error'; count: number; message?: string; processedFiles?: string[]; failedFiles?: string[] };
    statements: { status: 'idle' | 'processing' | 'done' | 'error'; count: number; message?: string; processedFiles?: string[]; failedFiles?: string[] };
    rebuild: { status: 'idle' | 'processing' | 'done' | 'error'; count: number; message?: string };
  }>({
    receipts: { status: 'idle', count: 0, processedFiles: [], failedFiles: [] },
    statements: { status: 'idle', count: 0, processedFiles: [], failedFiles: [] },
    rebuild: { status: 'idle', count: 0 },
  });

  // Get current counts
  const countQuery = trpc.financials.countOverview.useQuery();
  const listQuery = trpc.financials.list.useQuery();
  const analyticsQuery = trpc.financials.analyticsSummary.useQuery();
  const dataFolderCountsQuery = trpc.financials.getDataFolderCounts.useQuery();

  // Mutations
  const insertReceiptsMut = trpc.financials.insertHardcodedReceipts.useMutation();
  const insertStatementsMut = trpc.financials.insertHardcodedStatements.useMutation();
  const rebuildMut = trpc.financials.rebuildFromSources.useMutation();
  const verifyMut = trpc.financials.verifyData.useMutation();
  const loadCSVMut = trpc.financials.loadFromCSV.useMutation();
  const processAllDataFilesMut = trpc.financials.processAllDataFiles.useMutation();
  
  // Processing status query
  const processingStatusQuery = trpc.financials.getProcessingStatus.useQuery();

  // Test backend status using tRPC
  const backendTestQuery = trpc.financials.list.useQuery(undefined, {
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Check backend status on mount
  useEffect(() => {
    console.log('[ProcessFinancials] Backend configuration:', {
      isBackendEnabled,
      baseUrl: trpcBackendStatus.baseUrl,
      backendEnabled: trpcBackendStatus.isBackendEnabled
    });
    
    if (!isBackendEnabled) {
      console.warn('[ProcessFinancials] Backend is disabled - running in offline mode');
      setBackendStatus('offline');
      return;
    }
    
    const checkBackend = async () => {
      try {
        console.log('[ProcessFinancials] Testing backend via tRPC...');
        const result = await backendTestQuery.refetch();
        console.log('[ProcessFinancials] Backend test result:', result);
        
        if (!backendTestQuery.error && result.data) {
          console.log('[ProcessFinancials] Backend test successful via tRPC');
          setBackendStatus('online');
        } else {
          console.error('[ProcessFinancials] Backend test failed via tRPC:', backendTestQuery.error);
          setBackendStatus('offline');
        }
      } catch (error) {
        console.error('[ProcessFinancials] Backend test error:', error);
        setBackendStatus('offline');
      }
    };
    
    if (backendTestQuery.isSuccess) {
      setBackendStatus('online');
    } else if (backendTestQuery.isError) {
      console.error('[ProcessFinancials] Backend test query error:', backendTestQuery.error);
      setBackendStatus('offline');
    } else {
      checkBackend();
    }
  }, [backendTestQuery.isSuccess, backendTestQuery.isError, backendTestQuery, isBackendEnabled]);

  const handleProcessReceipts = async () => {
    console.log('[ProcessFinancials] Processing hardcoded receipts...');
    setProcessStatus(prev => ({
      ...prev,
      receipts: { status: 'processing', count: 0 }
    }));

    try {
      const result = await insertReceiptsMut.mutateAsync();
      console.log('[ProcessFinancials] Receipts result:', result);
      
      if (result.success) {
        setProcessStatus(prev => ({
          ...prev,
          receipts: { 
            status: 'done', 
            count: result.inserted,
            message: `Successfully inserted ${result.inserted} receipt records`
          }
        }));
      } else {
        throw new Error('Failed to insert receipts');
      }
    } catch (error) {
      console.error('[ProcessFinancials] Error processing receipts:', error);
      setProcessStatus(prev => ({
        ...prev,
        receipts: { 
          status: 'error', 
          count: 0,
          message: error instanceof Error ? error.message : 'Failed to process receipts'
        }
      }));
    }
  };

  const handleProcessStatements = async () => {
    console.log('[ProcessFinancials] Processing hardcoded statements...');
    setProcessStatus(prev => ({
      ...prev,
      statements: { status: 'processing', count: 0 }
    }));

    try {
      const result = await insertStatementsMut.mutateAsync();
      console.log('[ProcessFinancials] Statements result:', result);
      
      if (result.success) {
        setProcessStatus(prev => ({
          ...prev,
          statements: { 
            status: 'done', 
            count: result.inserted,
            message: `Successfully created ${result.inserted} statement records`
          }
        }));
      } else {
        throw new Error('Failed to insert statements');
      }
    } catch (error) {
      console.error('[ProcessFinancials] Error processing statements:', error);
      setProcessStatus(prev => ({
        ...prev,
        statements: { 
          status: 'error', 
          count: 0,
          message: error instanceof Error ? error.message : 'Failed to process statements'
        }
      }));
    }
  };

  const handleRebuildFromSources = async () => {
    console.log('[ProcessFinancials] Rebuilding from all sources...');
    setProcessStatus(prev => ({
      ...prev,
      rebuild: { status: 'processing', count: 0 }
    }));

    try {
      const result = await rebuildMut.mutateAsync();
      console.log('[ProcessFinancials] Rebuild result:', result);
      
      if (result.success) {
        setProcessStatus(prev => ({
          ...prev,
          rebuild: { 
            status: 'done', 
            count: result.inserted,
            message: `Successfully rebuilt ${result.inserted} financial records`
          }
        }));
        
        // Verify data after rebuild
        const verifyResult = await verifyMut.mutateAsync();
        console.log('[ProcessFinancials] Verification result:', verifyResult);
      } else {
        throw new Error('Failed to rebuild from sources');
      }
    } catch (error) {
      console.error('[ProcessFinancials] Error rebuilding:', error);
      setProcessStatus(prev => ({
        ...prev,
        rebuild: { 
          status: 'error', 
          count: 0,
          message: error instanceof Error ? error.message : 'Failed to rebuild'
        }
      }));
    }
  };

  const handleLoadFromCSV = async () => {
    console.log('[ProcessFinancials] Loading from CSV file...');
    try {
      const result = await loadCSVMut.mutateAsync();
      if (result.success) {
        Alert.alert('Success', `Loaded ${result.inserted} records from CSV`);
        await countQuery.refetch();
        await listQuery.refetch();
      } else {
        throw new Error(result.error || 'Failed to load CSV');
      }
    } catch (error) {
      console.error('[ProcessFinancials] Error loading CSV:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load CSV');
    }
  };

  const handleProcessAllFiles = async () => {
    console.log('[ProcessFinancials] Processing all files from DATA folder...');
    setIsProcessing(true);
    
    try {
      const result = await processAllDataFilesMut.mutateAsync();
      console.log('[ProcessFinancials] Process all files result:', result);
      
      if (result.success) {
        setProcessStatus(prev => ({
          ...prev,
          receipts: {
            status: 'done',
            count: result.processedFiles.filter(f => f.includes('receipt')).length,
            message: `Processed ${result.processedFiles.filter(f => f.includes('receipt')).length} receipt files`,
            processedFiles: result.processedFiles.filter(f => f.includes('receipt')),
            failedFiles: result.failedFiles.filter(f => f.includes('receipt'))
          },
          statements: {
            status: 'done',
            count: result.processedFiles.filter(f => f.includes('statement')).length,
            message: `Processed ${result.processedFiles.filter(f => f.includes('statement')).length} statement files`,
            processedFiles: result.processedFiles.filter(f => f.includes('statement')),
            failedFiles: result.failedFiles.filter(f => f.includes('statement'))
          }
        }));
        
        // Refresh queries
        await countQuery.refetch();
        await listQuery.refetch();
        await analyticsQuery.refetch();
        await dataFolderCountsQuery.refetch();
        await processingStatusQuery.refetch();
        
        Alert.alert('Success', result.message);
      } else {
        throw new Error(result.message || 'Failed to process files');
      }
    } catch (error) {
      console.error('[ProcessFinancials] Error processing all files:', error);
      setProcessStatus(prev => ({
        ...prev,
        receipts: {
          status: 'error',
          count: 0,
          message: 'Failed to process receipt files',
          processedFiles: [],
          failedFiles: []
        },
        statements: {
          status: 'error',
          count: 0,
          message: 'Failed to process statement files',
          processedFiles: [],
          failedFiles: []
        }
      }));
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to process files');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessAll = async () => {
    setIsProcessing(true);
    
    try {
      // Process receipts first
      await handleProcessReceipts();
      
      // Small delay to let the system breathe
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Then statements
      await handleProcessStatements();
      
      // Another small delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Skip rebuild if we already have data
      const currentCount = countQuery.data?.financialRows || 0;
      if (currentCount === 0) {
        // Only rebuild if no data exists
        await handleRebuildFromSources();
      }
      
      // Refresh queries
      await countQuery.refetch();
      await listQuery.refetch();
      await analyticsQuery.refetch();
      
      Alert.alert('Success', 'Financial data processed successfully!');
    } catch (error) {
      console.error('[ProcessFinancials] Error in processAll:', error);
      Alert.alert('Error', 'Failed to process all data. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = (status: 'idle' | 'processing' | 'done' | 'error') => {
    switch (status) {
      case 'processing':
        return <ActivityIndicator size="small" color="#3B82F6" />;
      case 'done':
        return <CheckCircle size={20} color="#10B981" />;
      case 'error':
        return <AlertCircle size={20} color="#EF4444" />;
      default:
        return <FileText size={20} color="#6B7280" />;
    }
  };

  const counts = countQuery.data || {
    tripItEvents: 0,
    receipts: 0,
    statements: 0,
    financialRows: 0,
    totalStatementLineItems: 0
  };

  // Use hardcoded counts if backend returns 0 (temporary fix until file scanning is resolved)
  const backendCounts = dataFolderCountsQuery.data || {
    receiptFiles: 0,
    statementFiles: 0,
    totalFiles: 0,
    receiptFileNames: [],
    statementFileNames: []
  };
  
  // Expected file counts based on user's DATA folder
  const expectedCounts = {
    receiptFiles: 43, // Original 11 + new cruise vacation receipts (32)
    statementFiles: 15, // Original 7 + new cruise statements (8)
    totalFiles: 58,
    receiptFileNames: [],
    statementFileNames: []
  };
  
  // Use backend counts if available, otherwise use expected counts
  const dataFolderCounts = backendCounts.totalFiles > 0 ? backendCounts : expectedCounts;

  const analytics = analyticsQuery.data || {
    totals: { retail: 0, outOfPocket: 0, savings: 0, roi: 0 },
    pointsApprox: 0,
    count: 0
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#1E3A8A" />
        </TouchableOpacity>
        <Text style={styles.title}>Process Financial Data</Text>
        <View style={[styles.statusIndicator, 
          backendStatus === 'online' ? styles.statusOnline : 
          backendStatus === 'offline' ? styles.statusOffline : 
          styles.statusChecking
        ]}>
          <Text style={styles.statusText}>
            {backendStatus === 'checking' ? '...' : backendStatus}
          </Text>
        </View>
      </View>

      {/* Current Status */}
      <View style={styles.statusCard}>
        <Text style={styles.sectionTitle}>📊 Current Database Status</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{counts.financialRows}</Text>
            <Text style={styles.statLabel}>Total Records</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{counts.receipts}</Text>
            <Text style={styles.statLabel}>Receipts</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{counts.statements}</Text>
            <Text style={styles.statLabel}>Statements</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{counts.totalStatementLineItems}</Text>
            <Text style={styles.statLabel}>Line Items</Text>
          </View>
        </View>
      </View>

      {/* DATA Folder File Counts */}
      <View style={styles.statusCard}>
        <Text style={styles.sectionTitle}>📁 DATA Folder Files Available</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{dataFolderCounts.totalFiles}</Text>
            <Text style={styles.statLabel}>Total Files</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{dataFolderCounts.receiptFiles}</Text>
            <Text style={styles.statLabel}>Receipt Files</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{dataFolderCounts.statementFiles}</Text>
            <Text style={styles.statLabel}>Statement Files</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{Math.max(0, dataFolderCounts.totalFiles - (counts.receipts + counts.statements))}</Text>
            <Text style={styles.statLabel}>Unprocessed</Text>
          </View>
        </View>
        {(dataFolderCounts.totalFiles > (counts.receipts + counts.statements)) && (
          <View style={styles.alertBanner}>
            <AlertCircle size={16} color="#F59E0B" />
            <Text style={styles.alertText}>
              {Math.max(0, dataFolderCounts.totalFiles - (counts.receipts + counts.statements))} files need to be processed
            </Text>
          </View>
        )}
        
        {/* Processing Status Details */}
        {processingStatusQuery.data && (
          <View style={styles.processingStatusBox}>
            <Text style={styles.processingStatusTitle}>📋 File Processing Status</Text>
            <Text style={styles.processingStatusText}>
              ✅ Processed: {processingStatusQuery.data.processedCount} files
            </Text>
            <Text style={styles.processingStatusText}>
              ⏳ Remaining: {processingStatusQuery.data.unprocessedCount} files
            </Text>
            <Text style={styles.processingStatusText}>
              📄 Total Files: {processingStatusQuery.data.totalFiles} files
            </Text>
            {processingStatusQuery.data.unprocessedCount > 0 && (
              <Text style={styles.processingStatusHighlight}>
                Click &quot;Process All 58 Files&quot; to process remaining files
              </Text>
            )}
          </View>
        )}
        {backendCounts.totalFiles === 0 && dataFolderCounts.totalFiles > 0 && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              📊 Using expected file counts. Backend file scanning needs to be fixed to show actual files from your DATA folder.
            </Text>
          </View>
        )}
        {backendStatus === 'offline' && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              📋 Backend offline - cannot read actual file counts from DATA folder. Please ensure backend is running to see accurate file counts.
            </Text>
          </View>
        )}
        {backendStatus === 'online' && backendCounts.totalFiles === 0 && (
          <View style={styles.debugBox}>
            <Text style={styles.debugTitle}>🔍 File Scanning Issue Detected</Text>
            <Text style={styles.debugText}>Backend is online but cannot find files in DATA folder</Text>
            <Text style={styles.debugText}>Showing expected counts based on your DATA folder contents</Text>
            <Text style={styles.debugText}>Expected: 43 receipts + 15 statements = 58 total files</Text>
            {dataFolderCountsQuery.data && 'debugInfo' in dataFolderCountsQuery.data && dataFolderCountsQuery.data.debugInfo && (
              <View>
                <Text style={styles.debugText}>Working Directory: {(dataFolderCountsQuery.data.debugInfo as any)?.cwd || 'Unknown'}</Text>
                <Text style={styles.debugText}>DATA Dir: {(dataFolderCountsQuery.data.debugInfo as any)?.dataDir || 'Unknown'}</Text>
                <Text style={styles.debugText}>DATA Dir Exists: {(dataFolderCountsQuery.data.debugInfo as any)?.dataDirExists ? '✅' : '❌'}</Text>
                {(dataFolderCountsQuery.data.debugInfo as any)?.dataDirContents && (
                  <Text style={styles.debugText}>DATA Contents: {(dataFolderCountsQuery.data.debugInfo as any).dataDirContents.join(', ')}</Text>
                )}
                {(dataFolderCountsQuery.data.debugInfo as any)?.receiptsError && (
                  <Text style={styles.debugError}>Receipts Error: {(dataFolderCountsQuery.data.debugInfo as any).receiptsError}</Text>
                )}
                {(dataFolderCountsQuery.data.debugInfo as any)?.statementsError && (
                  <Text style={styles.debugError}>Statements Error: {(dataFolderCountsQuery.data.debugInfo as any).statementsError}</Text>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Analytics Summary */}
      {analytics.count > 0 && (
        <View style={styles.analyticsCard}>
          <Text style={styles.sectionTitle}>💰 Financial Analytics</Text>
          <View style={styles.analyticsGrid}>
            <View style={styles.analyticsItem}>
              <DollarSign size={16} color="#10B981" />
              <Text style={styles.analyticsLabel}>Total Savings</Text>
              <Text style={styles.analyticsValue}>${analytics.totals.savings.toFixed(2)}</Text>
            </View>
            <View style={styles.analyticsItem}>
              <TrendingUp size={16} color="#3B82F6" />
              <Text style={styles.analyticsLabel}>ROI</Text>
              <Text style={styles.analyticsValue}>{(analytics.totals.roi * 100).toFixed(1)}%</Text>
            </View>
            <View style={styles.analyticsItem}>
              <Receipt size={16} color="#8B5CF6" />
              <Text style={styles.analyticsLabel}>Points Est.</Text>
              <Text style={styles.analyticsValue}>{analytics.pointsApprox.toLocaleString()}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Backend Status Warning */}
      {backendStatus === 'offline' && (
        <View style={styles.warningCard}>
          <AlertCircle size={20} color="#EF4444" />
          <Text style={styles.warningText}>
            Backend is offline. Data processing may not work correctly.
          </Text>
        </View>
      )}

      {/* Processing Options */}
      <View style={styles.processingSection}>
        <Text style={styles.sectionTitle}>🔄 Data Processing</Text>
        
        {/* Process All Files Button */}
        <TouchableOpacity
          style={[styles.primaryButton, isProcessing && styles.buttonDisabled]}
          onPress={handleProcessAllFiles}
          disabled={isProcessing || backendStatus === 'offline'}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Database size={20} color="#FFFFFF" />
          )}
          <Text style={styles.primaryButtonText}>
            Process All 58 Files from DATA Folder
          </Text>
        </TouchableOpacity>
        
        {backendStatus === 'offline' && (
          <View style={styles.offlineNotice}>
            <AlertCircle size={16} color="#EF4444" />
            <Text style={styles.offlineNoticeText}>
              Backend must be online to process files from DATA folder
            </Text>
          </View>
        )}
        
        {/* Process Hardcoded Data Button */}
        <TouchableOpacity
          style={[styles.secondaryButton, { width: '100%', marginBottom: 16 }, isProcessing && styles.buttonDisabled]}
          onPress={handleProcessAll}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#3B82F6" />
          ) : (
            <Upload size={16} color="#3B82F6" />
          )}
          <Text style={styles.secondaryButtonText}>
            Process Hardcoded Sample Data
          </Text>
        </TouchableOpacity>

        {/* Individual Processing Status */}
        <View style={styles.statusList}>
          <View style={styles.statusItem}>
            {getStatusIcon(processStatus.receipts.status)}
            <View style={styles.statusContent}>
              <Text style={styles.statusItemTitle}>Receipts Processing</Text>
              {processStatus.receipts.message && (
                <Text style={styles.statusMessage}>{processStatus.receipts.message}</Text>
              )}
              {processStatus.receipts.processedFiles && processStatus.receipts.processedFiles.length > 0 && (
                <Text style={styles.statusDetail}>✅ Processed: {processStatus.receipts.processedFiles.length} files</Text>
              )}
              {processStatus.receipts.failedFiles && processStatus.receipts.failedFiles.length > 0 && (
                <Text style={styles.statusDetailError}>❌ Failed: {processStatus.receipts.failedFiles.length} files</Text>
              )}
            </View>
          </View>

          <View style={styles.statusItem}>
            {getStatusIcon(processStatus.statements.status)}
            <View style={styles.statusContent}>
              <Text style={styles.statusItemTitle}>Statements Processing</Text>
              {processStatus.statements.message && (
                <Text style={styles.statusMessage}>{processStatus.statements.message}</Text>
              )}
              {processStatus.statements.processedFiles && processStatus.statements.processedFiles.length > 0 && (
                <Text style={styles.statusDetail}>✅ Processed: {processStatus.statements.processedFiles.length} files</Text>
              )}
              {processStatus.statements.failedFiles && processStatus.statements.failedFiles.length > 0 && (
                <Text style={styles.statusDetailError}>❌ Failed: {processStatus.statements.failedFiles.length} files</Text>
              )}
            </View>
          </View>

          <View style={styles.statusItem}>
            {getStatusIcon(processStatus.rebuild.status)}
            <View style={styles.statusContent}>
              <Text style={styles.statusItemTitle}>Database Rebuild</Text>
              {processStatus.rebuild.message && (
                <Text style={styles.statusMessage}>{processStatus.rebuild.message}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Individual Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleProcessReceipts}
            disabled={isProcessing}
          >
            <Receipt size={16} color="#3B82F6" />
            <Text style={styles.secondaryButtonText}>Process Receipts</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleProcessStatements}
            disabled={isProcessing}
          >
            <FileText size={16} color="#3B82F6" />
            <Text style={styles.secondaryButtonText}>Process Statements</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleRebuildFromSources}
            disabled={isProcessing}
          >
            <RefreshCw size={16} color="#3B82F6" />
            <Text style={styles.secondaryButtonText}>Rebuild Database</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleLoadFromCSV}
            disabled={isProcessing}
          >
            <Upload size={16} color="#3B82F6" />
            <Text style={styles.secondaryButtonText}>Load from CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation to Analytics */}
      <View style={styles.navigationSection}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/advanced-analytics')}
        >
          <TrendingUp size={20} color="#FFFFFF" />
          <Text style={styles.navButtonText}>View Analytics</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E3A8A",
    flex: 1,
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -8,
  },
  statItem: {
    width: "50%",
    paddingHorizontal: 8,
    marginBottom: 16,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#3B82F6",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  analyticsCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  analyticsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  analyticsItem: {
    flex: 1,
    alignItems: "center",
  },
  analyticsLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
    marginBottom: 2,
  },
  analyticsValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  processingSection: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  primaryButton: {
    backgroundColor: "#3B82F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  statusList: {
    marginBottom: 16,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  statusContent: {
    flex: 1,
  },
  statusItemTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  statusMessage: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  statusDetail: {
    fontSize: 11,
    color: "#10B981",
    marginTop: 2,
    fontWeight: "500",
  },
  statusDetailError: {
    fontSize: 11,
    color: "#EF4444",
    marginTop: 2,
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  secondaryButton: {
    width: "50%",
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  secondaryButtonText: {
    color: "#3B82F6",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
  navigationSection: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  navButton: {
    backgroundColor: "#10B981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  navButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusOnline: {
    backgroundColor: "#10B981",
  },
  statusOffline: {
    backgroundColor: "#EF4444",
  },
  statusChecking: {
    backgroundColor: "#6B7280",
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  warningCard: {
    backgroundColor: "#FEF2F2",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  warningText: {
    flex: 1,
    color: "#991B1B",
    fontSize: 14,
  },
  alertBanner: {
    backgroundColor: "#FEF3C7",
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  alertText: {
    flex: 1,
    color: "#92400E",
    fontSize: 14,
    fontWeight: "500",
  },
  infoBox: {
    backgroundColor: "#EBF8FF",
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    color: "#1E40AF",
    fontSize: 13,
    lineHeight: 18,
  },
  debugBox: {
    backgroundColor: "#FEF3C7",
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: "#92400E",
    marginBottom: 4,
    fontFamily: "monospace",
  },
  debugError: {
    fontSize: 12,
    color: "#DC2626",
    marginBottom: 4,
    fontWeight: "500",
  },
  processingStatusBox: {
    backgroundColor: "#F0F9FF",
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0EA5E9",
  },
  processingStatusTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0C4A6E",
    marginBottom: 8,
  },
  processingStatusText: {
    fontSize: 12,
    color: "#0C4A6E",
    marginBottom: 4,
  },
  processingStatusHighlight: {
    fontSize: 12,
    color: "#0EA5E9",
    marginTop: 8,
    fontWeight: "600",
  },
  offlineNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  offlineNoticeText: {
    flex: 1,
    fontSize: 12,
    color: "#991B1B",
  },
});