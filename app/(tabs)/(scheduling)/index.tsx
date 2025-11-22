import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Platform,

} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { 
  Ship, 
  
  
  
  Filter, 
  Search,
  Plus,
  Bell,
  X,
  
  
  
  Check
} from 'lucide-react-native';
import { HeroHeaderCompact } from '@/components/HeroHeaderCompact';
import { CruiseCard } from '@/components/CruiseCard';
import { useAppState } from '@/state/AppStateProvider';
import { useFocusEffect } from 'expo-router';
import { DEFAULT_USER_PREFERENCES } from '@/types/models';
import { STATIC_BOOKED_CRUISES } from '@/state/staticBooked';
import { createDateFromString } from '@/lib/date';
import { useFilters } from '@/state/FiltersProvider';
import { useUser } from '@/state/UserProvider';
import { useCruiseStore } from '@/state/CruiseStore';

export default function SchedulingScreen() {
  const insets = useSafeAreaInsets();
  const { localData, userPoints, updateUserPoints, autoCompletePastCruises } = useAppState();
  const { cruises: storedCruises, isLoading: cruiseStoreLoading, reload: reloadCruiseStore } = useCruiseStore();
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [activeTab, setActiveTab] = React.useState<'available' | 'all' | 'booked' | 'picked4u'>('available');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [showFilters, setShowFilters] = React.useState<boolean>(false);
  const [showAddPoints, setShowAddPoints] = React.useState<boolean>(false);
  const [showUserSwitcher, setShowUserSwitcher] = React.useState<boolean>(false);
  const [pointsInput, setPointsInput] = React.useState<string>('');
  const { filters } = useFilters();
  const { users, currentUser, switchUser, addUser } = useUser();
  
  // Filter states
  const [filterDates, setFilterDates] = React.useState<{start?: string, end?: string}>({});
  const [filterShips, setFilterShips] = React.useState<string[]>([]);
  const [filterItineraries, setFilterItineraries] = React.useState<string[]>([]);
  const [filterPorts, setFilterPorts] = React.useState<string[]>([]);
  const [filterNights, setFilterNights] = React.useState<number[]>([]);

  
  // Filter modal states
  const [tempFilterDates, setTempFilterDates] = React.useState<{start?: string, end?: string}>({});
  const [tempFilterShips, setTempFilterShips] = React.useState<string[]>([]);
  const [tempFilterItineraries, setTempFilterItineraries] = React.useState<string[]>([]);
  const [tempFilterPorts, setTempFilterPorts] = React.useState<string[]>([]);
  const [tempFilterNights, setTempFilterNights] = React.useState<number[]>([]);

  
  console.log('[Scheduling] Component mounted');
  
  // When screen gains focus, auto-mark past sailings as completed
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const changed = await autoCompletePastCruises();
          if (changed > 0) {
            console.log(`[Scheduling] Auto-marked ${changed} past cruises as completed on focus`);
          }
        } catch (e) {
          console.error('[Scheduling] autoCompletePastCruises failed', e);
        }
      })();
      return undefined;
    }, [autoCompletePastCruises])
  );

  // Get user profile for points display - simplified without backend dependency
  const userProfileQuery = React.useMemo(() => ({
    data: null,
    isLoading: false,
    isError: false
  }), []);
  
  // Get booked cruises to check availability - use static data for now
  const bookedCruisesQuery = React.useMemo(() => ({
    data: STATIC_BOOKED_CRUISES,
    isLoading: false,
    isError: false,
    error: null,
    refetch: async () => {}
  }), []);
  
  const handleAddPoints = () => {
    const points = parseInt(pointsInput);
    if (!isNaN(points) && points > 0) {
      const newTotal = (userPoints || 0) + points;
      updateUserPoints(newTotal);
      setPointsInput('');
      setShowAddPoints(false);
    }
  };
  
  // Get all cruises from CruiseStore (persistent storage)
  const cruisesQuery = React.useMemo(() => ({
    data: {
      cruises: storedCruises || [],
      total: storedCruises?.length || 0,
      hasMore: false
    },
    isLoading: cruiseStoreLoading,
    isError: false,
    error: null,
    refetch: async () => {
      await reloadCruiseStore();
    }
  }), [storedCruises, cruiseStoreLoading, reloadCruiseStore]);
  
  React.useEffect(() => {
    if (cruisesQuery.data?.cruises) {
      console.log('[Scheduling] Fetched cruises:', cruisesQuery.data.cruises.length);
      console.log('[Scheduling] Sample cruise:', cruisesQuery.data.cruises[0]);
    }
    if (bookedCruisesQuery.data) {
      console.log('[Scheduling] Fetched booked cruises:', bookedCruisesQuery.data.length);
      if (bookedCruisesQuery.data.length > 0) {
        console.log('[Scheduling] Sample booked cruise:', bookedCruisesQuery.data[0]);
      }
    }
  }, [cruisesQuery.data, bookedCruisesQuery.data]);
  
  const bookedCruises = React.useMemo(() => {
    if (bookedCruisesQuery.data) {
      console.log('[Scheduling] Using booked cruises:', bookedCruisesQuery.data.length);
      return bookedCruisesQuery.data;
    }
    // Use ALL local booked cruises (do not require reservation/booking ID)
    if (localData.booked) {
      const result = localData.booked.length > 0 ? localData.booked : STATIC_BOOKED_CRUISES;
      console.log('[Scheduling] Using local booked cruises (all):', result.length);
      return result;
    }
    console.log('[Scheduling] Using static booked cruises:', STATIC_BOOKED_CRUISES.length);
    return STATIC_BOOKED_CRUISES;
  }, [bookedCruisesQuery.data, localData.booked]);
  
  // Normalize end date using departure + nights when provided end date looks off
  const calculateEndDate = React.useCallback((startDate: Date, nightsInput?: unknown, providedEnd?: unknown): Date => {
    const nights = typeof nightsInput === 'number' && Number.isFinite(nightsInput) ? nightsInput : (() => {
      if (typeof nightsInput === 'string') {
        const n = parseInt(nightsInput, 10);
        return Number.isFinite(n) ? n : NaN;
      }
      return NaN;
    })();

    const computed = new Date(startDate);
    if (Number.isFinite(nights) && nights > 0) {
      computed.setDate(computed.getDate() + (nights as number));
    } else {
      computed.setDate(computed.getDate() + 7);
    }

    if (providedEnd) {
      let provided: Date | null = null;
      if (providedEnd instanceof Date) provided = providedEnd;
      else if (typeof providedEnd === 'string') provided = createDateFromString(providedEnd);
      if (provided && !Number.isNaN(provided.getTime())) {
        const diffDays = Math.round((provided.getTime() - startDate.getTime()) / 86400000);
        if (diffDays <= 0 || Math.abs(diffDays - (Number.isFinite(nights) ? (nights as number) : 7)) >= 1) {
          return computed;
        }
        return provided;
      }
    }
    return computed;
  }, []);

  const allCruises = React.useMemo(() => {
    if (cruisesQuery.data?.cruises) {
      console.log('[Scheduling] Using cruises:', cruisesQuery.data.cruises.length);
      return cruisesQuery.data.cruises;
    }
    console.log('[Scheduling] Using local cruises:', localData.cruises?.length || 0);
    return localData.cruises || [];
  }, [cruisesQuery.data, localData.cruises]);
  
  // Apply search and filters to cruises using unified fields only
  const filteredCruises = React.useMemo(() => {
    const base = Array.isArray(allCruises) ? allCruises : [];
    let filtered = base.slice(0);

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((cruise: any) => {
        const ship = (cruise.ship ?? '').toLowerCase();
        const itin = (cruise.itineraryName ?? '').toLowerCase();
        const port = (cruise.departurePort ?? '').toLowerCase();
        const date = (cruise.departureDate ?? '').toLowerCase();
        return ship.includes(query) || itin.includes(query) || port.includes(query) || date.includes(query);
      });
    }

    if (filterDates.start || filterDates.end) {
      filtered = filtered.filter((cruise: any) => {
        const dep = cruise?.departureDate;
        if (!dep) return false;
        if (filterDates.start && dep < filterDates.start) return false;
        if (filterDates.end && dep > filterDates.end) return false;
        return true;
      });
    }

    if (filterShips.length > 0) {
      filtered = filtered.filter((cruise: any) => filterShips.includes(cruise.ship));
    }

    if (filterItineraries.length > 0) {
      filtered = filtered.filter((cruise: any) =>
        filterItineraries.some((itin) => (cruise.itineraryName ?? '').toLowerCase().includes(itin.toLowerCase()))
      );
    }

    if (filterPorts.length > 0) {
      filtered = filtered.filter((cruise: any) =>
        filterPorts.some((p) => (cruise.departurePort ?? '').toLowerCase().includes(p.toLowerCase()))
      );
    }

    if (filterNights.length > 0) {
      filtered = filtered.filter((cruise: any) => filterNights.includes(cruise.nights));
    }

    return filtered;
  }, [allCruises, searchQuery, filterDates, filterShips, filterItineraries, filterPorts, filterNights]);
  
  // Filter and sort available cruises (not conflicting with booked) + smart rules
  const availableCruises = React.useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 365);
    const maxDateStr = maxDate.toISOString().split('T')[0];
    
    console.log('[Scheduling] Processing cruises:', {
      totalCruises: allCruises.length,
      bookedCruises: bookedCruises.length,
      todayStr,
      maxDateStr
    });
    
    // Helper function to check if a cruise conflicts with booked cruises
    const checkCruiseAvailability = (cruise: any) => {
      const start = cruise?.departureDate ? new Date(cruise.departureDate) : null;
      if (!start || Number.isNaN(start.getTime())) {
        console.log('[Scheduling] Invalid departure date for cruise:', cruise.id, cruise.departureDate);
        return false;
      }
      
      // Calculate end date
      const end = (() => {
        const d = calculateEndDate(start, cruise?.nights, cruise?.returnDate);
        return d;
      })();

      // Check for conflicts with booked cruises
      const hasConflict = bookedCruises.some((bookedCruise: any) => {
        // Try multiple field names for booked cruise dates
        const bookedStartDate = bookedCruise.startDate || 
                               bookedCruise['Start Date'] || 
                               bookedCruise.departureDate || 
                               bookedCruise['Sailing Date'] ||
                               bookedCruise['Departure Date'];
        
        const bookedEndDate = bookedCruise.endDate || 
                             bookedCruise['End Date'] || 
                             bookedCruise.returnDate ||
                             bookedCruise['Return Date'];
        
        if (!bookedStartDate) {
          console.log('[Scheduling] No start date found for booked cruise:', Object.keys(bookedCruise));
          return false;
        }
        
        const bookedStart = new Date(bookedStartDate);
        let bookedEnd: Date;
        
        if (bookedEndDate) {
          bookedEnd = new Date(bookedEndDate);
        } else {
          // Calculate end date from start date + nights
          const nights = bookedCruise.nights || 
                        bookedCruise['Nights'] || 
                        bookedCruise.Nights || 
                        bookedCruise['Length'] ||
                        7;
          bookedEnd = new Date(bookedStart);
          bookedEnd.setDate(bookedEnd.getDate() + nights);
        }
        
        if (Number.isNaN(bookedStart.getTime()) || Number.isNaN(bookedEnd.getTime())) {
          console.log('[Scheduling] Invalid booked cruise dates:', {
            startDate: bookedStartDate,
            endDate: bookedEndDate,
            bookedStart: bookedStart.toString(),
            bookedEnd: bookedEnd.toString()
          });
          return false;
        }
        
        // Check for date overlap - any overlap means conflict
        // Add buffer days: cruise can't start within 2 days of booked cruise ending
        // and can't end within 2 days of booked cruise starting
        const bufferDays = 2;
        const bookedStartWithBuffer = new Date(bookedStart);
        bookedStartWithBuffer.setDate(bookedStartWithBuffer.getDate() - bufferDays);
        const bookedEndWithBuffer = new Date(bookedEnd);
        bookedEndWithBuffer.setDate(bookedEndWithBuffer.getDate() + bufferDays);
        
        const overlaps = (
          (start >= bookedStartWithBuffer && start <= bookedEndWithBuffer) || // Cruise starts during booked cruise (with buffer)
          (end >= bookedStartWithBuffer && end <= bookedEndWithBuffer) || // Cruise ends during booked cruise (with buffer)
          (start <= bookedStartWithBuffer && end >= bookedEndWithBuffer) // Cruise spans entire booked cruise
        );
        
        if (overlaps) {
          console.log('[Scheduling] Date conflict found (with buffer):', {
            cruiseShip: cruise.ship,
            cruiseStart: start.toISOString().split('T')[0],
            cruiseEnd: end.toISOString().split('T')[0],
            bookedShip: bookedCruise.ship || bookedCruise['Ship'],
            bookedStart: bookedStart.toISOString().split('T')[0],
            bookedEnd: bookedEnd.toISOString().split('T')[0]
          });
        }
        
        return overlaps;
      });

      return !hasConflict;
    };
    
    // If showing all cruises, use filtered cruises
    if (activeTab === 'all') {
      return filteredCruises.sort((a, b) => {
        const dateA = new Date(a.departureDate || '2099-12-31').getTime();
        const dateB = new Date(b.departureDate || '2099-12-31').getTime();
        return dateA - dateB;
      }).slice(0, 50); // Limit to 50 for performance
    }
    
    // Otherwise, show only available cruises (not conflicting)
    // First filter: only future cruises within 365 days with valid dates
    let futureCruises = filteredCruises.filter((cruise) => {
      const depRaw = cruise?.departureDate;
      if (!depRaw) {
        console.log('[Scheduling] No departure date for cruise:', cruise.id);
        return false;
      }
      const depOnly = String(depRaw).slice(0, 10);
      const isFuture = depOnly >= todayStr && depOnly <= maxDateStr;
      return isFuture;
    });
    
    console.log('[Scheduling] Future cruises (within 365 days):', futureCruises.length);
    
    // Always check for conflicts with booked cruises - even if we have no booked cruises,
    // we should still apply reasonable limits
    let availableCruises = futureCruises.filter((cruise) => {
      const isAvailable = checkCruiseAvailability(cruise);
      return isAvailable;
    });
    
    console.log('[Scheduling] Available cruises after conflict check:', availableCruises.length);
    
    // Budget filter (from global filters)
    const budgetNum = typeof filters.maxBudget === 'number' ? filters.maxBudget : NaN;
    if (!Number.isNaN(budgetNum)) {
      availableCruises = availableCruises.filter((c: any) => {
        const price = c.paidFare ?? c.actualFare ?? c.currentMarketPrice ?? Infinity;
        return typeof price === 'number' && price <= budgetNum;
      });
      console.log('[Scheduling] Budget filter applied <=', budgetNum, 'remaining:', availableCruises.length);
    }

    // Sort by departure date (closest to today first)
    availableCruises.sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime());
    
    // Limit to reasonable number for performance
    const maxResults = 150;
    if (availableCruises.length > maxResults) {
      console.log(`[Scheduling] Limiting results to ${maxResults} cruises (was ${availableCruises.length})`);
      availableCruises = availableCruises.slice(0, maxResults);
    }
    
    console.log('[Scheduling] Final available cruises:', availableCruises.length, 'out of', allCruises.length);
    if (availableCruises.length > 0) {
      console.log('[Scheduling] Sample available cruise:', {
        ship: availableCruises[0].ship,
        departureDate: availableCruises[0].departureDate,
        nights: availableCruises[0].nights
      });
    }
    
    return availableCruises;
  }, [filteredCruises, bookedCruises, activeTab, filters.maxBudget, calculateEndDate]);
  
  // Get unique values for filters from all cruises
  const filterOptions = React.useMemo(() => {
    const ships = new Set<string>();
    const itineraries = new Set<string>();
    const ports = new Set<string>();
    const nights = new Set<number>();

    (Array.isArray(allCruises) ? allCruises : []).forEach((cruise: any) => {
      if (cruise.ship) ships.add(cruise.ship);
      if (cruise.itineraryName) itineraries.add(cruise.itineraryName);
      if (cruise.departurePort) ports.add(cruise.departurePort);
      if (Number.isFinite(cruise.nights)) nights.add(cruise.nights);
    });

    return {
      ships: Array.from(ships).sort(),
      itineraries: Array.from(itineraries).sort(),
      ports: Array.from(ports).sort(),
      nights: Array.from(nights).sort((a, b) => a - b),
    } as const;
  }, [allCruises]);
  
  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (filterDates.start || filterDates.end) count++;
    if (filterShips.length > 0) count++;
    if (filterItineraries.length > 0) count++;
    if (filterPorts.length > 0) count++;
    if (filterNights.length > 0) count++;
    return count;
  }, [filterDates, filterShips, filterItineraries, filterPorts, filterNights]);
  
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      console.log('[Scheduling] Refreshing cruise data from CruiseStore...');
      await Promise.all([
        bookedCruisesQuery.refetch(),
        cruisesQuery.refetch()
      ]);
      console.log('[Scheduling] Refresh complete. Cruises loaded:', storedCruises.length);
    } catch (error) {
      console.error('[Scheduling] Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [bookedCruisesQuery, cruisesQuery, storedCruises.length]);
  
  const isLoading = bookedCruisesQuery.isLoading || cruisesQuery.isLoading;
  const hasError = bookedCruisesQuery.isError || cruisesQuery.isError;
  
  React.useEffect(() => {
    if (hasError) {
      console.error('[Scheduling] Query errors:', {
        bookedCruises: bookedCruisesQuery.error,
        cruises: cruisesQuery.error
      });
      
      // Log more details about the errors
      if (bookedCruisesQuery.error) {
        console.error('[Scheduling] Booked cruises error details:', bookedCruisesQuery.error);
      }
      if (cruisesQuery.error) {
        console.error('[Scheduling] Cruises error details:', cruisesQuery.error);
      }
    }
  }, [hasError, bookedCruisesQuery.error, cruisesQuery.error]);
  
  // Get booked cruises for the booked tab (similar to booked screen logic)
  const bookedCruisesForTab = React.useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Use the same logic as the booked screen to get all relevant cruises
    let allRelevantCruises: any[] = [];
    
    // Always use static data for now to ensure we show all expected cruises
    allRelevantCruises = STATIC_BOOKED_CRUISES;
    
    // If we have local data, try to merge it with static data
    if (localData.cruises && localData.cruises.length > 0) {
      // Look for cruises in local data that might not be in static data
      const additionalCruises = localData.cruises.filter((cruise: any) => {
        const shipName = (cruise.ship || cruise['Ship Name'] || cruise.Ship || '').toLowerCase();
        
        // Skip Allure - user said it's not a real completed cruise
        if (shipName.includes('allure')) {
          return false;
        }
        
        // Check if this cruise is already in static data
        const existsInStatic = STATIC_BOOKED_CRUISES.some((staticCruise: any) => {
          const staticShip = (staticCruise.ship || '').toLowerCase();
          const staticDate = staticCruise.startDate || staticCruise.departureDate;
          const cruiseDate = cruise.startDate || cruise.departureDate || cruise['Sailing Date'];
          
          return staticShip === shipName && staticDate === cruiseDate;
        });
        
        if (existsInStatic) {
          return false; // Skip if already in static data
        }
        
        // Check if cruise has booking/receipt/statement data
        const hasReceiptData = cruise.receiptData || 
                              cruise.receipt || 
                              cruise.receipts ||
                              cruise.reservationNumber ||
                              cruise['Reservation #'] ||
                              cruise['Reservation'] ||
                              cruise['RESERVATION'] ||
                              cruise['Booking ID'] ||
                              cruise['BOOKING ID#'] ||
                              cruise.bookingId ||
                              cruise.bookingNumber ||
                              cruise.confirmationNumber ||
                              cruise.hasReceiptData;
        
        const hasStatementData = cruise.statementData || 
                                cruise.statement || 
                                cruise.statements ||
                                cruise.clubRoyaleEntertainmentCharges ||
                                cruise.onboardCharges ||
                                cruise.casinoCharges ||
                                cruise.totalCharges ||
                                cruise.hasStatementData;
        
        const isBooked = cruise.isBooked || 
                        cruise.status === 'booked' ||
                        cruise.bookingStatus === 'confirmed';
        
        return hasReceiptData || hasStatementData || isBooked;
      });
      
      if (additionalCruises.length > 0) {
        allRelevantCruises = [...allRelevantCruises, ...additionalCruises];
      }
    }
    
    // Sort by departure/start date
    const getStart = (c: any) => {
      return c['Sailing Date'] || 
             c['Start Date'] || 
             c.startDate || 
             c.departureDate || 
             c['Departure Date'] || 
             c.date ||
             c['SAILING DATE'] ||
             c['START DATE'];
    };

    return allRelevantCruises.slice().sort((a: any, b: any) => {
      const da = createDateFromString(getStart(a) || '2099-12-31').getTime();
      const db = createDateFromString(getStart(b) || '2099-12-31').getTime();
      return da - db;
    });
  }, [localData.cruises]);

  const [bookedFilter, setBookedFilter] = React.useState<'upcoming' | 'completed' | 'withData' | 'all'>('upcoming');

  const getStartDate = React.useCallback((c: any): Date => {
    const raw = c['Sailing Date'] || c['Start Date'] || c.startDate || c.departureDate || c['Departure Date'] || c.date;
    return createDateFromString(raw || '2099-12-31');
  }, []);

  const getEndDate = React.useCallback((c: any, start?: Date): Date => {
    const endRaw = c['End Date'] || c.endDate || c.returnDate || c['Return Date'];
    if (endRaw) return createDateFromString(String(endRaw));
    const s = start ?? getStartDate(c);
    const nights = c.nights || c['Nights'] || c.Nights || c['Length'] || 7;
    const e = new Date(s);
    e.setDate(e.getDate() + (Number.isFinite(nights) ? Number(nights) : 7));
    return e;
  }, [getStartDate]);

  const isCompleted = React.useCallback((c: any): boolean => {
    const status = (c.lifecycleStatus || c.status || '').toString().toLowerCase();
    return status === 'completed' || status === 'done';
  }, []);

  const hasData = React.useCallback((c: any): boolean => {
    return !!(c.receiptData || c.receipt || c.receipts || c.statementData || c.statement || c.statements || c.clubRoyaleEntertainmentCharges || c.onboardCharges || c.casinoCharges || c.totalCharges);
  }, []);

  const todayStart = React.useMemo(() => {
    const t = new Date();
    t.setHours(0,0,0,0);
    return t;
  }, []);

  const bookedCounts = React.useMemo(() => {
    const total = bookedCruisesForTab.length;
    let upcoming = 0; let completed = 0; let withData = 0;
    bookedCruisesForTab.forEach((c: any) => {
      if (isCompleted(c)) completed += 1;
      const s = getStartDate(c);
      if (s >= todayStart && !isCompleted(c)) upcoming += 1;
      if (hasData(c)) withData += 1;
    });
    return { total, upcoming, completed, withData } as const;
  }, [bookedCruisesForTab, getStartDate, hasData, isCompleted, todayStart]);

  const bookedCruisesFiltered = React.useMemo(() => {
    switch (bookedFilter) {
      case 'completed':
        return bookedCruisesForTab.filter(isCompleted);
      case 'withData':
        return bookedCruisesForTab.filter(hasData);
      case 'all':
        return bookedCruisesForTab;
      case 'upcoming':
      default:
        return bookedCruisesForTab.filter((c: any) => {
          const s = getStartDate(c);
          const isPast = s < todayStart;
          const isComplete = isCompleted(c);
          return !isPast && !isComplete;
        });
    }
  }, [bookedCruisesForTab, bookedFilter, getStartDate, todayStart, isCompleted, hasData]);
  
  // Filter modal handlers
  const openFilterModal = () => {
    setTempFilterDates(filterDates);
    setTempFilterShips([...filterShips]);
    setTempFilterItineraries([...filterItineraries]);
    setTempFilterPorts([...filterPorts]);
    setTempFilterNights([...filterNights]);
    setShowFilters(true);
  };
  
  const applyFilters = () => {
    setFilterDates(tempFilterDates);
    setFilterShips(tempFilterShips);
    setFilterItineraries(tempFilterItineraries);
    setFilterPorts(tempFilterPorts);
    setFilterNights(tempFilterNights);
    setShowFilters(false);
  };
  
  const clearFilters = () => {
    setTempFilterDates({});
    setTempFilterShips([]);
    setTempFilterItineraries([]);
    setTempFilterPorts([]);
    setTempFilterNights([]);
  };
  
  const toggleFilterItem = (array: any[], setArray: (arr: any[]) => void, item: any) => {
    if (array.includes(item)) {
      setArray(array.filter(i => i !== item));
    } else {
      setArray([...array, item]);
    }
  };
  
  // Smart Recommendations with prioritized rules
  const recommendations = React.useMemo(() => {
    console.log('[Scheduling] Computing smart recommendations from', availableCruises.length, 'available cruises');
    
    // Define newer ships (user preference)
    const newerShips = ['star', 'icon', 'harmony', 'wonder', 'quantum', 'ovation'];
    
    // Get completed cruise ships to avoid duplicates
    const completedShips = new Set(
      bookedCruises
        .filter((bc: any) => {
          const status = bc.lifecycleStatus || bc.status;
          return status === 'completed';
        })
        .map((bc: any) => (bc.ship || '').toLowerCase())
    );
    
    // Get completed itineraries to avoid similar ones
    const completedItineraries = new Set(
      bookedCruises
        .filter((bc: any) => {
          const status = bc.lifecycleStatus || bc.status;
          return status === 'completed';
        })
        .map((bc: any) => (bc.itineraryName || bc.itinerary || '').toLowerCase())
    );
    
    console.log('[Scheduling] Completed ships:', Array.from(completedShips));
    console.log('[Scheduling] Completed itineraries:', Array.from(completedItineraries));
    
    const prefs = {
      driving: (DEFAULT_USER_PREFERENCES.departurePortPreferences.drivingDistance || []).map((p: string) => p.toLowerCase()),
      flying: (DEFAULT_USER_PREFERENCES.departurePortPreferences.acceptableFlying || []).map((p: string) => p.toLowerCase()),
      airfareEstimates: DEFAULT_USER_PREFERENCES.departurePortPreferences.estimatedAirfare,
      nightsPref: DEFAULT_USER_PREFERENCES.cruiseLengthPreferences.preferred,
      nightsOk: DEFAULT_USER_PREFERENCES.cruiseLengthPreferences.acceptable,
      cabinPref: DEFAULT_USER_PREFERENCES.cabinPreferences.preferred,
    };

    const scoreCruise = (c: any): { score: number; breakdown: any } => {
      let score = 0;
      const breakdown: any = {};
      
      // RULE 1: Must be available (already filtered by availableCruises)
      breakdown.available = true;
      
      // RULE 2: Longer voyages are better (highest priority)
      const nights = typeof c.nights === 'number' ? c.nights : 7;
      if (nights >= 14) {
        score += 100;
        breakdown.lengthBonus = 100;
      } else if (nights >= 10) {
        score += 70;
        breakdown.lengthBonus = 70;
      } else if (nights >= 7) {
        score += 40;
        breakdown.lengthBonus = 40;
      } else {
        score += 20;
        breakdown.lengthBonus = 20;
      }
      
      // RULE 3: Newer ships are better
      const shipName = (c.ship || '').toLowerCase();
      const isNewerShip = newerShips.some(ns => shipName.includes(ns));
      if (isNewerShip) {
        score += 80;
        breakdown.newerShip = 80;
      } else {
        breakdown.newerShip = 0;
      }
      
      // RULE 4: Proximity to Phoenix (cruise cost with airfare)
      const dep = (c.departurePort || '').toLowerCase();
      let airfareCost = 0;
      let proximityScore = 0;
      
      if (prefs.driving.some((p) => dep.includes(p))) {
        // Driving distance - best option
        proximityScore = 60;
        airfareCost = 0;
        breakdown.proximity = 'driving';
      } else if (prefs.flying.some((p) => dep.includes(p))) {
        // Acceptable flying distance
        proximityScore = 30;
        // Estimate airfare cost
        const portKey = Object.keys(prefs.airfareEstimates).find(key => dep.includes(key.toLowerCase()));
        airfareCost = portKey ? prefs.airfareEstimates[portKey] : 400;
        breakdown.proximity = 'flying';
        breakdown.estimatedAirfare = airfareCost;
      } else {
        // Far away (e.g., Europe) - penalize heavily
        proximityScore = 0;
        airfareCost = 800; // High estimate for Europe/far destinations
        breakdown.proximity = 'far';
        breakdown.estimatedAirfare = airfareCost;
      }
      score += proximityScore;
      breakdown.proximityScore = proximityScore;
      
      // Factor in total cost (cruise + airfare)
      const cruisePrice = c.paidFare ?? c.actualFare ?? c.currentMarketPrice ?? 1000;
      const totalCost = cruisePrice + airfareCost;
      breakdown.cruisePrice = cruisePrice;
      breakdown.totalCost = totalCost;
      
      // Lower total cost is better (but not as important as length/ship/proximity)
      if (totalCost < 1500) {
        score += 20;
        breakdown.costBonus = 20;
      } else if (totalCost < 2500) {
        score += 10;
        breakdown.costBonus = 10;
      } else {
        breakdown.costBonus = 0;
      }
      
      // RULE 5: Avoid similar cruises to ones already done
      const itineraryName = (c.itineraryName || '').toLowerCase();
      const hasCompletedSimilarShip = completedShips.has(shipName);
      const hasCompletedSimilarItinerary = Array.from(completedItineraries).some(
        (ci: any) => itineraryName.includes(ci) || ci.includes(itineraryName)
      );
      
      if (hasCompletedSimilarShip) {
        score -= 30;
        breakdown.similarShipPenalty = -30;
      }
      
      if (hasCompletedSimilarItinerary) {
        score -= 20;
        breakdown.similarItineraryPenalty = -20;
      }
      
      // BONUS: Cabin preference (minor factor)
      const cabin = (c.cabinType || '').toString();
      if (cabin) {
        const idx = prefs.cabinPref.indexOf(cabin as any);
        if (idx >= 0) {
          const cabinBonus = Math.max(0, 15 - idx * 3);
          score += cabinBonus;
          breakdown.cabinBonus = cabinBonus;
        }
      }
      
      // BONUS: Has casino offer
      const hasOffer = !!(c.offerCode || c.offerName || c.casinoOfferType);
      if (hasOffer) {
        score += 15;
        breakdown.offerBonus = 15;
      }
      
      breakdown.totalScore = score;
      return { score, breakdown };
    };

    const scored = availableCruises
      .map((c) => {
        const result = scoreCruise(c);
        return { cruise: c, score: result.score, breakdown: result.breakdown };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Get top 10 recommendations

    console.log('[Scheduling] Top 10 recommendations with scores:');
    scored.forEach((s, idx) => {
      console.log(`  ${idx + 1}. ${s.cruise.ship} - ${s.cruise.itineraryName}`);
      console.log(`     Score: ${s.score}`, s.breakdown);
    });
    
    return scored.map(s => ({ ...s.cruise, _recommendationScore: s.score, _scoreBreakdown: s.breakdown }));
  }, [availableCruises, bookedCruises, localData.offers]);
  
  const displayedCruises = activeTab === 'all' ? filteredCruises : activeTab === 'available' ? availableCruises : activeTab === 'picked4u' ? recommendations : bookedCruisesFiltered;
  const displayedCruisesLimited = React.useMemo(() => {
    const cap = activeTab === 'available' ? 150 : 50;
    if (!Array.isArray(displayedCruises)) return [] as any[];
    if (activeTab === 'booked') {
      return displayedCruises.slice(0, cap);
    }
    return displayedCruises.slice(0, cap);
  }, [displayedCruises, activeTab]);

  React.useEffect(() => {
    if (activeTab === 'available' && availableCruises.length === 0 && filteredCruises.length > 0) {
      setActiveTab('all');
    }
  }, [activeTab, availableCruises.length, filteredCruises.length]);
  const currentUserPoints = (userProfileQuery.data as any)?.points || userPoints || 12149;
  const nextTierPoints = 25000;

  return (
    <View style={styles.container}>
      <View style={{ height: insets.top, backgroundColor: '#FFFFFF' }} testID="safe-top-spacer" />
      <HeroHeaderCompact totalCruises={Array.isArray(allCruises) ? allCruises.length : 0} />
      {/* Removed Club Royale Header - now using compact hero */}
      
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ScrollView 
        testID="scheduling-scroll"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) }}
        {...(Platform.OS === 'web' ? {} : { refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#6C5CE7']}
            tintColor="#6C5CE7"
          />
        ) })}
      >
        {/* Smart Recommendations - only show for picked4u tab */}
        {activeTab === 'picked4u' && recommendations.length > 0 && (
          <View style={styles.recommendations}>
            <View style={styles.recommendationsHeader}>
              <Text style={styles.recommendationsTitle}>🎯 Smart Recommendations</Text>
              <Text style={styles.recommendationsSubtitle}>Based on your preferences: longer voyages, newer ships, proximity to Phoenix</Text>
            </View>
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.recommendationsScrollVertical}
            >
              {recommendations.map((cruise) => {
                const cruiseId = String(cruise.id || `booked-${(cruise as any).ship?.replace(/\s+/g, '-').toLowerCase()}-${(cruise as any).departureDate || (cruise as any).startDate || 'unknown'}`);
                return (
                  <CruiseCard
                    key={cruiseId}
                    cruise={cruise}
                    onPress={() => {
                      const departureDate = (cruise as any).departureDate || (cruise as any).startDate || (cruise as any)['Sailing Date'] || (cruise as any)['Start Date'];
                      const completeCruiseData = {
                        ...cruise,
                        id: cruiseId,
                        ship: (cruise as any).ship || (cruise as any)['Ship Name'] || (cruise as any).Ship || 'Unknown Ship',
                        departureDate: departureDate,
                        returnDate: (cruise as any).returnDate || (cruise as any).endDate || (cruise as any)['End Date'],
                        nights: (cruise as any).nights || (cruise as any)['Nights'] || (cruise as any).Nights || 7,
                        itineraryName: (cruise as any).itineraryName || (cruise as any)['Itinerary'] || (cruise as any).Itinerary || 'Unknown Itinerary',
                        departurePort: (cruise as any).departurePort || (cruise as any)['Departure Port'] || 'Unknown Port',
                      };
                      const queryParams = new URLSearchParams({
                        bookedData: JSON.stringify(completeCruiseData)
                      }).toString();
                      const destId = (cruise as any).id ? String((cruise as any).id) : cruiseId;
                      router.push(`/cruise/${encodeURIComponent(destId)}?${queryParams}`);
                    }}
                    recommended
                  />
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Cruises Section Header */}
        <View style={styles.cruisesHeader}>
          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'available' && styles.tabActive]}
              onPress={() => setActiveTab('available')}
              accessibilityRole="button"
              accessibilityLabel="Show available cruises"
              testID="toggle-available"
            >
              <Text style={[styles.tabText, activeTab === 'available' && styles.tabTextActive]}>
                Available
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'all' && styles.tabActive]}
              onPress={() => setActiveTab('all')}
              accessibilityRole="button"
              accessibilityLabel="Show all cruises"
              testID="toggle-all"
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'booked' && styles.tabActive]}
              onPress={() => setActiveTab('booked')}
              accessibilityRole="button"
              accessibilityLabel="Show booked cruises"
              testID="toggle-booked"
            >
              <Text style={[styles.tabText, activeTab === 'booked' && styles.tabTextActive]}>
                Booked
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'picked4u' && styles.tabActive]}
              onPress={() => setActiveTab('picked4u')}
              accessibilityRole="button"
              accessibilityLabel="Show smart recommendations"
              testID="toggle-picked4u"
            >
              <Text style={[styles.tabText, activeTab === 'picked4u' && styles.tabTextActive]}>
                For You
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'booked' && (
            <View style={styles.bookedControls}>
              <View style={styles.bookedFiltersRow}>
                {(['upcoming','completed','withData','all'] as const).map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.bookedFilterChip, bookedFilter === key && styles.bookedFilterChipActive]}
                    onPress={() => setBookedFilter(key)}
                    testID={`booked-filter-${key}`}
                  >
                    <Text style={[styles.bookedFilterText, bookedFilter === key && styles.bookedFilterTextActive]}>
                      {key === 'upcoming' ? `Upcoming (${bookedCounts.upcoming})` : key === 'completed' ? `Completed (${bookedCounts.completed})` : key === 'withData' ? `With Data (${bookedCounts.withData})` : `All (${bookedCounts.total})`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.bookedTotalsRow}>
                <View style={styles.statCard}><Text style={styles.statNumber}>{bookedCounts.upcoming}</Text><Text style={styles.statLabel}>UPCOMING</Text></View>
                <View style={styles.statCard}><Text style={styles.statNumber}>{bookedCounts.completed}</Text><Text style={styles.statLabel}>COMPLETED</Text></View>
                <View style={styles.statCard}><Text style={styles.statNumber}>{bookedCounts.withData}</Text><Text style={styles.statLabel}>WITH DATA</Text></View>
                <View style={styles.statCard}><Text style={styles.statNumber}>{bookedCounts.total}</Text><Text style={styles.statLabel}>BOOKED</Text></View>
              </View>
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={openFilterModal}
              accessibilityRole="button"
              accessibilityLabel="Open filters"
              testID="open-filters"
            >
              <View style={styles.actionIconContainer}>
                <Filter size={18} color="#003B6F" />
                {activeFiltersCount > 0 && (
                  <View style={styles.actionBadge}>
                    <Text style={styles.actionBadgeText}>{activeFiltersCount}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.actionButtonText}>Filter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setFilterDates({});
                setFilterShips([]);
                setFilterItineraries([]);
                setFilterPorts([]);
                setFilterNights([]);
                setSearchQuery('');
              }}
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
              testID="clear-filters-button"
            >
              <View style={styles.actionIconContainer}>
                <X size={18} color="#003B6F" />
              </View>
              <Text style={styles.actionButtonText}>Clear Filters</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setShowAddPoints(true)}
              accessibilityRole="button"
              accessibilityLabel="Add points"
            >
              <View style={styles.actionIconContainer}>
                <Plus size={18} color="#003B6F" />
              </View>
              <Text style={styles.actionButtonText}>CR Points</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/alerts')}
              accessibilityRole="button"
              accessibilityLabel="View alerts"
            >
              <View style={styles.actionIconContainer}>
                <Bell size={18} color="#003B6F" />
                <View style={styles.actionBadge}>
                  <Text style={styles.actionBadgeText}>3</Text>
                </View>
              </View>
              <Text style={styles.actionButtonText}>Alerts</Text>
            </TouchableOpacity>
          </View>
          
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Search size={18} color="#6B7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by ship, itinerary, departure port, date, or nights"
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={18} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Mini Stats */}
          <View style={styles.miniStats}>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatNumber}>{displayedCruises.length}</Text>
              <Text style={styles.miniStatLabel}>showing</Text>
            </View>
            <Text style={styles.miniStatDivider}>•</Text>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatNumber}>{allCruises.length}</Text>
              <Text style={styles.miniStatLabel}>total</Text>
            </View>
            <Text style={styles.miniStatDivider}>•</Text>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatNumber}>{bookedCruises.length}</Text>
              <Text style={styles.miniStatLabel}>booked</Text>
            </View>
          </View>
        </View>
        
        {/* Cruise List */}
        <View style={styles.cruiseList}>
          {isLoading ? (
            <View style={styles.loadingContainer} testID="loading-state">
              <ActivityIndicator size="large" color="#6C5CE7" />
              <Text style={styles.loadingText}>Loading cruises...</Text>
            </View>
          ) : displayedCruises.length === 0 ? (
            <View style={styles.emptyState} testID="empty-state">
              <Ship size={48} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No Cruises Found</Text>
              <Text style={styles.emptyText}>
                {allCruises.length === 0 
                  ? 'No cruise data found. Import your cruise data to see available scheduling options.'
                  : searchQuery || activeFiltersCount > 0
                    ? 'No cruises match your search criteria. Try adjusting your filters.'
                    : activeTab === 'all'
                      ? 'No cruises available.'
                      : activeTab === 'booked'
                        ? 'No booked cruises found.'
                        : `No cruises available in the next 180 days that fit your schedule. You have ${bookedCruises.length} booked cruises that may be creating conflicts.`}
              </Text>
              {allCruises.length === 0 && (
                <TouchableOpacity
                  style={styles.syncButton}
                  onPress={() => router.push('/import')}
                  testID="cta-import"
                >
                  <Ship size={16} color="#FFFFFF" />
                  <Text style={styles.syncButtonText}>Import Cruise Data</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            displayedCruisesLimited.map((cruise) => {
              const cruiseId = String(cruise.id || `booked-${(cruise as any).ship?.replace(/\s+/g, '-').toLowerCase()}-${(cruise as any).departureDate || (cruise as any).startDate || 'unknown'}`);
              return (
                <CruiseCard
                  key={cruiseId}
                  cruise={cruise}
                  onPress={() => {
                    const departureDate = (cruise as any).departureDate || (cruise as any).startDate || (cruise as any)['Sailing Date'] || (cruise as any)['Start Date'];
                    const completeCruiseData = {
                      ...cruise,
                      id: cruiseId,
                      ship: (cruise as any).ship || (cruise as any)['Ship Name'] || (cruise as any).Ship || 'Unknown Ship',
                      departureDate: departureDate,
                      returnDate: (cruise as any).returnDate || (cruise as any).endDate || (cruise as any)['End Date'],
                      nights: (cruise as any).nights || (cruise as any)['Nights'] || (cruise as any).Nights || 7,
                      itineraryName: (cruise as any).itineraryName || (cruise as any)['Itinerary'] || (cruise as any).Itinerary || 'Unknown Itinerary',
                      departurePort: (cruise as any).departurePort || (cruise as any)['Departure Port'] || 'Unknown Port',
                    };
                    const queryParams = new URLSearchParams({
                      bookedData: JSON.stringify(completeCruiseData)
                    }).toString();
                    const destId = (cruise as any).id ? String((cruise as any).id) : cruiseId;
                    router.push(`/cruise/${encodeURIComponent(destId)}?${queryParams}`);
                  }}
                />
              );
            })
          )}
        </View>
      </ScrollView>
      </SafeAreaView>
      
      {/* User Switcher Modal */}
      <Modal
        visible={showUserSwitcher}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUserSwitcher(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Switch User</Text>
            <ScrollView style={{ maxHeight: 240 }}>
              {Array.isArray(users) && users.map((u: any) => (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.syncButton, { backgroundColor: (currentUser?.id === u.id) ? '#10B981' : '#6C5CE7', marginTop: 8 }]}
                  onPress={async () => {
                    try {
                      await switchUser(u.id);
                      setShowUserSwitcher(false);
                      await onRefresh();
                    } catch (e) {
                      console.error('[Scheduling] switchUser failed', e);
                    }
                  }}
                  testID={`switch-${u.id}`}
                >
                  <Text style={styles.syncButtonText}>{u.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonConfirm, { marginTop: 12 }]}
              onPress={async () => {
                try {
                  const created = await addUser({ name: `Guest ${Date.now().toString().slice(-4)}` });
                  await switchUser(created.id);
                  setShowUserSwitcher(false);
                  await onRefresh();
                } catch (e) {
                  console.error('[Scheduling] addUser failed', e);
                }
              }}
              testID="add-user"
            >
              <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>Add New User</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Points Modal */}
      <Modal
        visible={showAddPoints}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddPoints(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAddPoints(false)}
        >
          <TouchableOpacity 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Points</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter points to add"
                placeholderTextColor="#9CA3AF"
                value={pointsInput}
                onChangeText={setPointsInput}
                keyboardType="numeric"
                autoFocus
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setPointsInput('');
                    setShowAddPoints(false);
                  }}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={handleAddPoints}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      
      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.filterModalContainer}>
          <View style={styles.filterModalContent}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <X size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.filterModalBody}>
              {/* Date Range */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Date Range</Text>
                <View style={styles.dateInputRow}>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="Start Date (YYYY-MM-DD)"
                    placeholderTextColor="#9CA3AF"
                    value={tempFilterDates.start || ''}
                    onChangeText={(text) => setTempFilterDates({...tempFilterDates, start: text})}
                  />
                  <Text style={styles.dateInputSeparator}>to</Text>
                  <TextInput
                    style={styles.dateInput}
                    placeholder="End Date (YYYY-MM-DD)"
                    placeholderTextColor="#9CA3AF"
                    value={tempFilterDates.end || ''}
                    onChangeText={(text) => setTempFilterDates({...tempFilterDates, end: text})}
                  />
                </View>
              </View>
              
              {/* Ships */}
              {filterOptions.ships.length > 0 && (
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Ships</Text>
                  <View style={styles.filterChips}>
                    {filterOptions.ships.map(ship => (
                      <TouchableOpacity
                        key={ship}
                        style={[
                          styles.filterChip,
                          tempFilterShips.includes(ship) && styles.filterChipActive
                        ]}
                        onPress={() => toggleFilterItem(tempFilterShips, setTempFilterShips, ship)}
                      >
                        <Text style={[
                          styles.filterChipText,
                          tempFilterShips.includes(ship) && styles.filterChipTextActive
                        ]}>
                          {ship}
                        </Text>
                        {tempFilterShips.includes(ship) && (
                          <Check size={14} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              
              {/* Nights */}
              {filterOptions.nights.length > 0 && (
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Nights</Text>
                  <View style={styles.filterChips}>
                    {filterOptions.nights.map(night => (
                      <TouchableOpacity
                        key={night}
                        style={[
                          styles.filterChip,
                          tempFilterNights.includes(night) && styles.filterChipActive
                        ]}
                        onPress={() => toggleFilterItem(tempFilterNights, setTempFilterNights, night)}
                      >
                        <Text style={[
                          styles.filterChipText,
                          tempFilterNights.includes(night) && styles.filterChipTextActive
                        ]}>
                          {night}N
                        </Text>
                        {tempFilterNights.includes(night) && (
                          <Check size={14} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              
              {/* Ports */}
              {filterOptions.ports.length > 0 && (
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Ports</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.filterChipsHorizontal}>
                      {filterOptions.ports.map(port => (
                        <TouchableOpacity
                          key={port}
                          style={[
                            styles.filterChip,
                            tempFilterPorts.includes(port) && styles.filterChipActive
                          ]}
                          onPress={() => toggleFilterItem(tempFilterPorts, setTempFilterPorts, port)}
                        >
                          <Text style={[
                            styles.filterChipText,
                            tempFilterPorts.includes(port) && styles.filterChipTextActive
                          ]}>
                            {port}
                          </Text>
                          {tempFilterPorts.includes(port) && (
                            <Check size={14} color="#FFFFFF" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
              
              {/* Cabin Types */}

            </ScrollView>
            
            <View style={styles.filterModalFooter}>
              <TouchableOpacity
                style={styles.filterClearButton}
                onPress={clearFilters}
              >
                <Text style={styles.filterClearText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyButton}
                onPress={applyFilters}
                testID="apply-filters"
              >
                <Text style={styles.filterApplyText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  clubRoyaleHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
  },
  clubRoyaleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  clubRoyaleTitle: {
    flex: 1,
  },
  clubRoyaleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4338CA',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  pointsBar: {
    backgroundColor: '#7C3AED',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 12,
  },
  pointsInfo: {
    alignItems: 'center',
  },
  levelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  pointsText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  cruisesHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  cruisesTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recommendations: {
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  recommendationsHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  recommendationsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  recommendationsSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  recommendationsScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  recommendationsScrollVertical: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  recommendationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 12,
  },
  rankBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  rankText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  recommendationImage: {
    height: 100,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recommendationImageText: {
    fontSize: 48,
  },
  recommendationContent: {
    padding: 12,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  recommendationShip: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  recommendationOfferBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recommendationOfferText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  recommendationItinerary: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 8,
    lineHeight: 18,
  },
  recommendationDetails: {
    gap: 4,
    marginBottom: 12,
  },
  recommendationDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recommendationDetailText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  scoreBreakdown: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scoreTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6C5CE7',
    marginBottom: 6,
  },
  scoreDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  scoreTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  scoreTagText: {
    fontSize: 10,
    color: '#4338CA',
    fontWeight: '600',
  },
  airfareEstimate: {
    fontSize: 10,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 4,
  },
  cruisesTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
    flex: 1,
    marginRight: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  toggleTextActive: {
    color: '#111827',
    fontWeight: '600',
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#6C5CE7',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  statsRow: {
    marginBottom: 12,
  },
  statsText: {
    fontSize: 14,
    color: '#6B7280',
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
  cruiseList: {
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 48,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cruiseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  bookingNumber: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
    marginTop: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  dateText: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },
  nightsText: {
    fontSize: 12,
    color: '#6B7280',
  },
  portRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  portText: {
    fontSize: 13,
    color: '#374151',
  },
  itineraryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  routeDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 12,
  },
  guestsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  guestsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  guestsText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '500',
  },
  statusText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  pricingSection: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  pricingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  pricingRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  pricingColumn: {
    flex: 1,
  },
  pricingLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  pricingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  savingsText: {
    color: '#22C55E',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonConfirm: {
    backgroundColor: '#6C5CE7',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalButtonTextConfirm: {
    color: '#FFFFFF',
  },
  filterModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  filterModalBody: {
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChipsHorizontal: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  filterChipText: {
    fontSize: 14,
    color: '#374151',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  dateInputSeparator: {
    fontSize: 14,
    color: '#6B7280',
  },
  filterInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  filterModalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  filterClearButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  filterClearText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterApplyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
  },
  filterApplyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#003B6F',
    fontWeight: '700',
  },
  bookedControls: {
    marginTop: 8,
    marginBottom: 12,
    gap: 8,
  },
  bookedFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bookedFilterChip: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bookedFilterChipActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  bookedFilterText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  bookedFilterTextActive: {
    color: '#FFFFFF',
  },
  bookedTotalsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
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
  actionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  actionBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
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
});