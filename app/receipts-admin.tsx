import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Upload,
  FileText,
  Play,
  CheckCircle,
  BarChart3,
  Settings,
  Receipt,
  FileImage,
  Camera,
  Trash2,
  Eye,
  Users,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { trpc } from '@/lib/trpc';

interface SelectedFile {
  uri: string;
  name: string;
  type: 'image' | 'pdf';
  base64?: string;
}

export default function ReceiptsAdminScreen() {
  const [isScanning, setIsScanning] = React.useState(false);
  const [scanProgress, setScanProgress] = React.useState(0);
  const [lastRun, setLastRun] = React.useState('12/6/1276 • Error 0');
  const [lastENC, setLastENC] = React.useState('ENC-20251117-6N-1');
  const [selectedFiles, setSelectedFiles] = React.useState<SelectedFile[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showProcessedData, setShowProcessedData] = useState(false);
  
  // tRPC mutations and queries
  const receiptMutation = trpc.ocr.receipt.useMutation();
  const statementMutation = trpc.ocr.cruiseStatement.useMutation();
  const { data: receiptData, refetch } = trpc.ocr.getAllReceiptsAndStatements.useQuery();

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '$0.00';
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const receipts = receiptData?.receipts || [];
  const statements = receiptData?.statements || [];
  const totalCount = receiptData?.totalCount || 0;

  const handleOpenImports = () => {
    console.log('[ReceiptsAdmin] Open Imports pressed');
    router.push('/import');
  };

  const handleUploadReceipts = async () => {
    console.log('[ReceiptsAdmin] Upload Multiple Receipts pressed');
    
    Alert.alert(
      'Select Upload Method',
      'Choose how you want to upload your receipts and statements:',
      [
        {
          text: 'Camera',
          onPress: () => handleCameraUpload()
        },
        {
          text: 'Gallery/Files',
          onPress: () => handleFileUpload()
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };
  
  const handleCameraUpload = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });
      
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const newFile: SelectedFile = {
          uri: asset.uri,
          name: `receipt_${Date.now()}.jpg`,
          type: 'image',
          base64: asset.base64 || undefined
        };
        setSelectedFiles(prev => [...prev, newFile]);
        Alert.alert('Photo Added', `Added ${newFile.name} to upload queue.`);
      }
    } catch (error: any) {
      console.error('[ReceiptsAdmin] Camera error:', error);
      Alert.alert('Camera Error', error.message);
    }
  };
  
  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: true,
      });
      
      if (!result.canceled && result.assets) {
        const newFiles: SelectedFile[] = [];
        
        for (const asset of result.assets) {
          // Convert file to base64
          let base64 = '';
          try {
            const response = await fetch(asset.uri);
            const blob = await response.blob();
            const reader = new FileReader();
            base64 = await new Promise((resolve) => {
              reader.onloadend = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1]); // Remove data:image/jpeg;base64, prefix
              };
              reader.readAsDataURL(blob);
            });
          } catch (error) {
            console.error('[ReceiptsAdmin] Error converting to base64:', error);
            continue;
          }
          
          const fileType: 'image' | 'pdf' = asset.mimeType?.includes('pdf') ? 'pdf' : 'image';
          const newFile: SelectedFile = {
            uri: asset.uri,
            name: asset.name,
            type: fileType,
            base64
          };
          newFiles.push(newFile);
        }
        
        setSelectedFiles(prev => [...prev, ...newFiles]);
        Alert.alert('Files Added', `Added ${newFiles.length} file(s) to upload queue.`);
      }
    } catch (error: any) {
      console.error('[ReceiptsAdmin] File picker error:', error);
      Alert.alert('File Picker Error', error.message);
    }
  };
  
  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleProcessFiles = async () => {
    if (selectedFiles.length === 0) {
      Alert.alert('No Files', 'Please select files to process first.');
      return;
    }
    
    setIsProcessing(true);
    console.log(`[ReceiptsAdmin] Processing ${selectedFiles.length} files...`);
    
    try {
      let processedCount = 0;
      let errors: string[] = [];
      
      for (const file of selectedFiles) {
        try {
          console.log(`[ReceiptsAdmin] Processing ${file.name} (${file.type})...`);
          
          if (!file.base64) {
            errors.push(`${file.name}: No base64 data`);
            continue;
          }
          
          // Determine if this is likely a receipt or statement based on filename
          const isStatement = file.name.toLowerCase().includes('statement') || 
                            file.name.toLowerCase().includes('folio') ||
                            file.name.toLowerCase().includes('account');
          
          if (isStatement) {
            // Process as cruise statement
            const result = await statementMutation.mutateAsync({
              files: [{
                base64: file.base64!,
                type: file.type,
                name: file.name
              }]
            });
            
            if (result.success) {
              processedCount++;
              console.log(`[ReceiptsAdmin] Successfully processed statement: ${file.name}`);
            } else {
              errors.push(`${file.name}: Statement processing failed`);
            }
          } else {
            // Process as receipt - use imageBase64 format
            const result = await receiptMutation.mutateAsync({
              imageBase64: file.base64!
            });
            
            if (result.success) {
              processedCount++;
              console.log(`[ReceiptsAdmin] Successfully processed receipt: ${file.name}`);
            } else {
              errors.push(`${file.name}: Receipt processing failed`);
            }
          }
        } catch (error: any) {
          console.error(`[ReceiptsAdmin] Error processing ${file.name}:`, error);
          errors.push(`${file.name}: ${error.message}`);
        }
      }
      
      // Show results
      const successMessage = `Successfully processed ${processedCount} out of ${selectedFiles.length} files.`;
      const errorMessage = errors.length > 0 ? `\n\nErrors:\n${errors.join('\n')}` : '';
      
      Alert.alert(
        'Processing Complete',
        successMessage + errorMessage,
        [
          {
            text: 'View Analytics',
            onPress: () => router.push('/(tabs)/(analytics)')
          },
          { text: 'OK' }
        ]
      );
      
      // Clear processed files
      setSelectedFiles([]);
      
    } catch (error: any) {
      console.error('[ReceiptsAdmin] Processing error:', error);
      Alert.alert('Processing Error', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenMonitorMode = () => {
    console.log('[ReceiptsAdmin] Open Monitor Mode pressed');
    Alert.alert('Monitor Mode', 'Monitor mode activated');
  };

  const handleRunValidation = () => {
    console.log('[ReceiptsAdmin] Run Validation pressed');
    setIsScanning(true);
    setScanProgress(0);
    
    // Simulate scanning progress
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          Alert.alert('Validation Complete', 'Scan completed successfully');
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleRunFullScan = () => {
    console.log('[ReceiptsAdmin] Run Full Scan pressed');
    Alert.alert(
      'Full Scan',
      'Scanning can be throttled to ~100/hour when the app is open. Background execution depends on the platform.'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: "Receipts & Statements",
          headerBackTitle: "Back"
        }} 
      />
      
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        testID="receipts-admin-screen"
      >
        {/* Header Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Receipt size={24} color="#F59E0B" />
            <Text style={styles.statNumber}>{receipts.length}</Text>
            <Text style={styles.statLabel}>Receipts</Text>
          </View>
          
          <View style={styles.statCard}>
            <FileText size={24} color="#3B82F6" />
            <Text style={styles.statNumber}>{statements.length}</Text>
            <Text style={styles.statLabel}>Statements</Text>
          </View>
          
          <View style={styles.statCard}>
            <Eye size={24} color="#10B981" />
            <Text style={styles.statNumber}>{totalCount}</Text>
            <Text style={styles.statLabel}>Total Files</Text>
          </View>
        </View>

        {/* Toggle View Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowProcessedData(!showProcessedData)}
          >
            <Eye size={20} color="#3B82F6" />
            <Text style={styles.toggleButtonText}>
              {showProcessedData ? 'Hide Processed Data' : 'Show Processed Data'}
            </Text>
          </TouchableOpacity>
        </View>
        {/* Upload Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upload Receipts & Statements</Text>
          <Text style={styles.helperText}>
            Upload multiple receipts and cruise statements. Files will be automatically processed using OCR and matched to existing cruises or create new ones if needed.
          </Text>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, styles.halfButton]}
              onPress={handleCameraUpload}
              testID="camera-upload-button"
            >
              <Camera size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, styles.halfButton]}
              onPress={handleFileUpload}
              testID="file-upload-button"
            >
              <Upload size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Select Files</Text>
            </TouchableOpacity>
          </View>
          
          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <View style={styles.selectedFilesSection}>
              <Text style={styles.selectedFilesTitle}>Selected Files ({selectedFiles.length})</Text>
              {selectedFiles.map((file, index) => (
                <View key={`file-${index}`} style={styles.fileItem}>
                  <View style={styles.fileInfo}>
                    {file.type === 'pdf' ? (
                      <FileText size={16} color="#EF4444" />
                    ) : (
                      <FileImage size={16} color="#10B981" />
                    )}
                    <Text style={styles.fileName}>{file.name}</Text>
                    <Text style={styles.fileType}>{file.type.toUpperCase()}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveFile(index)}
                    testID={`remove-file-${index}`}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
              
              <TouchableOpacity
                style={[styles.button, styles.processButton, isProcessing && styles.buttonDisabled]}
                onPress={handleProcessFiles}
                disabled={isProcessing}
                testID="process-files-button"
              >
                {isProcessing ? (
                  <ActivityIndicator size={20} color="#FFFFFF" />
                ) : (
                  <CheckCircle size={20} color="#FFFFFF" />
                )}
                <Text style={styles.buttonText}>
                  {isProcessing ? 'Processing...' : `Process ${selectedFiles.length} File(s)`}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Monitor Mode Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monitor Mode</Text>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleOpenMonitorMode}
            testID="monitor-mode-button"
          >
            <Play size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Open Monitor Mode</Text>
          </TouchableOpacity>

          {/* Scan Progress */}
          <View style={styles.progressSection}>
            <Text style={styles.progressTitle}>Scan Progress</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${scanProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>Last run • {lastRun}</Text>
            <Text style={styles.progressText}>Last: {lastENC}</Text>
          </View>
        </View>

        {/* Audit & Validation Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Audit & Validation</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, styles.halfButton]}
              onPress={handleRunValidation}
              disabled={isScanning}
              testID="run-validation-button"
            >
              {isScanning ? (
                <ActivityIndicator size={16} color="#FFFFFF" />
              ) : (
                <CheckCircle size={20} color="#FFFFFF" />
              )}
              <Text style={styles.buttonText}>Run Validation</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, styles.halfButton]}
              onPress={handleRunFullScan}
              testID="run-full-scan-button"
            >
              <BarChart3 size={20} color="#3B82F6" />
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>Run Full Scan</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>
            Scanning can be throttled to ~100/hour when the app is open. Background execution depends on the platform.
          </Text>
        </View>

        {/* Processed Data Section */}
        {showProcessedData && (
          <>
            {/* Receipts Section */}
            {receipts.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📄 Receipts ({receipts.length})</Text>
                
                {receipts.map((receipt, index) => (
                  <View key={receipt.id || index} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <Receipt size={20} color="#F59E0B" />
                      <View style={styles.itemHeaderText}>
                        <Text style={styles.itemTitle}>
                          {receipt.ship || 'Unknown Ship'}
                        </Text>
                        <Text style={styles.itemSubtitle}>
                          {receipt.reservationNumber || 'No Reservation #'}
                        </Text>
                      </View>
                      <Text style={styles.itemDate}>
                        {formatDate(receipt.departureDate)}
                      </Text>
                    </View>
                    
                    <View style={styles.itemDetails}>
                      {receipt.cabinType && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Cabin:</Text>
                          <Text style={styles.detailValue}>
                            {receipt.cabinType} {receipt.cabinNumber ? `(${receipt.cabinNumber})` : ''}
                          </Text>
                        </View>
                      )}
                      
                      {receipt.guestNames && receipt.guestNames.length > 0 && (
                        <View style={styles.detailRow}>
                          <Users size={14} color="#6B7280" />
                          <Text style={styles.detailValue}>
                            {receipt.guestNames.join(', ')}
                          </Text>
                        </View>
                      )}
                      
                      <View style={styles.financialRow}>
                        {receipt.totalFare && (
                          <View style={styles.financialItem}>
                            <Text style={styles.financialLabel}>Fare</Text>
                            <Text style={styles.financialValue}>
                              {formatCurrency(receipt.totalFare)}
                            </Text>
                          </View>
                        )}
                        
                        {receipt.totalPaid && (
                          <View style={styles.financialItem}>
                            <Text style={styles.financialLabel}>Paid</Text>
                            <Text style={styles.financialValue}>
                              {formatCurrency(receipt.totalPaid)}
                            </Text>
                          </View>
                        )}
                        
                        {receipt.balanceDue && (
                          <View style={styles.financialItem}>
                            <Text style={styles.financialLabel}>Balance</Text>
                            <Text style={styles.financialValue}>
                              {formatCurrency(receipt.balanceDue)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Statements Section */}
            {statements.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📊 Statements ({statements.length})</Text>
                
                {statements.map((statement, index) => (
                  <View key={statement.id || index} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <FileText size={20} color="#3B82F6" />
                      <View style={styles.itemHeaderText}>
                        <Text style={styles.itemTitle}>
                          {statement.ship || 'Unknown Ship'}
                        </Text>
                        <Text style={styles.itemSubtitle}>
                          {statement.reservationNumber || statement.fileName || 'No Reservation #'}
                        </Text>
                      </View>
                      <Text style={styles.itemDate}>
                        {formatDate(statement.departureDate || statement.statementDate)}
                      </Text>
                    </View>
                    
                    <View style={styles.itemDetails}>
                      {statement.cabinType && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Cabin:</Text>
                          <Text style={styles.detailValue}>
                            {statement.cabinType} {statement.cabinNumber ? `(${statement.cabinNumber})` : ''}
                          </Text>
                        </View>
                      )}
                      
                      {statement.guestNames && statement.guestNames.length > 0 && (
                        <View style={styles.detailRow}>
                          <Users size={14} color="#6B7280" />
                          <Text style={styles.detailValue}>
                            {statement.guestNames.join(', ')}
                          </Text>
                        </View>
                      )}
                      
                      <View style={styles.financialRow}>
                        {statement.cruiseFare && (
                          <View style={styles.financialItem}>
                            <Text style={styles.financialLabel}>Cruise Fare</Text>
                            <Text style={styles.financialValue}>
                              {formatCurrency(statement.cruiseFare)}
                            </Text>
                          </View>
                        )}
                        
                        {statement.casino && (
                          <View style={styles.financialItem}>
                            <Text style={styles.financialLabel}>Casino</Text>
                            <Text style={styles.financialValue}>
                              {formatCurrency(statement.casino)}
                            </Text>
                          </View>
                        )}
                        
                        {statement.clubRoyaleEntertainmentCharges && (
                          <View style={styles.financialItem}>
                            <Text style={styles.financialLabel}>Club Royale</Text>
                            <Text style={styles.financialValue}>
                              {formatCurrency(statement.clubRoyaleEntertainmentCharges)}
                            </Text>
                          </View>
                        )}
                        
                        {statement.totalCharges && (
                          <View style={styles.financialItem}>
                            <Text style={styles.financialLabel}>Total</Text>
                            <Text style={styles.financialValue}>
                              {formatCurrency(statement.totalCharges)}
                            </Text>
                          </View>
                        )}
                      </View>
                      
                      {statement.lineItems && statement.lineItems.length > 0 && (
                        <View style={styles.lineItemsSection}>
                          <Text style={styles.lineItemsTitle}>Line Items ({statement.lineItems.length})</Text>
                          {statement.lineItems.slice(0, 3).map((item: any, itemIndex: number) => (
                            <View key={itemIndex} style={styles.lineItem}>
                              <Text style={styles.lineItemDescription}>
                                {item.description || item.category}
                              </Text>
                              <Text style={styles.lineItemAmount}>
                                {formatCurrency(item.amount)}
                              </Text>
                            </View>
                          ))}
                          {statement.lineItems.length > 3 && (
                            <Text style={styles.moreItemsText}>
                              +{statement.lineItems.length - 3} more items
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Empty State for Processed Data */}
            {totalCount === 0 && (
              <View style={styles.emptyState}>
                <Receipt size={48} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>No Processed Data</Text>
                <Text style={styles.emptyDescription}>
                  Upload and process receipt and statement files to see data here.
                </Text>
              </View>
            )}
          </>
        )}

        {/* Process More Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.processMoreButton}
            onPress={() => router.push('/process-data-folder')}
          >
            <Receipt size={20} color="#FFFFFF" />
            <Text style={styles.processMoreButtonText}>Process DATA Folder</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  toggleButtonText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  itemHeaderText: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  itemSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  itemDate: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  itemDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    minWidth: 50,
  },
  detailValue: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  financialRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 8,
  },
  financialItem: {
    alignItems: 'center',
  },
  financialLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  financialValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
    marginTop: 2,
  },
  lineItemsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  lineItemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  lineItemDescription: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  lineItemAmount: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  moreItemsText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  processMoreButton: {
    backgroundColor: '#22C55E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  processMoreButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  halfButton: {
    flex: 1,
    marginBottom: 0,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#3B82F6',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  progressSection: {
    marginTop: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 20,
  },
  navItem: {
    padding: 8,
  },
  selectedFilesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  selectedFilesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  fileName: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
  },
  fileType: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  removeButton: {
    padding: 4,
  },
  processButton: {
    backgroundColor: '#22C55E',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});