import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Search, Sparkles, Ship, Calendar, DollarSign, Globe, ArrowLeft, Zap } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { router, Stack } from 'expo-router';

interface SearchResult {
  type: string;
  data: any;
  relevance?: number;
}

interface SearchResponse {
  success: boolean;
  query: string;
  aiInsights: string;
  results: SearchResult[];
  dataSummary?: {
    totalCruises: number;
    totalBooked: number;
    totalOffers: number;
    totalEvents: number;
  };
  error?: string;
  timestamp: string;
}

export default function AISearchScreen() {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isUpdatingData, setIsUpdatingData] = useState<boolean>(false);

  const searchMutation = trpc.search.aiSearch.useMutation({
    onSuccess: (data) => {
      console.log('[AISearch] Search successful:', data);
      setSearchResults(data);
      setIsSearching(false);
    },
    onError: (error) => {
      console.error('[AISearch] Search error:', error);
      setIsSearching(false);
      Alert.alert('Search Error', `Failed to search cruise data: ${error.message}. Please try again.`);
    }
  });
  
  const scrapeMutation = trpc.cruises.batchVerify.useMutation({
    onSuccess: (data) => {
      console.log('[AISearch] Data update successful:', data);
      setIsUpdatingData(false);
      Alert.alert(
        'Data Updated! ✅',
        data.message || 'Successfully updated cruise data with fresh web information.',
        [{ text: 'Great!', onPress: () => searchQuery.trim() && handleSearch() }] // Re-run search with fresh data
      );
    },
    onError: (error) => {
      console.error('[AISearch] Data update error:', error);
      setIsUpdatingData(false);
      Alert.alert('Update Error', `Failed to update cruise data: ${error.message}. Please try again.`);
    }
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Search Required', 'Please enter a search query.');
      return;
    }
    
    console.log('[AISearch] Starting search for:', searchQuery);
    setIsSearching(true);
    setSearchResults(null); // Clear previous results
    
    searchMutation.mutate({
      query: searchQuery,
      includeTypes: ['cruises', 'booked', 'offers'],
      limit: 15
    });
  };
  
  const handleUpdateData = async () => {
    Alert.alert(
      'Update Cruise Data',
      'This will fetch fresh pricing and itinerary data from cruise websites. This may take a few minutes.\n\n• Update next 100 days of cruises\n• Verify pricing and schedules\n• Fix any data inconsistencies\n\nContinue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update Data',
          style: 'default',
          onPress: () => {
            setIsUpdatingData(true);
            scrapeMutation.mutate({
              batchSize: 50,
              maxBatches: 4,
              forceRefresh: true
            });
          }
        }
      ]
    );
  };

  const renderSearchResult = (result: SearchResult, index: number) => {
    const { type, data } = result;
    
    switch (type) {
      case 'cruise':
        return (
          <View key={index} style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Ship size={20} color="#0066CC" />
              <Text style={styles.resultType}>Cruise</Text>
            </View>
            <Text style={styles.resultTitle}>{data.ship}</Text>
            <Text style={styles.resultSubtitle}>{data.itineraryName}</Text>
            <View style={styles.resultDetails}>
              <View style={styles.detailItem}>
                <Calendar size={16} color="#666" />
                <Text style={styles.detailText}>{data.departureDate}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailText}>{data.nights} nights</Text>
              </View>
            </View>
          </View>
        );
        
      case 'booked':
        return (
          <View key={index} style={[styles.resultCard, styles.bookedCard]}>
            <View style={styles.resultHeader}>
              <Calendar size={20} color="#00AA44" />
              <Text style={styles.resultType}>Booked Cruise</Text>
            </View>
            <Text style={styles.resultTitle}>{data.ship}</Text>
            <Text style={styles.resultSubtitle}>{data.itineraryName}</Text>
            <View style={styles.resultDetails}>
              <View style={styles.detailItem}>
                <Text style={styles.detailText}>Res: {data.reservationNumber}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailText}>{data.daysToGo} days to go</Text>
              </View>
            </View>
          </View>
        );
        
      case 'offer':
        return (
          <View key={index} style={[styles.resultCard, styles.offerCard]}>
            <View style={styles.resultHeader}>
              <DollarSign size={20} color="#FF6600" />
              <Text style={styles.resultType}>Casino Offer</Text>
            </View>
            <Text style={styles.resultTitle}>{data.offerName}</Text>
            <Text style={styles.resultSubtitle}>{data.offerType}</Text>
            <View style={styles.resultDetails}>
              <View style={styles.detailItem}>
                <Text style={styles.detailText}>Code: {data.offerCode}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailText}>Expires: {data.expires}</Text>
              </View>
            </View>
          </View>
        );
        
      default:
        return null;
    }
  };

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'AI Search',
          headerStyle: { backgroundColor: '#8B5CF6' },
          headerTintColor: '#FFFFFF',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity 
              onPress={handleUpdateData}
              disabled={isUpdatingData}
              style={styles.updateButton}
            >
              {isUpdatingData ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Globe size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          ),
        }} 
      />
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Sparkles size={24} color="#8B5CF6" />
            <Text style={styles.title}>AI-Powered Cruise Search</Text>
          </View>
          <Text style={styles.subtitle}>Ask questions about your cruise data using natural language</Text>
          
          {/* Real-time Data Status */}
          <View style={styles.dataStatusContainer}>
            <View style={styles.dataStatusRow}>
              <Globe size={16} color="#10B981" />
              <Text style={styles.dataStatusText}>Real-time web data integration</Text>
            </View>
            <TouchableOpacity 
              onPress={handleUpdateData}
              disabled={isUpdatingData}
              style={styles.refreshDataButton}
            >
              {isUpdatingData ? (
                <ActivityIndicator size="small" color="#8B5CF6" />
              ) : (
                <Zap size={14} color="#8B5CF6" />
              )}
              <Text style={styles.refreshDataText}>
                {isUpdatingData ? 'Updating...' : 'Refresh Data'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Ask about cruises, bookings, or offers..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>
        
        <TouchableOpacity 
          style={[styles.searchButton, isSearching && styles.searchButtonDisabled]}
          onPress={handleSearch}
          disabled={isSearching || !searchQuery.trim()}
        >
          {isSearching ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.searchButtonText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>

        {/* Example queries */}
        <View style={styles.examplesContainer}>
          <Text style={styles.examplesTitle}>Try asking:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              "Show me Caribbean cruises in December",
              "What's the cheapest cruise next month?",
              "Find Royal Caribbean Navigator sailings",
              "Cruises departing from Los Angeles",
              "3-night weekend getaways",
              "Balcony cabins under $800",
              "My upcoming booked cruises"
            ].map((example, index) => (
              <TouchableOpacity
                key={index}
                style={styles.exampleChip}
                onPress={() => setSearchQuery(example)}
              >
                <Text style={styles.exampleText}>{example}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

      {/* AI Insights */}
      {searchResults && (
        <View style={styles.insightsContainer}>
          <View style={styles.insightsHeader}>
            <Sparkles size={18} color="#0066CC" />
            <Text style={styles.insightsTitle}>AI Analysis</Text>
          </View>
          <Text style={styles.insightsText}>{searchResults.aiInsights}</Text>
          
          {/* Data Summary */}
          {searchResults.dataSummary && (
            <View style={styles.summaryContainer}>
              <Text style={styles.summaryTitle}>Data Overview</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>{searchResults.dataSummary.totalCruises}</Text>
                  <Text style={styles.summaryLabel}>Cruises</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>{searchResults.dataSummary.totalBooked}</Text>
                  <Text style={styles.summaryLabel}>Booked</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryNumber}>{searchResults.dataSummary.totalOffers}</Text>
                  <Text style={styles.summaryLabel}>Offers</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Search Results */}
      {searchResults && searchResults.results.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>
            Found {searchResults.results.length} results for &ldquo;{searchResults.query}&rdquo;
          </Text>
          
          {searchResults.results.map((result, index) => renderSearchResult(result, index))}
        </View>
      )}

      {/* No Results */}
      {searchResults && searchResults.results.length === 0 && (
        <View style={styles.noResultsContainer}>
          <Text style={styles.noResultsTitle}>No results found</Text>
          <Text style={styles.noResultsText}>
            Try rephrasing your search or use different keywords
          </Text>
        </View>
      )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  backButton: {
    padding: 8,
  },
  updateButton: {
    padding: 8,
  },
  header: {
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 8,
  },
  dataStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  dataStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dataStatusText: {
    fontSize: 14,
    color: '#059669',
    marginLeft: 6,
    fontWeight: '500',
  },
  refreshDataButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#8B5CF6',
    gap: 4,
  },
  refreshDataText: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#1F2937',
  },
  searchButton: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  examplesContainer: {
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  exampleChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  exampleText: {
    fontSize: 14,
    color: '#4B5563',
  },
  insightsContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  insightsText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4B5563',
    marginBottom: 16,
  },
  summaryContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0066CC',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  resultsContainer: {
    margin: 16,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  resultCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#00AA44',
  },
  offerCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF6600',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 8,
    textTransform: 'uppercase',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  resultDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 4,
  },
  noResultsContainer: {
    margin: 16,
    padding: 32,
    backgroundColor: '#FFF',
    borderRadius: 12,
    alignItems: 'center',
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
});