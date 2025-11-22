import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Download, FileText, ArrowLeft } from 'lucide-react-native';
import { useAppState } from '@/state/AppStateProvider';
import { trpc } from '@/lib/trpc';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function DownloadSnapshotScreen() {
  const { localData } = useAppState();
  const [generating, setGenerating] = React.useState(false);
  
  const allCruisesQuery = trpc.cruises.list.useQuery({ limit: 100000, offset: 0 });

  const generateAndDownloadFile = async (dataType: 'cruises' | 'booked' | 'offers' | 'calendar') => {
    if (!localData) {
      Alert.alert('No Data', 'No local data found to export');
      return;
    }

    setGenerating(true);
    console.log(`[Download] Generating ${dataType} file...`);

    try {
      const timestamp = new Date().toISOString().split('T')[0];
      let data: any[] = [];
      let fileName = '';
      let sheetName = '';

      switch (dataType) {
        case 'cruises':
          if (allCruisesQuery.data?.cruises) {
            data = allCruisesQuery.data.cruises;
          } else {
            data = localData.cruises;
          }
          fileName = `cruises_${timestamp}.xlsx`;
          sheetName = 'Cruises';
          break;
        case 'booked':
          data = localData.booked;
          fileName = `booked_cruises_${timestamp}.xlsx`;
          sheetName = 'Booked Cruises';
          break;
        case 'offers':
          data = localData.offers;
          fileName = `casino_offers_${timestamp}.xlsx`;
          sheetName = 'Casino Offers';
          break;
        case 'calendar':
          data = localData.calendar;
          fileName = `calendar_events_${timestamp}.xlsx`;
          sheetName = 'Calendar Events';
          break;
      }

      if (data.length === 0) {
        Alert.alert('No Data', `No ${dataType} data found to export`);
        return;
      }

      // Create workbook
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      if (Platform.OS === 'web') {
        // Web download
        const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        Alert.alert('Download Started', `${fileName} download has started`);
      } else {
        // Mobile download
        const buffer = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        
        await FileSystem.writeAsStringAsync(fileUri, buffer, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: `Share ${fileName}`,
          });
        } else {
          Alert.alert('File Saved', `${fileName} has been saved to your device`);
        }
      }

      console.log(`[Download] Successfully generated ${fileName}`);
      
    } catch (error: any) {
      console.error(`[Download] Error generating ${dataType} file:`, error);
      Alert.alert('Export Failed', `Error: ${error.message || 'Could not generate file'}`);
    } finally {
      setGenerating(false);
    }
  };

  const downloadAllFiles = async () => {
    if (!localData) {
      Alert.alert('No Data', 'No local data found to export');
      return;
    }

    Alert.alert(
      'Download All Files',
      'This will generate and download 4 separate XLSX files. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download All',
          onPress: async () => {
            for (const dataType of ['cruises', 'booked', 'offers', 'calendar'] as const) {
              if (localData[dataType].length > 0) {
                await generateAndDownloadFile(dataType);
                // Small delay between downloads
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }
        }
      ]
    );
  };

  if (!localData) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.title}>Download Snapshot</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No data available to download</Text>
        </View>
      </View>
    );
  }

  const cruisesCount = allCruisesQuery.data?.total || localData.cruises.length;
  const totalItems = cruisesCount + localData.booked.length + localData.offers.length + localData.calendar.length;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#6B7280" />
        </TouchableOpacity>
        <Text style={styles.title}>Download Snapshot</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Export Data Files</Text>
        <Text style={styles.helperText}>
          Download individual XLSX files for each data type. Total: {totalItems} items
        </Text>
      </View>

      {/* Individual File Downloads */}
      {cruisesCount > 0 && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.downloadButton, generating && styles.buttonDisabled]}
            onPress={() => generateAndDownloadFile('cruises')}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <FileText size={20} color="#FFFFFF" />
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Download Cruises</Text>
                  <Text style={styles.buttonSubtext}>{cruisesCount} items (ALL CRUISES IN SYSTEM)</Text>
                </View>
                <Download size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {localData.booked.length > 0 && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.downloadButton, styles.bookedButton, generating && styles.buttonDisabled]}
            onPress={() => generateAndDownloadFile('booked')}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <FileText size={20} color="#FFFFFF" />
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Download Booked Cruises</Text>
                  <Text style={styles.buttonSubtext}>{localData.booked.length} items</Text>
                </View>
                <Download size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {localData.offers.length > 0 && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.downloadButton, styles.offersButton, generating && styles.buttonDisabled]}
            onPress={() => generateAndDownloadFile('offers')}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <FileText size={20} color="#FFFFFF" />
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Download Casino Offers</Text>
                  <Text style={styles.buttonSubtext}>{localData.offers.length} items</Text>
                </View>
                <Download size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {localData.calendar.length > 0 && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.downloadButton, styles.calendarButton, generating && styles.buttonDisabled]}
            onPress={() => generateAndDownloadFile('calendar')}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <FileText size={20} color="#FFFFFF" />
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Download Calendar Events</Text>
                  <Text style={styles.buttonSubtext}>{localData.calendar.length} items</Text>
                </View>
                <Download size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Download All Button */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.downloadButton, styles.downloadAllButton, generating && styles.buttonDisabled]}
          onPress={downloadAllFiles}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Download size={20} color="#FFFFFF" />
              <View style={styles.buttonContent}>
                <Text style={styles.buttonText}>Download All Files</Text>
                <Text style={styles.buttonSubtext}>4 XLSX files</Text>
              </View>
            </>
          )}
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#6C5CE7',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  bookedButton: {
    backgroundColor: '#10B981',
  },
  offersButton: {
    backgroundColor: '#F59E0B',
  },
  calendarButton: {
    backgroundColor: '#8B5CF6',
  },
  downloadAllButton: {
    backgroundColor: '#EF4444',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonContent: {
    flex: 1,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSubtext: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.8,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
});