import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Search, Filter, Calendar, MapPin, Users, Ship, Clock, Bell, Settings, Plus, Sparkles } from 'lucide-react-native';
import { COLORS, SHADOW } from '@/constants/theme';
import { ThemedCard } from '@/components/ui/ThemedCard';
import { trpc, isBackendEnabled } from '@/lib/trpc';
import { useAppState } from '@/state/AppStateProvider';
import { STATIC_BOOKED_CRUISES } from '@/state/staticBooked';


type ViewMode = 'all' | 'available';
type CabinType = 'Interior' | 'Oceanview' | 'Balcony' | 'Suite';

type SortMode = 'default' | 'longest';

interface Cruise {
  id: string;
  ship: string;
  itineraryName: string;
  departureDate: string;
  returnDate: string;
  nights: number;
  departurePort: string;
  cabinType?: string;
  actualFare?: number;
  retailValue?: number;
  savings?: number;
  pointsRequired?: number;
  sailingCode?: string;
  isComped?: boolean;
}

interface Filters {
  search: string;
  dateRange?: { start: string; end: string };
  ship?: string;
  itinerary?: string;
  port?: string;
  nights?: number;
  cabinType?: CabinType;
  passengers?: number;
}

import { HeroHeaderCompact } from '@/components/HeroHeaderCompact';
import { CruiseCard } from '@/components/CruiseCard';
import { CruiseUnifiedCard } from '@/components/CruiseUnifiedCard';
import { detectAndMapUnified } from '@/lib/unifiedCruise';

export default function CruisesScreen() {
  const insets = useSafeAreaInsets();
  const { localData, clubRoyaleProfile } = useAppState();
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [filters, setFilters] = useState<Filters>({ search: '' });
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [refreshing, setRefreshing] = useState(false);

  // Get user profile for points display (only if backend is enabled)
  const userProfileQuery = trpc.directAnalytics.getUserProfile.useQuery(undefined, {
    enabled: isBackendEnabled,
  });

  // Use the working direct cruises query (only if backend is enabled)
  const cruisesQuery = trpc.directCruises.list.useQuery({
    search: filters.search || undefined,
    cabinType: filters.cabinType || undefined,
    limit: 100,
    offset: 0
  }, {
    enabled: isBackendEnabled,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 2
  });

  // Get booked cruises to check availability (only if backend is enabled)
  const bookedCruisesQuery = trpc.directBookedCruises.list.useQuery(undefined, {
    enabled: isBackendEnabled,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    if (isBackendEnabled) {
      await Promise.all([
        cruisesQuery.refetch(),
        bookedCruisesQuery.refetch(),
        userProfileQuery.refetch()
      ]);
    }
    setRefreshing(false);
  };

  const handleSearch = (text: string) => {
    setFilters(prev => ({ ...prev, search: text }));
  };



  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };



  // Get booked cruises data
  const bookedCruises = useMemo(() => {
    if (isBackendEnabled && bookedCruisesQuery.data) {
      return bookedCruisesQuery.data;
    }
    if (localData.booked && localData.booked.length > 0) {
      return localData.booked;
    }
    return STATIC_BOOKED_CRUISES;
  }, [bookedCruisesQuery.data, localData.booked]);

  // Get all cruises - use local data if backend is disabled
  const allCruises = useMemo(() => {
    if (isBackendEnabled && cruisesQuery.data?.cruises) {
      return cruisesQuery.data.cruises;
    }
    // Use local data when backend is offline
    return localData.cruises || [];
  }, [cruisesQuery.data, localData.cruises]);

  // Apply search filter to local data
  const filteredCruises = useMemo(() => {
    if (!filters.search) return allCruises;
    
    const searchLower = filters.search.toLowerCase();
    return allCruises.filter((cruise: any) => {
      const ship = (cruise.ship || '').toLowerCase();
      const itinerary = (cruise.itineraryName || cruise.itinerary || '').toLowerCase();
      const port = (cruise.departurePort || cruise.port || '').toLowerCase();
      const cabinType = (cruise.cabinType || '').toLowerCase();
      
      return ship.includes(searchLower) || 
             itinerary.includes(searchLower) || 
             port.includes(searchLower) ||
             cabinType.includes(searchLower);
    });
  }, [allCruises, filters.search]);

  // Filter available cruises (not conflicting with booked)
  const availableCruises = useMemo(() => {
    if (viewMode === 'all') return filteredCruises;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 180);
    const maxDateStr = maxDate.toISOString().split('T')[0];

    // Helper function to check if a cruise conflicts with booked cruises
    const checkCruiseAvailability = (cruise: any) => {
      const start = cruise?.departureDate ? new Date(cruise.departureDate) : null;
      if (!start || Number.isNaN(start.getTime())) return false;
      
      const nights = Number.isFinite(cruise?.nights) ? Number(cruise.nights) : 7;
      const end = new Date(start);
      end.setDate(end.getDate() + nights);

      // Check for conflicts with booked cruises
      const hasConflict = bookedCruises.some((bookedCruise: any) => {
        const bookedStartDate = bookedCruise.startDate || bookedCruise.departureDate;
        const bookedEndDate = bookedCruise.endDate || bookedCruise.returnDate;
        
        if (!bookedStartDate) return false;
        
        const bookedStart = new Date(bookedStartDate);
        let bookedEnd: Date;
        
        if (bookedEndDate) {
          bookedEnd = new Date(bookedEndDate);
        } else {
          const nights = bookedCruise.nights || 7;
          bookedEnd = new Date(bookedStart);
          bookedEnd.setDate(bookedEnd.getDate() + nights);
        }
        
        if (Number.isNaN(bookedStart.getTime()) || Number.isNaN(bookedEnd.getTime())) {
          return false;
        }
        
        // Add buffer days
        const bufferDays = 2;
        const bookedStartWithBuffer = new Date(bookedStart);
        bookedStartWithBuffer.setDate(bookedStartWithBuffer.getDate() - bufferDays);
        const bookedEndWithBuffer = new Date(bookedEnd);
        bookedEndWithBuffer.setDate(bookedEndWithBuffer.getDate() + bufferDays);
        
        const overlaps = (
          (start >= bookedStartWithBuffer && start <= bookedEndWithBuffer) ||
          (end >= bookedStartWithBuffer && end <= bookedEndWithBuffer) ||
          (start <= bookedStartWithBuffer && end >= bookedEndWithBuffer)
        );
        
        return overlaps;
      });

      return !hasConflict;
    };
    
    // Filter future cruises within 180 days that don't conflict
    let futureCruises = filteredCruises.filter((cruise) => {
      if (!cruise?.departureDate) return false;
      const isFuture = cruise.departureDate >= todayStr && cruise.departureDate <= maxDateStr;
      return isFuture;
    });
    
    let availableCruises = futureCruises.filter((cruise) => {
      return checkCruiseAvailability(cruise);
    });
    
    // Sort by departure date
    availableCruises.sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime());
    
    return availableCruises;
  }, [filteredCruises, bookedCruises, viewMode]);

  const displayCruises = viewMode === 'all' ? filteredCruises : availableCruises;

  const sortedDisplayCruises = useMemo(() => {
    if (sortMode === 'longest') {
      const list = [...displayCruises];
      list.sort((a: any, b: any) => {
        const an = Number.isFinite(a?.nights) ? Number(a.nights) : 0;
        const bn = Number.isFinite(b?.nights) ? Number(b.nights) : 0;
        if (bn !== an) return bn - an;
        const ad = a?.departureDate ? new Date(a.departureDate).getTime() : 0;
        const bd = b?.departureDate ? new Date(b.departureDate).getTime() : 0;
        return ad - bd;
      });
      return list;
    }
    return displayCruises;
  }, [displayCruises, sortMode]);
  const isLoading = isBackendEnabled && (cruisesQuery.isLoading || bookedCruisesQuery.isLoading);
  const hasError = isBackendEnabled && cruisesQuery.error && !cruisesQuery.isFetching;

  return (
    <View style={styles.container}>
      <View style={{ height: insets.top, backgroundColor: COLORS.background }} testID="safe-top-spacer" />
      <Stack.Screen options={{ headerShown: false }} />

      <HeroHeaderCompact totalCruises={Array.isArray(displayCruises) ? displayCruises.length : 0} hideStats />
      


      {/* View Mode Toggle and Search */}
      <View style={styles.controlsSection}>
        <View style={styles.viewToggle}>
          <TouchableOpacity 
            style={[styles.toggleButton, viewMode === 'all' && styles.toggleButtonActive]}
            onPress={() => setViewMode('all')}
          >
            <Text style={[styles.toggleText, viewMode === 'all' && styles.toggleTextActive]}>All Cruises</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, viewMode === 'available' && styles.toggleButtonActive]}
            onPress={() => setViewMode('available')}
          >
            <Text style={[styles.toggleText, viewMode === 'available' && styles.toggleTextActive]}>Available</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={18} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Search size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by dates, ships, itineraries, ports, nights, cabin type or passengers"
            value={filters.search}
            onChangeText={handleSearch}
            placeholderTextColor="#9CA3AF"
          />
        </View>
        <View style={styles.countsRow} testID="cruises-counts">
          <Text style={styles.countsText}>{`${sortedDisplayCruises.length} shown • ${bookedCruises.length} booked`}</Text>
          <TouchableOpacity
            testID="longest-pill"
            accessibilityLabel="Sort by longest cruises first"
            onPress={() => setSortMode(prev => (prev === 'longest' ? 'default' : 'longest'))}
            style={[styles.longestPill, sortMode === 'longest' && styles.longestPillActive]}
          >
            <Text style={[styles.longestPillText, sortMode === 'longest' && styles.longestPillTextActive]}>Longest</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity style={styles.filterChip}>
              <Calendar size={14} color="#6B7280" />
              <Text style={styles.filterChipText}>Dates</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterChip}>
              <Ship size={14} color="#6B7280" />
              <Text style={styles.filterChipText}>Ships</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterChip}>
              <MapPin size={14} color="#6B7280" />
              <Text style={styles.filterChipText}>Ports</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterChip}>
              <Clock size={14} color="#6B7280" />
              <Text style={styles.filterChipText}>Nights</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterChip}>
              <Users size={14} color="#6B7280" />
              <Text style={styles.filterChipText}>Cabin Type</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Casino Pays For Pills */}
      <View style={styles.casinoPaysSection}>
        <Text style={styles.casinoPaysLabel}>Casino Pays For:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsContainer}>
          <TouchableOpacity style={[styles.pill, styles.pillActive]}>
            <Text style={[styles.pillNumber, styles.pillNumberActive]}>1</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pill}>
            <Text style={styles.pillNumber}>2</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pillAI]}>
            <Sparkles size={16} color="#FFFFFF" />
            <Text style={styles.pillAIText}>AI Search</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pillLongest]}>
            <Text style={styles.pillLongestText}>Longest</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {hasError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Unable to load cruises</Text>
            <Text style={styles.errorMessage}>Please check your connection and try again</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => cruisesQuery.refetch()}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : displayCruises.length === 0 && !isLoading ? (
          <View style={styles.emptyContainer}>
            <Ship size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No {viewMode === 'available' ? 'Available' : ''} Cruises</Text>
            <Text style={styles.emptyMessage}>
              {filters.search 
                ? 'Try adjusting your search'
                : viewMode === 'available' 
                  ? `No cruises available in the next 180 days that fit your schedule. You have ${bookedCruises.length} booked cruises.`
                  : 'Import cruise data to get started'
              }
            </Text>
          </View>
        ) : (
          <View style={styles.cruiseList}>
            {sortedDisplayCruises.map((cruise: any, index: number) => {
              const unified = detectAndMapUnified(cruise);
              return (
                <View key={`${unified.id}-${index}`} style={styles.cruiseCard}>
                  <CruiseUnifiedCard
                    cruise={cruise}
                    mode="outer"
                    onPress={() => router.push(`/cruise/${unified.id}`)}
                  />
                </View>
              );
            })}
            
            {isLoading && sortedDisplayCruises.length > 0 && (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color="#6C5CE7" />
                <Text style={styles.loadingMoreText}>Loading...</Text>
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
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchIcon: {
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  statusLeft: {
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  statusSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  filtersContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filtersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  cabinFilters: {
    marginBottom: 12,
  },
  cabinFilter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cabinFilterActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  cabinFilterText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  cabinFilterTextActive: {
    color: '#ffffff',
  },
  clearFiltersButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ef4444',
  },
  clearFiltersText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    gap: 8,
  },
  importButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  cruiseList: {
    padding: 16,
    gap: 16,
  },
  cruiseCard: {
    marginBottom: 0,
  },
  cruiseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  shipName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  nights: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  itinerary: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  cruiseDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#64748b',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: '#059669',
  },
  originalPrice: {
    fontSize: 14,
    color: '#64748b',
    textDecorationLine: 'line-through',
  },
  savingsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savings: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  points: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7c3aed',
  },
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 14,
    color: '#64748b',
  },
  // New styles for the custom header and UI
  customHeader: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    position: 'relative',
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  controlsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  toggleTextActive: {
    color: '#1F2937',
    fontWeight: '600',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  countsRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countsText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  longestPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  longestPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  longestPillText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  longestPillTextActive: {
    color: '#FFFFFF',
  },
  filterScroll: {
    paddingHorizontal: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  casinoPaysSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  casinoPaysLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  pillsContainer: {
    flex: 1,
  },
  pill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pillActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  pillNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  pillNumberActive: {
    color: '#FFFFFF',
  },
  pillAI: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  pillAIText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pillLongest: {
    backgroundColor: '#FFA500',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  pillLongestText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cruiseImageContainer: {
    position: 'relative',
    height: 180,
    marginBottom: 12,
  },
  cruiseImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  availableBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: COLORS.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  availableBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cruiseInfo: {
    paddingHorizontal: 4,
  },
  cruiseDate: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  cruiseMetadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metadataText: {
    fontSize: 12,
    color: '#6B7280',
  },
  accommodationSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  accommodationLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  accommodationType: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  pricingButton: {
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pricingButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  // Points card styles
  pointsCard: {
    backgroundColor: '#6C5CE7',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  levelIcon: {
    fontSize: 14,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6C5CE7',
  },
  pointsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pointsIcon: {
    fontSize: 14,
  },
  pointsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pointsSeparator: {
    fontSize: 13,
    color: '#E9D5FF',
  },
  nextText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E9D5FF',
  },
});