import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Bookmark } from 'lucide-react-native';
import { HeroHeaderCompact } from '@/components/HeroHeaderCompact';
import { detectAndMapUnified } from '@/lib/unifiedCruise';
import type { UnifiedCruise } from '@/types/models';

import { createDateFromString } from '@/lib/date';
import { EmptyState } from '@/components/EmptyState';
import { useAppState } from '@/state/AppStateProvider';
import { useFocusEffect } from 'expo-router';
import { STATIC_BOOKED_CRUISES } from '@/state/staticBooked';
import { trpc } from '@/lib/trpc';
import { ShipInfoDisplay } from '@/components/ShipInfoDisplay';
import { CruiseCard } from '@/components/CruiseCard';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function BookedScreen() {
  const insets = useSafeAreaInsets();
  const { localData, hasLocalData, autoCompletePastCruises, bookCruise, unbookCruise, markCruiseCompleted } = useAppState();
  const [refreshing, setRefreshing] = React.useState<boolean>(false);

  const useUnifiedCards = true as const;

  const bookedCruisesQuery = trpc.bookedCruises.list.useQuery(undefined, {
    retry: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    enabled: true,
  });

  React.useEffect(() => {
    if (bookedCruisesQuery.error) {
      console.error('[Booked] Query error:', bookedCruisesQuery.error);
      console.log('[Booked] Falling back to local data due to backend error');
    }
    console.log('[Booked] Query data:', bookedCruisesQuery.data?.length || 0, 'cruises');
    if (bookedCruisesQuery.data && bookedCruisesQuery.data.length > 0) {
      console.log('[Booked] Query cruise details:', bookedCruisesQuery.data.map((c: any) => ({
        id: c.id,
        ship: c.ship,
        startDate: c.startDate || c.departureDate,
        reservationNumber: c.reservationNumber,
      })));
    }
  }, [bookedCruisesQuery.error, bookedCruisesQuery.data]);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const changed = await autoCompletePastCruises();
          if (changed > 0) {
            console.log(`[Booked] Auto-marked ${changed} past cruises as completed on focus`);
          }
        } catch (e) {
          console.error('[Booked] autoCompletePastCruises failed', e);
        }
      })();
      return undefined;
    }, [autoCompletePastCruises])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      console.log('[Booked] Starting refresh...');
      await bookedCruisesQuery.refetch();
      console.log('[Booked] Refresh completed successfully');
    } finally {
      setRefreshing(false);
    }
  }, [bookedCruisesQuery]);

  const backendBookedCruises = React.useMemo<any[]>(() => {
    if (bookedCruisesQuery.error || !bookedCruisesQuery.data) {
      console.log('[Booked] Using empty backend list due to error or no data');
      return [];
    }
    return bookedCruisesQuery.data;
  }, [bookedCruisesQuery.data, bookedCruisesQuery.error]);

  const allRelevantCruises = React.useMemo<any[]>(() => {
    const buildKey = (c: any): string => {
      try {
        const u = detectAndMapUnified(c);
        const ship = (u.ship ?? '').toLowerCase().trim();
        if (!ship) {
          console.warn('[Booked][Phase D] Missing ship name in cruise data');
        }
        const d = u.departureDate ?? c['Sailing Date'] ?? c['Start Date'] ?? c.startDate ?? c.departureDate ?? c['Departure Date'] ?? c.date ?? '';
        let iso = 'unknown';
        if (d) {
          try {
            const dt = createDateFromString(d);
            if (!isNaN(dt.getTime())) {
              iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
            } else {
              console.warn('[Booked][Phase D] Invalid date after parsing:', d);
            }
          } catch (dateErr) {
            console.warn('[Booked][Phase D] Date parsing error:', dateErr, 'for date:', d);
          }
        } else {
          console.warn('[Booked][Phase D] Missing departure date in cruise data');
        }
        const res = (u.reservationNumber ?? c['Reservation #'] ?? c['Reservation'] ?? c['BOOKING ID#'] ?? c.bookingNumber ?? '').toString().trim().toLowerCase();
        return `${ship}|${iso}|${res}`;
      } catch (e) {
        console.error('[Booked][Phase D] buildKey failed with error:', e);
        return `unknown|unknown|${Math.random().toString(36).slice(2)}`;
      }
    };

    const evidenceScore = (c: any): number => {
      const hasRes = !!(c.reservationNumber || c['Reservation #'] || c['Reservation'] || c['BOOKING ID#'] || c.bookingNumber);
      const hasReceipt = !!(c.hasReceiptData || c.receiptData || c.receipt || c.receipts);
      const hasStatement = !!(c.hasStatementData || c.statementData || c.statement || c.statements || c.clubRoyaleEntertainmentCharges || c.onboardCharges || c.casinoCharges || c.totalCharges);
      const isBooked = !!(c.isBooked || c.status === 'booked' || c.bookingStatus === 'confirmed');
      return (hasRes ? 3 : 0) + (hasReceipt ? 2 : 0) + (hasStatement ? 2 : 0) + (isBooked ? 1 : 0);
    };

    const dedupeMerge = (lists: any[][]): any[] => {
      const map = new Map<string, any>();
      let duplicatesFound = 0;
      lists.forEach((arr, listIdx) => {
        arr.forEach((item) => {
          const key = buildKey(item);
          const prev = map.get(key);
          if (!prev) {
            map.set(key, item);
          } else {
            duplicatesFound++;
            const prevScore = evidenceScore(prev);
            const itemScore = evidenceScore(item);
            if (itemScore > prevScore) {
              console.log('[Booked][Phase D] Replacing duplicate with higher evidence score:', {
                key,
                prevScore,
                itemScore,
                listIdx,
              });
              map.set(key, { ...prev, ...item });
            } else {
              console.log('[Booked][Phase D] Keeping existing entry with higher/equal evidence score:', {
                key,
                prevScore,
                itemScore,
                listIdx,
              });
            }
          }
        });
      });
      console.log('[Booked][Phase D] Deduplication complete:', {
        totalInput: lists.reduce((sum, arr) => sum + arr.length, 0),
        duplicatesFound,
        uniqueOutput: map.size,
      });
      return Array.from(map.values());
    };

    const staticList = Array.isArray(STATIC_BOOKED_CRUISES) ? [...STATIC_BOOKED_CRUISES] : [];
    const backendList = Array.isArray(backendBookedCruises) ? backendBookedCruises.slice() : [];

    let localList: any[] = [];
    if (hasLocalData && Array.isArray(localData.cruises) && localData.cruises.length > 0) {
      console.log('[Booked] Checking local data for additional cruises:', localData.cruises.length);
      localList = localData.cruises.filter((cruise: any) => {
        const shipName = (cruise.ship || cruise['Ship Name'] || cruise.Ship || '').toLowerCase();
        if (!shipName) return false;
        const hasReceiptData = cruise.receiptData || cruise.receipt || cruise.receipts || cruise.reservationNumber || cruise['Reservation #'] || cruise['Reservation'] || cruise['RESERVATION'] || cruise['Booking ID'] || cruise['BOOKING ID#'] || cruise.bookingId || cruise.bookingNumber || cruise.confirmationNumber || cruise.hasReceiptData;
        const hasStatementData = cruise.statementData || cruise.statement || cruise.statements || cruise.clubRoyaleEntertainmentCharges || cruise.onboardCharges || cruise.casinoCharges || cruise.totalCharges || cruise.hasStatementData;
        const isBooked = cruise.isBooked || cruise.status === 'booked' || cruise.bookingStatus === 'confirmed';
        return hasReceiptData || hasStatementData || isBooked;
      });
    }

    const merged = dedupeMerge([localList, backendList, staticList]);

    console.log('[Booked] Final relevant cruises count (deduped):', merged.length);

    const getStart = (c: any) => c['Sailing Date'] || c['Start Date'] || c.startDate || c.departureDate || c['Departure Date'] || c.date || c['SAILING DATE'] || c['START DATE'];
    return merged.slice().sort((a: any, b: any) => {
      const da = createDateFromString(getStart(a) || '2099-12-31').getTime();
      const db = createDateFromString(getStart(b) || '2099-12-31').getTime();
      return da - db;
    });
  }, [hasLocalData, localData.cruises, backendBookedCruises]);

  const unifiedAllCruises = React.useMemo<UnifiedCruise[]>(() => {
    const mapped = allRelevantCruises.map((c: any) => {
      const u = detectAndMapUnified(c);
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dep = u.departureDate ? new Date(u.departureDate) : null;
        const ret = u.returnDate ? new Date(u.returnDate) : null;
        if (dep && (ret || u.nights)) {
          const end = ret ?? new Date(dep.getTime() + ((u.nights ?? 0) * 24 * 60 * 60 * 1000));
          end.setHours(0, 0, 0, 0);
          if (end < today) return { ...u, status: 'completed' as const };
          if (dep > today) return { ...u, status: 'upcoming' as const };
          return { ...u, status: 'in-progress' as const };
        }
      } catch {}
      return u;
    });

    const missingDates = mapped.filter(m => !m.departureDate).length;
    const withResNumbers = mapped.filter(m => !!m.reservationNumber).length;
    console.log('[Booked][Phase A] Unified mapping complete:', {
      total: mapped.length,
      missingDepartureDates: missingDates,
      withReservationNumbers: withResNumbers,
      sourcesBreakdown: mapped.reduce<Record<string, number>>((acc, m) => {
        acc[m.source] = (acc[m.source] ?? 0) + 1;
        return acc;
      }, {}),
      statuses: mapped.reduce<Record<string, number>>((acc, m) => {
        const key = m.status ?? 'unknown';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {}),
    });

    return mapped;
  }, [allRelevantCruises]);

  const unifiedSplit = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future: UnifiedCruise[] = [];
    const past: UnifiedCruise[] = [];

    unifiedAllCruises.forEach((u) => {
      const depStr = u.departureDate ?? null;
      const retStr = u.returnDate ?? null;
      try {
        if (!depStr) {
          future.push(u);
          return;
        }
        const dep = new Date(depStr);
        const end = retStr ? new Date(retStr) : new Date(dep.getTime() + ((u.nights ?? 7) * 24 * 60 * 60 * 1000));
        dep.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        if (end < today) past.push(u); else future.push(u);
      } catch {
        future.push(u);
      }
    });

    console.log('[Booked][Phase A] Unified split:', { future: future.length, past: past.length });
    return { future, past };
  }, [unifiedAllCruises]);

  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('asc');
  const [showCompleted, setShowCompleted] = React.useState<boolean>(true);

  const filteredAllCruises = React.useMemo<any[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = q.length === 0
      ? allRelevantCruises
      : allRelevantCruises.filter((c: any) => {
          const ship = (c.ship || c['Ship Name'] || c.Ship || '').toLowerCase();
          const itin = (c.itineraryName || c['Itinerary'] || c.Itinerary || '').toLowerCase();
          const port = (c.departurePort || c['Departure Port'] || '').toLowerCase();
          const res = (c.reservationNumber || c['Reservation'] || c['Reservation #'] || '').toString().toLowerCase();
          return ship.includes(q) || itin.includes(q) || port.includes(q) || res.includes(q);
        });
    const getStart = (c: any) => c['Sailing Date'] || c['Start Date'] || c.startDate || c.departureDate || c['Departure Date'] || c.date;
    return list.slice().sort((a: any, b: any) => {
      const da = createDateFromString(getStart(a) || '2099-12-31').getTime();
      const db = createDateFromString(getStart(b) || '2099-12-31').getTime();
      return sortOrder === 'asc' ? da - db : db - da;
    });
  }, [allRelevantCruises, searchQuery, sortOrder]);

  const filteredSplit = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future: any[] = [];
    const past: any[] = [];
    filteredAllCruises.forEach((cruise: any) => {
      const departureDate = cruise['Sailing Date'] || cruise['Start Date'] || cruise.startDate || cruise.departureDate || cruise['Departure Date'] || cruise.date;
      if (departureDate) {
        try {
          const cruiseDate = createDateFromString(departureDate);
          cruiseDate.setHours(0,0,0,0);
          if (cruiseDate <= today) past.push(cruise); else future.push(cruise);
        } catch {
          future.push(cruise);
        }
      } else {
        future.push(cruise);
      }
    });
    return { future, past };
  }, [filteredAllCruises]);

  const summaryStats = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let bookedCount = 0;
    let completedCount = 0;
    let receiptsCount = 0;

    allRelevantCruises.forEach((cruise: any) => {
      const departureDate = cruise['Sailing Date'] || cruise['Start Date'] || cruise.startDate || cruise.departureDate || cruise['Departure Date'] || cruise.date;
      if (departureDate) {
        try {
          const cruiseDate = createDateFromString(departureDate);
          cruiseDate.setHours(0, 0, 0, 0);
          if (cruiseDate > today) {
            bookedCount++;
          } else {
            completedCount++;
            const hasReceiptData = cruise.hasReceiptData || cruise.receiptData || cruise.receipt || cruise.receipts;
            const hasStatementData = cruise.hasStatementData || cruise.statementData || cruise.statement || cruise.statements || cruise.clubRoyaleEntertainmentCharges || cruise.onboardCharges || cruise.casinoCharges || cruise.totalCharges;
            if (hasReceiptData || hasStatementData) {
              receiptsCount++;
            }
          }
        } catch {
          bookedCount++;
        }
      } else {
        bookedCount++;
      }
    });

    console.log('[Booked] Summary Stats - Booked:', bookedCount, 'Completed:', completedCount, 'With Receipts/Statements:', receiptsCount);

    return { bookedCount, completedCount, receiptsCount };
  }, [allRelevantCruises]);

  const MAX_RENDER = 100 as const;

  React.useEffect(() => {
    console.log('[Booked][Phase D & E Complete] ✅ Edge cases handled, performance optimized:', {
      totalCruises: allRelevantCruises.length,
      filteredCruises: filteredAllCruises.length,
      futureCruises: filteredSplit.future.length,
      pastCruises: filteredSplit.past.length,
      renderCap: MAX_RENDER,
      hasErrorBoundary: true,
      hasTestIDs: true,
      hasMemoization: true,
    });
  }, [allRelevantCruises.length, filteredAllCruises.length, filteredSplit.future.length, filteredSplit.past.length]);

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <View style={{ height: insets.top, backgroundColor: '#F8FAFC' }} testID="safe-top-spacer" />
        <HeroHeaderCompact totalCruises={filteredAllCruises.length} hideStats />
        <ScrollView 
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          testID="booked-screen"
        >
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{summaryStats.bookedCount}</Text>
              <Text style={styles.statLabel}>UPCOMING</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{summaryStats.completedCount}</Text>
              <Text style={styles.statLabel}>COMPLETED</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{summaryStats.receiptsCount}</Text>
              <Text style={styles.statLabel}>WITH DATA</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{unifiedAllCruises.length}</Text>
              <Text style={styles.statLabel}>TOTAL</Text>
            </View>
          </View>
        </View>

        <View style={styles.quickActionsGrid}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={onRefresh}
            testID="booked-refresh-top"
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.refreshIcon}>⟳</Text>
            </View>
            <Text style={styles.actionButtonText}>Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowCompleted(prev => !prev)}
            testID="booked-toggle-completed"
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.refreshIcon}>{showCompleted ? '👁' : '🙈'}</Text>
            </View>
            <Text style={styles.actionButtonText}>{showCompleted ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setSearchQuery("")}
            testID="booked-clear-search"
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.refreshIcon}>✕</Text>
            </View>
            <Text style={styles.actionButtonText}>Clear Filters</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
            testID="booked-sort-toggle-top"
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.refreshIcon}>⇅</Text>
            </View>
            <Text style={styles.actionButtonText}>Sort</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.controls}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search ship, itinerary, port, reservation #"
            placeholderTextColor="#9CA3AF"
            testID="booked-search-input"
          />
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
            testID="booked-sort-toggle"
          >
            <Text style={styles.sortButtonText}>{sortOrder === 'asc' ? '📅 Oldest First' : '📅 Newest First'}</Text>
          </TouchableOpacity>
        </View>

        {filteredSplit.future.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🔮 Booked Cruises</Text>
              <Text style={styles.sectionSubtitle}>Future cruises that are actually booked</Text>
            </View>
            <View style={styles.cruisesList}>
              {filteredSplit.future.slice(0, MAX_RENDER).map((cruise: any, index: number) => {
                const shipName: string = (cruise.ship || cruise['Ship Name'] || 'unknown').replace(/\s+/g, '-').toLowerCase();
                const sailDate: string = (cruise.departureDate || cruise['Sailing Date'] || cruise.startDate || 'unknown').toString().replace(/\//g, '-');
                const cruiseId: string = cruise.id || `temp-${shipName}-${sailDate}-${index}`;

                const handlePress = () => {
                  console.log(`[Booked] Tapped cruise ${cruiseId}`);
                  const completeCruiseData = {
                    id: cruise.id || cruiseId,
                    ship: cruise.ship || cruise['Ship Name'] || cruise.Ship || 'Unknown Ship',
                    departureDate: cruise.startDate || cruise['Start Date'] || cruise.departureDate || cruise['Sailing Date'],
                    returnDate: cruise.endDate || cruise['End Date'] || cruise.returnDate,
                    nights: cruise.nights || cruise['Nights'] || cruise.Nights || 7,
                    itineraryName: cruise.itineraryName || cruise['Itinerary'] || cruise.Itinerary || 'Unknown Itinerary',
                    departurePort: cruise.departurePort || cruise['Departure Port'] || 'Unknown Port',
                    isBooked: true,
                    reservationNumber: cruise.reservationNumber || cruise['Reservation'] || cruise['Booking ID'] || cruise['BOOKING ID#'],
                    paidFare: cruise.paidFare || cruise['Paid Fare'] || 0,
                    actualFare: cruise.actualFare || cruise['Actual Fare'] || 0,
                    currentMarketPrice: cruise.currentMarketPrice || cruise['Current Market Price'] || 0,
                    actualSavings: cruise.actualSavings || cruise['Actual Savings'] || 0,
                    projectedSavings: cruise.projectedSavings || cruise['Projected Savings'] || 0,
                    ...cruise,
                  } as const;

                  if (cruise.id) {
                    console.log(`[Booked] Navigating to cruise with real ID: ${cruise.id}`);
                    router.push(`/cruise/${encodeURIComponent(cruise.id)}`);
                  } else {
                    console.log(`[Booked] Navigating with temporary ID and complete data: ${cruiseId}`);
                    const queryParams = new URLSearchParams({ bookedData: JSON.stringify(completeCruiseData) }).toString();
                    router.push(`/cruise/${encodeURIComponent(cruiseId)}?${queryParams}`);
                  }
                };

                return useUnifiedCards ? (
                  <View key={`booked-unified-${cruiseId}`} testID={`booked-unified-${cruiseId}`}>
                    <CruiseCard cruise={{ ...cruise, isBooked: true }} onPress={handlePress} />
                  </View>
                ) : (
                  <TouchableOpacity
                    key={`booked-cruise-${cruiseId}`}
                    style={styles.cruiseCard}
                    onPress={handlePress}
                    testID={`booked-cruise-${cruiseId}`}
                  >
                    <View style={styles.bookedBadge}>
                      <Text style={styles.bookedText}>✓ UPCOMING</Text>
                    </View>
                    <View style={styles.cruiseHeader}>
                      <Text style={styles.cruiseShip}>{(cruise.ship || cruise['Ship Name'] || cruise.Ship || 'Unknown Ship').replace(/\[R\]/g, '®')}</Text>
                    </View>
                    <ShipInfoDisplay shipName={cruise.ship || cruise['Ship Name'] || cruise.Ship || 'Unknown Ship'} compact />
                  </TouchableOpacity>
                );
              })}
              {filteredSplit.future.length > MAX_RENDER && (
                <Text style={styles.completedCount} testID="future-capped-note">Showing first {MAX_RENDER} results</Text>
              )}
            </View>
          </>
        )}

        {showCompleted && filteredSplit.past.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📋 Completed Cruises</Text>
              <Text style={styles.sectionSubtitle}>Past cruises with receipts and statements</Text>
            </View>
            <View style={styles.cruisesList}>
              {filteredSplit.past.slice(0, MAX_RENDER).map((cruise: any, index: number) => {
                const shipName: string = (cruise.ship || cruise['Ship Name'] || 'unknown').replace(/\s+/g, '-').toLowerCase();
                const sailDate: string = (cruise.departureDate || cruise['Sailing Date'] || cruise.startDate || 'unknown').toString().replace(/\//g, '-');
                const cruiseId: string = cruise.id || `temp-completed-${shipName}-${sailDate}-${index}`;

                const handlePress = () => {
                  console.log(`[Completed] Tapped cruise ${cruiseId}`);
                  const completeCruiseData = {
                    id: cruise.id || cruiseId,
                    ship: cruise.ship || cruise['Ship Name'] || cruise.Ship || 'Unknown Ship',
                    departureDate: cruise.startDate || cruise['Start Date'] || cruise.departureDate || cruise['Sailing Date'],
                    returnDate: cruise.endDate || cruise['End Date'] || cruise.returnDate,
                    nights: cruise.nights || cruise['Nights'] || cruise.Nights || 7,
                    itineraryName: cruise.itineraryName || cruise['Itinerary'] || cruise.Itinerary || 'Unknown Itinerary',
                    departurePort: cruise.departurePort || cruise['Departure Port'] || 'Unknown Port',
                    isBooked: true,
                    reservationNumber: cruise.reservationNumber || cruise['Reservation #'] || cruise['Booking ID'] || cruise['BOOKING ID#'],
                    paidFare: cruise.paidFare || cruise['Paid Fare'] || 0,
                    actualFare: cruise.actualFare || cruise['Actual Fare'] || 0,
                    currentMarketPrice: cruise.currentMarketPrice || cruise['Current Market Price'] || 0,
                    actualSavings: cruise.actualSavings || cruise['Actual Savings'] || 0,
                    projectedSavings: cruise.projectedSavings || cruise['Projected Savings'] || 0,
                    ...cruise,
                  } as const;

                  if (cruise.id) {
                    console.log(`[Completed] Navigating to cruise with real ID: ${cruise.id}`);
                    router.push(`/cruise/${encodeURIComponent(cruise.id)}`);
                  } else {
                    console.log(`[Completed] Navigating with temporary ID and complete data: ${cruiseId}`);
                    const queryParams = new URLSearchParams({ bookedData: JSON.stringify(completeCruiseData) }).toString();
                    router.push(`/cruise/${encodeURIComponent(cruiseId)}?${queryParams}`);
                  }
                };

                return useUnifiedCards ? (
                  <View key={`completed-unified-${cruiseId}`} testID={`completed-unified-${cruiseId}`}>
                    <CruiseCard cruise={{ ...cruise, isCompleted: true }} onPress={handlePress} />
                  </View>
                ) : (
                  <TouchableOpacity
                    key={`completed-cruise-${cruiseId}`}
                    style={styles.cruiseCard}
                    onPress={handlePress}
                    testID={`completed-cruise-${cruiseId}`}
                  >
                    <View style={styles.completedBadge}>
                      <Text style={styles.completedText}>✓ COMPLETED</Text>
                    </View>
                    <View style={styles.cruiseHeader}>
                      <Text style={styles.cruiseShip}>{(cruise.ship || cruise['Ship Name'] || cruise.Ship || 'Unknown Ship').replace(/\[R\]/g, '®')}</Text>
                    </View>
                    <ShipInfoDisplay shipName={cruise.ship || cruise['Ship Name'] || cruise.Ship || 'Unknown Ship'} compact />
                  </TouchableOpacity>
                );
              })}
              {filteredSplit.past.length > MAX_RENDER && (
                <Text style={styles.completedCount} testID="past-capped-note">Showing first {MAX_RENDER} results</Text>
              )}
            </View>
          </>
        )}

        {filteredAllCruises.length === 0 && (
          <EmptyState
            icon={<Bookmark size={48} color="#6B7280" />}
            title="No booked cruises found"
            description="No cruises match your filters. Clear search or adjust sorting to see results."
            actionLabel="Browse Cruises"
            onAction={() => router.push('/(tabs)/(cruises)')}
          />
        )}
        </ScrollView>
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E6F2FF',
  },
  scrollView: {
    flex: 1,
  },
  countSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    alignItems: 'center',
  },
  countTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  countSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  cruisesList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  cruiseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  bookedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#22C55E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 1,
  },
  bookedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  cruiseHeader: {
    marginBottom: 12,
  },
  cruiseShip: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginRight: 80,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#003B6F',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  completedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 1,
  },
  completedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  controls: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 8,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  actionButtonText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  refreshIcon: {
    fontSize: 22,
    fontWeight: '700',
    color: '#003B6F',
  },
  searchInput: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  sortButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  sortButtonText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#003B6F',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 9,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  miniStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  miniStatNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#003B6F',
  },
  miniStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  miniStatDivider: {
    fontSize: 16,
    color: '#D1D5DB',
    marginHorizontal: 12,
  },
  futureCount: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2,
    fontWeight: '500',
  },
  completedCount: {
    fontSize: 12,
    color: '#8B5CF6',
    marginTop: 2,
    fontWeight: '500',
  },
});
