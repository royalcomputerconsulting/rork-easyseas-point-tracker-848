import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { 
  ArrowLeft,
  User,
  Bell,
  Database,
  Download,
  Trash2,
  Info,
  Upload,
  FileDown,
  Settings as SettingsIcon,
  Calendar
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppState } from '@/state/AppStateProvider';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { trpc } from '@/lib/trpc';

export default function SettingsScreen() {
  const { refreshLocalData, localData, hasLocalData } = useAppState();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [autoSyncEnabled, setAutoSyncEnabled] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isClearing, setIsClearing] = React.useState(false);

  console.log('[Settings] Component mounted');

  const handleSaveSnapshot = async () => {
    try {
      setIsLoading(true);
      console.log('[Settings] Starting snapshot save...');
      
      // Create workbooks for each data type
      const cruisesWB = XLSX.utils.book_new();
      const bookedWB = XLSX.utils.book_new();
      const offersWB = XLSX.utils.book_new();
      
      // Add data to workbooks
      if (localData.cruises.length > 0) {
        const cruisesWS = XLSX.utils.json_to_sheet(localData.cruises);
        XLSX.utils.book_append_sheet(cruisesWB, cruisesWS, 'Cruises');
      }
      
      if (localData.booked.length > 0) {
        const bookedWS = XLSX.utils.json_to_sheet(localData.booked);
        XLSX.utils.book_append_sheet(bookedWB, bookedWS, 'Booked');
      }
      
      if (localData.offers.length > 0) {
        const offersWS = XLSX.utils.json_to_sheet(localData.offers);
        XLSX.utils.book_append_sheet(offersWB, offersWS, 'Offers');
      }
      
      if (Platform.OS === 'web') {
        // For web, trigger downloads
        if (localData.cruises.length > 0) {
          XLSX.writeFile(cruisesWB, 'cruises_snapshot.xlsx');
        }
        if (localData.booked.length > 0) {
          XLSX.writeFile(bookedWB, 'booked_snapshot.xlsx');
        }
        if (localData.offers.length > 0) {
          XLSX.writeFile(offersWB, 'offers_snapshot.xlsx');
        }
      } else {
        // For mobile, save to device and share
        const timestamp = new Date().toISOString().split('T')[0];
        
        if (localData.cruises.length > 0) {
          const cruisesData = XLSX.write(cruisesWB, { type: 'base64', bookType: 'xlsx' });
          const cruisesUri = FileSystem.documentDirectory + `cruises_${timestamp}.xlsx`;
          await FileSystem.writeAsStringAsync(cruisesUri, cruisesData, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await Sharing.shareAsync(cruisesUri);
        }
        
        if (localData.booked.length > 0) {
          const bookedData = XLSX.write(bookedWB, { type: 'base64', bookType: 'xlsx' });
          const bookedUri = FileSystem.documentDirectory + `booked_${timestamp}.xlsx`;
          await FileSystem.writeAsStringAsync(bookedUri, bookedData, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await Sharing.shareAsync(bookedUri);
        }
        
        if (localData.offers.length > 0) {
          const offersData = XLSX.write(offersWB, { type: 'base64', bookType: 'xlsx' });
          const offersUri = FileSystem.documentDirectory + `offers_${timestamp}.xlsx`;
          await FileSystem.writeAsStringAsync(offersUri, offersData, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await Sharing.shareAsync(offersUri);
        }
      }
      
      Alert.alert(
        'Snapshot Saved! 📁',
        `Successfully exported:\n• ${localData.cruises.length} cruises\n• ${localData.booked.length} booked cruises\n• ${localData.offers.length} offers`,
        [{ text: 'OK' }]
      );
      
    } catch (error: any) {
      console.error('[Settings] Save snapshot failed:', error);
      Alert.alert('Export Failed', `Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSnapshot = () => {
    Alert.alert(
      'Load Snapshot',
      'This will take you to the import page where you can load data from files.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Go to Import', 
          onPress: () => router.push('/import')
        }
      ]
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all local data including cruises, offers, and booked cruises. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsClearing(true);
              console.log('[Settings] Clearing all local data...');
              
              // Get all AsyncStorage keys
              const allKeys = await AsyncStorage.getAllKeys();
              
              // Filter keys that contain our data
              const dataKeys = allKeys.filter(key => 
                key.startsWith('@local_') || 
                key.startsWith('@snapshot_') ||
                key === '@app_settings' ||
                key === '@last_import'
              );
              
              // Remove all data keys
              if (dataKeys.length > 0) {
                await AsyncStorage.multiRemove(dataKeys);
                console.log(`[Settings] Cleared ${dataKeys.length} storage keys`);
              }
              
              // Refresh app state to reflect cleared data
              await refreshLocalData();
              
              Alert.alert(
                'Data Cleared ✅',
                'All local data has been successfully cleared.',
                [{ text: 'OK' }]
              );
              
            } catch (error: any) {
              console.error('[Settings] Clear data failed:', error);
              Alert.alert('Clear Failed', `Error: ${error.message}`);
            } finally {
              setIsClearing(false);
            }
          }
        }
      ]
    );
  };

  const handleOfferMaintenance = () => {
    router.push('/verify-data');
  };

  return (
    <ScrollView style={styles.container} testID="settings-screen">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
          testID="back-button"
        >
          <ArrowLeft size={24} color="#6C5CE7" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <TouchableOpacity style={styles.settingItem} testID="profile-settings">
          <View style={styles.settingLeft}>
            <User size={20} color="#6B7280" />
            <Text style={styles.settingText}>Profile Settings</Text>
          </View>
          <Text style={styles.settingValue}>Scott Merlis</Text>
        </TouchableOpacity>
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Bell size={20} color="#6B7280" />
            <Text style={styles.settingText}>Push Notifications</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#E5E7EB', true: '#6C5CE7' }}
            thumbColor={notificationsEnabled ? '#FFFFFF' : '#FFFFFF'}
            testID="notifications-toggle"
          />
        </View>
      </View>

      {/* Data Management Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>
        
        <TouchableOpacity 
          style={styles.settingItem} 
          onPress={handleSaveSnapshot}
          disabled={isLoading || !hasLocalData}
          testID="save-snapshot"
        >
          <View style={styles.settingLeft}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#6B7280" />
            ) : (
              <Download size={20} color={hasLocalData ? "#6B7280" : "#D1D5DB"} />
            )}
            <Text style={[styles.settingText, !hasLocalData && styles.disabledText]}>
              Save Snapshot
            </Text>
          </View>
          <Text style={styles.settingValue}>XLSX</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem} 
          onPress={handleLoadSnapshot}
          testID="load-snapshot"
        >
          <View style={styles.settingLeft}>
            <Upload size={20} color="#6B7280" />
            <Text style={styles.settingText}>Load Snapshot</Text>
          </View>
          <Text style={styles.settingValue}>Import</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem} 
          onPress={handleOfferMaintenance}
          testID="offer-maintenance"
        >
          <View style={styles.settingLeft}>
            <Database size={20} color="#6B7280" />
            <Text style={styles.settingText}>Offer Maintenance</Text>
          </View>
          <Text style={styles.settingValue}>Verify</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem} 
          onPress={() => router.push('/data-scraping')}
          testID="bulk-verify-cruises"
        >
          <View style={styles.settingLeft}>
            <Database size={20} color="#10B981" />
            <Text style={styles.settingText}>Bulk Verify Cruises</Text>
          </View>
          <Text style={styles.settingValue}>100 at a time</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem} 
          onPress={handleClearAllData}
          disabled={isClearing}
          testID="clear-all-data"
        >
          <View style={styles.settingLeft}>
            {isClearing ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Trash2 size={20} color="#EF4444" />
            )}
            <Text style={[styles.settingText, styles.dangerText]}>
              Clear All Data
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Data Status Section */}
      {hasLocalData && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Status</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Info size={20} color="#10B981" />
              <Text style={styles.settingText}>Local Data</Text>
            </View>
            <Text style={styles.settingValue}>Active</Text>
          </View>
          <View style={styles.dataStats}>
            <Text style={styles.dataStatsText}>• {localData.cruises.length} cruises</Text>
            <Text style={styles.dataStatsText}>• {localData.booked.length} booked cruises</Text>
            <Text style={styles.dataStatsText}>• {localData.offers.length} casino offers</Text>
            <Text style={styles.dataStatsText}>• {localData.calendar.length} calendar events</Text>
          </View>
        </View>
      )}

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <TouchableOpacity style={styles.settingItem} testID="app-info">
          <View style={styles.settingLeft}>
            <Info size={20} color="#6B7280" />
            <Text style={styles.settingText}>App Information</Text>
          </View>
          <Text style={styles.settingValue}>v1.0.0</Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  placeholder: {
    width: 40,
  },
  section: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  settingText: {
    fontSize: 16,
    color: '#374151',
  },
  settingValue: {
    fontSize: 14,
    color: '#6B7280',
  },
  dangerText: {
    color: '#EF4444',
  },
  disabledText: {
    color: '#D1D5DB',
  },
  dataStats: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  dataStatsText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
});