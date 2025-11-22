import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Calendar, Search, Download } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { useAppState } from '@/state/AppStateProvider';

export default function LoadDateRangeScreen() {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  
  const { refreshLocalData } = useAppState();
  const loadDateRangeMutation = trpc.import.loadDateRange.useMutation();

  const handleSearch = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Missing Dates', 'Please enter both start and end dates');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      Alert.alert('Invalid Date Range', 'Start date must be before end date');
      return;
    }

    setIsLoading(true);
    setHasSearched(false);
    
    try {
      console.log('[LoadDateRange] Searching for cruises between', startDate, 'and', endDate);
      
      const result = await loadDateRangeMutation.mutateAsync({
        startDate,
        endDate,
        searchOnly: true
      });
      
      setSearchResults(result.cruises || []);
      setHasSearched(true);
      
      console.log('[LoadDateRange] Found', result.cruises?.length || 0, 'cruises in date range');
      
    } catch (error) {
      console.error('[LoadDateRange] Search failed:', error);
      Alert.alert(
        'Search Failed',
        error instanceof Error ? error.message : 'Failed to search for cruises in date range'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadCruises = async () => {
    if (searchResults.length === 0) {
      Alert.alert('No Results', 'No cruises found in the selected date range');
      return;
    }

    Alert.alert(
      'Load Cruises',
      `This will add ${searchResults.length} cruises to your local data. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load Cruises',
          onPress: async () => {
            setIsLoading(true);
            
            try {
              console.log('[LoadDateRange] Loading', searchResults.length, 'cruises');
              
              const result = await loadDateRangeMutation.mutateAsync({
                startDate,
                endDate,
                searchOnly: false
              });
              
              await refreshLocalData();
              
              Alert.alert(
                'Success! 🚢',
                `Successfully loaded ${result.cruisesAdded || 0} cruises sailing between ${startDate} and ${endDate}`,
                [
                  {
                    text: 'OK',
                    onPress: () => router.back()
                  }
                ]
              );
              
            } catch (error) {
              console.error('[LoadDateRange] Load failed:', error);
              Alert.alert(
                'Load Failed',
                error instanceof Error ? error.message : 'Failed to load cruises'
              );
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'Load Cruises by Date Range',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#111827',
          headerTitleStyle: { fontWeight: '600' },
        }} 
      />
      
      <ScrollView style={styles.content}>
        {/* Date Range Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date Range</Text>
          <Text style={styles.helperText}>
            Enter the sailing date range to search for cruises in the data folder
          </Text>
          
          <View style={styles.dateInputs}>
            <View style={styles.dateInputContainer}>
              <Text style={styles.inputLabel}>Start Date</Text>
              <TextInput
                style={styles.dateInput}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
                testID="start-date-input"
              />
            </View>
            
            <View style={styles.dateInputContainer}>
              <Text style={styles.inputLabel}>End Date</Text>
              <TextInput
                style={styles.dateInput}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
                testID="end-date-input"
              />
            </View>
          </View>
          
          <TouchableOpacity
            style={[styles.searchButton, isLoading && styles.buttonDisabled]}
            onPress={handleSearch}
            disabled={isLoading}
            testID="search-button"
          >
            {isLoading ? (
              <ActivityIndicator size={20} color="#FFFFFF" />
            ) : (
              <Search size={20} color="#FFFFFF" />
            )}
            <Text style={styles.buttonText}>
              {isLoading ? 'Searching...' : 'Search Cruises'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Results */}
        {hasSearched && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Search Results ({searchResults.length} cruises found)
            </Text>
            
            {searchResults.length === 0 ? (
              <View style={styles.emptyState}>
                <Calendar size={48} color="#9CA3AF" />
                <Text style={styles.emptyStateTitle}>No Cruises Found</Text>
                <Text style={styles.emptyStateText}>
                  No cruises found sailing between {startDate} and {endDate} in the data folder.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.resultsList}>
                  {searchResults.slice(0, 10).map((cruise, index) => (
                    <View key={index} style={styles.cruiseItem}>
                      <View style={styles.cruiseHeader}>
                        <Text style={styles.cruiseShip}>{cruise.ship}</Text>
                        <Text style={styles.cruiseDate}>{formatDate(cruise.departureDate)}</Text>
                      </View>
                      <Text style={styles.cruiseItinerary}>{cruise.itineraryName}</Text>
                      <Text style={styles.cruiseDetails}>
                        {cruise.nights} nights • {cruise.departurePort}
                      </Text>
                    </View>
                  ))}
                  
                  {searchResults.length > 10 && (
                    <Text style={styles.moreResults}>
                      ... and {searchResults.length - 10} more cruises
                    </Text>
                  )}
                </View>
                
                <TouchableOpacity
                  style={[styles.loadButton, isLoading && styles.buttonDisabled]}
                  onPress={handleLoadCruises}
                  disabled={isLoading}
                  testID="load-cruises-button"
                >
                  <Download size={20} color="#FFFFFF" />
                  <Text style={styles.buttonText}>
                    Load {searchResults.length} Cruises
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
        
        {/* Quick Date Presets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Presets</Text>
          <View style={styles.presetButtons}>
            <TouchableOpacity
              style={styles.presetButton}
              onPress={() => {
                const today = new Date();
                const next30 = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
                setStartDate(today.toISOString().split('T')[0]);
                setEndDate(next30.toISOString().split('T')[0]);
              }}
            >
              <Text style={styles.presetButtonText}>Next 30 Days</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.presetButton}
              onPress={() => {
                const today = new Date();
                const next90 = new Date(today.getTime() + (90 * 24 * 60 * 60 * 1000));
                setStartDate(today.toISOString().split('T')[0]);
                setEndDate(next90.toISOString().split('T')[0]);
              }}
            >
              <Text style={styles.presetButtonText}>Next 90 Days</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.presetButton}
              onPress={() => {
                const today = new Date();
                const next180 = new Date(today.getTime() + (180 * 24 * 60 * 60 * 1000));
                setStartDate(today.toISOString().split('T')[0]);
                setEndDate(next180.toISOString().split('T')[0]);
              }}
            >
              <Text style={styles.presetButtonText}>Next 6 Months</Text>
            </TouchableOpacity>
          </View>
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
    marginBottom: 8,
  },
  helperText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  dateInputs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dateInputContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  searchButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  loadButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resultsList: {
    marginBottom: 8,
  },
  cruiseItem: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cruiseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cruiseShip: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  cruiseDate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
  },
  cruiseItinerary: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 2,
  },
  cruiseDetails: {
    fontSize: 12,
    color: '#6B7280',
  },
  moreResults: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  presetButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  presetButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  presetButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
});