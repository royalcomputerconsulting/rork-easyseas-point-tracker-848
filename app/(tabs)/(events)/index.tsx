import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  FlatList,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, ChevronLeft, ChevronRight, MapPin, Clock, AlertTriangle, Plus, Filter } from "lucide-react-native";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { HeroHeaderCompact } from "@/components/HeroHeaderCompact";

type ViewMode = "week" | "month" | "90days";

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showEvents, setShowEvents] = useState<boolean>(false);

  // Fetch events - use calendar.events procedure
  const eventsQuery = trpc.calendar.events.useQuery({}, {
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 1000 * 60 * 5,
    refetchInterval: false,
  });
  
  // New: Sync from DATA folder mutation
  const syncFromDataMutation = trpc.calendar.syncFromDataFolder.useMutation({
    onSuccess: async (data: any) => {
      console.log("[Events] Sync from DATA folder successful:", data);
      await new Promise((r) => setTimeout(r, 500));
      const refetchResult = await eventsQuery.refetch();
      if (refetchResult.data && refetchResult.data.length > 0) setEvents(refetchResult.data);
      await debugQuery.refetch();
      Alert.alert(
        "Synced",
        `TripIt: ${data.importedTripIt} | Personal: ${data.importedManual}\nTotal: ${data.totalInStore}`
      );
    },
    onError: (error: any) => {
      console.error("[Events] Sync from DATA folder error:", error);
      Alert.alert("Error", "Failed to sync from DATA folder");
    },
  });

  // Debug query to check backend state
  const debugQuery = trpc.calendar.debugStore.useQuery(undefined, {
    refetchOnWindowFocus: false,
    enabled: false, // Disable auto-fetch to prevent startup issues
    staleTime: 1000 * 60 * 5,
    refetchInterval: false, // Disable auto-polling to prevent loops
  });
  
  // Add sample events mutation for testing
  const addSampleEventsMutation = trpc.calendar.addSampleEvents.useMutation({
    onSuccess: async (data: any) => {
      console.log("[Events] Sample events added:", data);
      const refetchResult = await eventsQuery.refetch();
      if (refetchResult.data && refetchResult.data.length > 0) {
        setEvents(refetchResult.data);
      }
      await debugQuery.refetch();
      Alert.alert("Success", `Added ${data.eventsAdded} sample events`);
    },
    onError: (error: any) => {
      console.error("[Events] Failed to add sample events:", error);
      Alert.alert("Error", "Failed to add sample events");
    },
  });

  // Store events in state to prevent them from disappearing
  const [events, setEvents] = useState<any[]>([]);
  
  // Update events when query data changes
  useEffect(() => {
    if (eventsQuery.data && Array.isArray(eventsQuery.data) && eventsQuery.data.length > 0) {
      console.log('[Events] Updating events from query, count:', eventsQuery.data.length);
      setEvents(eventsQuery.data);
    } else if (eventsQuery.data && Array.isArray(eventsQuery.data)) {
      console.log('[Events] Query returned empty array');
    }
  }, [eventsQuery.data]);

  const handleSync = useCallback(async () => {
    console.log("[Events] Sync from DATA folder starting...");
    setSyncing(true);
    try {
      const res = await syncFromDataMutation.mutateAsync();
      console.log("[Events] Sync result:", res);
    } catch (e) {
      console.error("[Events] Sync error:", e);
    } finally {
      setSyncing(false);
    }
  }, [syncFromDataMutation]);

  const onRefresh = async () => {
    console.log('[Events] Manual refresh started');
    setRefreshing(true);
    try {
      const result = await eventsQuery.refetch();
      console.log('[Events] Refresh complete, events:', result.data?.length);
      if (result.data && result.data.length > 0) {
        setEvents(result.data);
      }
    } catch (error) {
      console.error('[Events] Refresh error:', error);
    }
    setRefreshing(false);
  };

  // Get date range based on view mode
  const getDateRange = () => {
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);

    switch (viewMode) {
      case "week":
        start.setDate(start.getDate() - start.getDay());
        end.setDate(start.getDate() + 6);
        break;
      case "month":
        start.setDate(1);
        end.setMonth(end.getMonth() + 1, 0);
        break;
      case "90days":
        // Start on the beginning of week for consistency
        start.setDate(start.getDate() - start.getDay());
        end.setDate(start.getDate() + 90);
        break;
    }

    return { start, end };
  };

  // Filter events for current view
  const filteredEvents = useMemo(() => {
    console.log('[Events] Filtering events - source array length:', events.length);
    if (!events || events.length === 0) return [];
    const { start, end } = getDateRange();
    
    // For month view, we need to include events from previous/next months that appear in the grid
    // Extend the range to cover the full calendar grid (up to 6 weeks)
    const extendedStart = new Date(start);
    const extendedEnd = new Date(end);
    
    if (viewMode === 'month') {
      // Go back to the start of the week containing the first day of the month
      extendedStart.setDate(extendedStart.getDate() - extendedStart.getDay());
      // Go forward to the end of the week containing the last day of the month
      const daysToAdd = 6 - extendedEnd.getDay();
      extendedEnd.setDate(extendedEnd.getDate() + daysToAdd);
    }
    
    console.log('[Events] Date range:', {
      original: { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] },
      extended: { start: extendedStart.toISOString().split('T')[0], end: extendedEnd.toISOString().split('T')[0] }
    });
    
    const filtered = events
      .filter((event: any) => {
        const eventStart = new Date(event.startDate);
        const eventEnd = new Date(event.endDate);
        // Use extended range for month view to include all visible days
        const rangeStart = viewMode === 'month' ? extendedStart : start;
        const rangeEnd = viewMode === 'month' ? extendedEnd : end;
        return eventEnd >= rangeStart && eventStart <= rangeEnd;
      })
      .sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    console.log('[Events] Filtered events for view:', filtered.length, 'of', events.length, 'total');
    return filtered;
  }, [events, selectedDate, viewMode]);

  // Group events by source
  const eventsBySource = useMemo(() => {
    console.log('[Events] Computing events by source - total events:', events.length);
    
    const counts: Record<string, number> = { tripit: 0, manual: 0, booked: 0 };
    
    if (!events || events.length === 0) {
      console.log('[Events] No events for source grouping');
      return counts;
    }
    
    events.forEach((event: any) => {
      if (event.source in counts) {
        counts[event.source]++;
      } else {
        counts[event.source] = 1;
      }
    });
    
    console.log('[Events] Events by source counts:', counts);
    return counts;
  }, [events]);

  // Navigate month
  const navigateMonth = (direction: number) => {
    const newDate = new Date(selectedDate);
    if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setSelectedDate(newDate);
  };

  // Render calendar grid with enhanced day cells
  const renderCalendarGrid = () => {
    const { start, end } = getDateRange();
    const days: React.ReactNode[] = [];
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const dayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    days.push(
      <View key="headers" style={styles.weekRow}>
        {dayHeaders.map((day) => (
          <View key={day} style={styles.dayHeader}>
            <Text style={styles.dayHeaderText}>{day}</Text>
          </View>
        ))}
      </View>
    );

    const current = new Date(start);
    const weeks: React.ReactNode[][] = [];
    let currentWeek: React.ReactNode[] = [];

    // Helper to push a day cell for any view
    const pushDay = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayEvents = filteredEvents.filter(
        (e: any) => e.startDate <= dateStr && e.endDate >= dateStr
      );
      const hasEvents = dayEvents.length > 0;
      const hasTripIt = dayEvents.some((e: any) => e.source === "tripit");
      const hasManual = dayEvents.some((e: any) => e.source === "manual");
      const hasBooked = dayEvents.some((e: any) => e.source === "booked");
      const isToday = dateStr === todayStr;
      const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
      
      let bgStyle = styles.dayCellFree;
      if (hasEvents) {
        if (hasBooked) bgStyle = styles.dayCellBooked;
        else if (hasTripIt) bgStyle = styles.dayCellTripIt;
        else if (hasManual) bgStyle = styles.dayCellManual;
        else bgStyle = styles.dayCellWithEvents;
      }
      
      if (isToday) bgStyle = styles.dayCellToday;
      if (!isCurrentMonth && viewMode === 'month') bgStyle = styles.dayCellOtherMonth;

      // Get event types for mini indicators
      const eventTypes = {
        tripit: dayEvents.filter(e => e.source === 'tripit').length,
        manual: dayEvents.filter(e => e.source === 'manual').length,
        booked: dayEvents.filter(e => e.source === 'booked').length
      };

      currentWeek.push(
        <TouchableOpacity
          key={dateStr}
          style={[styles.dayCell, bgStyle, viewMode !== 'month' && styles.dayCellCompact, isToday && styles.dayCellTodayBorder]}
          onPress={() => {
            const localDateStr = dateStr;
            console.log('[Events] Navigating to date:', localDateStr, 'from date object:', date);
            router.push(`/day-agenda/${localDateStr}`);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Open agenda for ${dateStr}${hasEvents ? ', ' + dayEvents.length + ' events' : ''}${isToday ? ', today' : ''}`}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          testID={`calendar-day-${dateStr}`}
        >
          <Text style={[
            styles.dayNumber, 
            hasEvents && styles.dayNumberWithEvents, 
            viewMode !== 'month' && styles.dayNumberCompact,
            isToday && styles.dayNumberToday,
            !isCurrentMonth && viewMode === 'month' && styles.dayNumberOtherMonth
          ]}>
            {date.getDate()}
          </Text>
          
          {/* Event indicators */}
          {hasEvents && viewMode === 'month' && (
            <View style={styles.eventIndicatorsContainer}>
              {eventTypes.booked > 0 && (
                <View style={[styles.eventDot, styles.eventDotBooked]} />
              )}
              {eventTypes.tripit > 0 && (
                <View style={[styles.eventDot, styles.eventDotTripIt]} />
              )}
              {eventTypes.manual > 0 && (
                <View style={[styles.eventDot, styles.eventDotManual]} />
              )}
            </View>
          )}
          
          {/* Event count for compact views */}
          {hasEvents && viewMode !== 'month' && (
            <View style={[styles.eventIndicator, styles.eventIndicatorCompact]}>
              <Text style={[styles.eventCount, styles.eventCountCompact]}>{dayEvents.length}</Text>
            </View>
          )}
          
          {/* Today indicator */}
          {isToday && (
            <View style={styles.todayIndicator} />
          )}
        </TouchableOpacity>
      );
    };

    // Month view: pre-pad first week with empties and include previous month days
    if (viewMode === 'month') {
      const firstDay = start.getDay();
      const prevMonth = new Date(start);
      prevMonth.setDate(0); // Last day of previous month
      
      for (let i = firstDay - 1; i >= 0; i--) {
        const prevDate = new Date(prevMonth);
        prevDate.setDate(prevMonth.getDate() - i);
        pushDay(prevDate);
      }
    }

    while (current <= end) {
      pushDay(new Date(current));

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      current.setDate(current.getDate() + 1);
    }

    // Fill tail for month view with next month days
    if (currentWeek.length > 0 && viewMode === 'month') {
      const nextMonth = new Date(end);
      nextMonth.setDate(end.getDate() + 1);
      
      while (currentWeek.length < 7) {
        pushDay(new Date(nextMonth));
        nextMonth.setDate(nextMonth.getDate() + 1);
      }
      weeks.push(currentWeek);
    } else if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(<View key={`empty-end-${currentWeek.length}`} style={[styles.dayCell, styles.dayCellFree]} />);
      }
      weeks.push(currentWeek);
    }

    weeks.forEach((week, weekIndex) => {
      days.push(
        <View key={`week-${weekIndex}`} style={styles.weekRow}>
          {week}
        </View>
      );
    });

    return <View style={styles.calendarGrid}>{days}</View>;
  };

  // Render event item
  const renderEventItem = useCallback(({ item }: { item: any }) => {
    const startDate = new Date(item.startDate);
    const endDate = new Date(item.endDate);
    const isMultiDay = item.startDate !== item.endDate;

    return (
      <TouchableOpacity
        style={[
          styles.eventItem,
          item.source === "tripit" && styles.tripitEvent,
          item.source === "booked" && styles.bookedEvent,
          item.source === "manual" && styles.manualEvent,
        ]}
        onPress={() => {
          const localDateStr = item.startDate;
          console.log('[Events] Event navigation to date:', localDateStr, 'from:', item.startDate);
          router.push(`/day-agenda/${localDateStr}`);
        }}
        accessibilityRole="button"
        testID={`event-${item.id}`}
      >
        <View style={styles.eventHeader}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {item.summary}
          </Text>
          <View style={styles.eventBadge}>
            <Text style={styles.eventSource}>{item.source.toUpperCase()}</Text>
          </View>
        </View>
        
        <View style={styles.eventDetails}>
          <View style={styles.eventDetailRow}>
            <Clock size={14} color="#6B7280" />
            <Text style={styles.eventDate}>
              {startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {isMultiDay && ` - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            </Text>
          </View>
          {item.location ? (
            <View style={styles.eventDetailRow}>
              <MapPin size={14} color="#6B7280" />
              <Text style={styles.eventLocation} numberOfLines={1}>
                {item.location}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }, [router]);

  if (eventsQuery.isLoading && !events.length) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>
          {syncing ? "Syncing..." : "Loading events..."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={{ height: insets.top, backgroundColor: '#F9FAFB' }} testID="safe-top-spacer" />
      <HeroHeaderCompact totalCruises={filteredEvents.length} />
      {/* Compact Controls Top Row */}
      <View style={styles.viewModeContainer}>
        <TouchableOpacity
          style={[styles.miniButton, showEvents && styles.miniButtonActive]}
          onPress={() => setShowEvents((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={showEvents ? 'Hide events list' : 'Show events list'}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          testID="toggle-events"
        >
          <Text style={[styles.miniButtonText, showEvents && styles.miniButtonTextActive]}>Events</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.miniButton, viewMode === "week" && styles.miniButtonActive]}
          onPress={() => setViewMode("week")}
          accessibilityRole="button"
          accessibilityLabel="Switch to week view"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={[styles.miniButtonText, viewMode === "week" && styles.miniButtonTextActive]}>Week</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.miniButton, viewMode === "month" && styles.miniButtonActive]}
          onPress={() => setViewMode("month")}
          accessibilityRole="button"
          accessibilityLabel="Switch to month view"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={[styles.miniButtonText, viewMode === "month" && styles.miniButtonTextActive]}>Month</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.miniButton, viewMode === "90days" && styles.miniButtonActive]}
          onPress={() => setViewMode("90days")}
          accessibilityRole="button"
          accessibilityLabel="Switch to 90 days view"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={[styles.miniButtonText, viewMode === "90days" && styles.miniButtonTextActive]}>90 Days</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar Navigation */}
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.navButton} accessibilityLabel="Previous" accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ChevronLeft size={20} color="#6C5CE7" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <TouchableOpacity 
            onPress={() => setSelectedDate(new Date())}
            style={styles.monthTitleContainer}
            accessibilityLabel="Go to today"
            accessibilityRole="button"
          >
            <Text style={styles.monthTitle}>
              {viewMode === '90days'
                ? `${selectedDate.toLocaleDateString("en-US", { month: "short" })} + 90 Days`
                : selectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </Text>
            <Text style={styles.monthSubtitle}>
              {filteredEvents.length} events • Tap to go to today
            </Text>
          </TouchableOpacity>
          {filteredEvents.length > 0 && (() => {
            // compute overlaps
            const overlaps = new Set<string>();
            for (let i = 0; i < filteredEvents.length; i++) {
              const a: any = filteredEvents[i];
              for (let j = i + 1; j < filteredEvents.length; j++) {
                const b: any = filteredEvents[j];
                const aStart = new Date(a.startDate).getTime();
                const aEnd = new Date(a.endDate).getTime();
                const bStart = new Date(b.startDate).getTime();
                const bEnd = new Date(b.endDate).getTime();
                if (aStart <= bEnd && bStart <= aEnd) {
                  overlaps.add(a.id);
                  overlaps.add(b.id);
                }
              }
            }
            return overlaps.size > 0 ? (
              <View style={styles.overlapBadge} accessibilityLabel={`${overlaps.size} overlapping events`}>
                <AlertTriangle size={12} color="#FFFFFF" />
                <Text style={styles.overlapText}>{overlaps.size}</Text>
              </View>
            ) : null;
          })()}
        </View>
        
        <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.navButton} accessibilityLabel="Next" accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ChevronRight size={20} color="#6C5CE7" />
        </TouchableOpacity>
      </View>

      {/* Calendar Grid (All Views) */}
      <ScrollView style={styles.calendarContainer} contentContainerStyle={styles.calendarContent}>
        {renderCalendarGrid()}
      </ScrollView>

      {/* Legend and Quick Actions */}
      <View style={styles.legendContainer}>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.eventDotBooked]} />
            <Text style={styles.legendText}>Cruise ({eventsBySource.booked || 0})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.eventDotTripIt]} />
            <Text style={styles.legendText}>Travel ({eventsBySource.tripit || 0})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.eventDotManual]} />
            <Text style={styles.legendText}>Personal ({eventsBySource.manual || 0})</Text>
          </View>
        </View>
        
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => {
              const today = new Date();
              const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
              router.push(`/day-agenda/${todayStr}`);
            }}
            accessibilityLabel="View today's agenda"
            accessibilityRole="button"
          >
            <Calendar size={16} color="#6C5CE7" />
            <Text style={styles.quickActionText}>Today</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => router.push('/(tabs)/(scheduling)')}
            accessibilityLabel="Add new event"
            accessibilityRole="button"
          >
            <Plus size={16} color="#6C5CE7" />
            <Text style={styles.quickActionText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.syncContainer}>
        <TouchableOpacity
          style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
          onPress={handleSync}
          accessibilityLabel="Sync with Data Folder"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          testID="sync-data-folder"
          disabled={syncing}
        >
          <Calendar size={16} color="#FFFFFF" />
          <Text style={styles.syncButtonText}>Sync</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.syncButton, styles.syncButtonSecondary]}
          onPress={() => router.push('/process-data-folder')}
          accessibilityLabel="Process All Data Folders"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          testID="process-data-folders"
        >
          <Text style={styles.syncButtonTextSecondary}>Process All Data</Text>
        </TouchableOpacity>
      </View>

      {/* Scrollable clickable event list (Compact) */}
      {showEvents && (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item: any) => item.id}
          renderItem={renderEventItem}
          contentContainerStyle={styles.eventsList}
          style={styles.eventsListContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No events in view</Text>
              <Text style={styles.emptySubtext}>Tap Sync to load from DATA/calendar.ics and DATA/tripit.ics</Text>
            </View>
          }
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6B7280",
  },
  viewModeContainer: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    gap: 8,
  },
  miniButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  miniButtonActive: {
    backgroundColor: "#6C5CE7",
    borderColor: "#6C5CE7",
  },
  miniButtonText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#6B7280",
  },
  miniButtonTextActive: {
    color: "#FFFFFF",
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  monthTitleContainer: {
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  monthSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  navButton: {
    padding: 6,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#1F2937",
  },
  calendarContainer: {
    flexGrow: 1,
    backgroundColor: "#FFFFFF",
    marginBottom: 6,
  },
  calendarContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  calendarGrid: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  dayHeader: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
  },
  dayHeaderText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#6B7280",
    letterSpacing: 0.2,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    margin: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  dayCellCompact: {
    aspectRatio: 1,
    borderRadius: 4,
  },
  dayCellWithEvents: {
    backgroundColor: "#F3F4F6",
    borderColor: "#CBD5E1",
  },
  dayCellTripIt: {
    backgroundColor: "#DBEAFE",
    borderColor: "#93C5FD",
  },
  dayCellManual: {
    backgroundColor: "#EDE9FE",
    borderColor: "#C4B5FD",
  },
  dayCellBooked: {
    backgroundColor: "#D1FAE5",
    borderColor: "#86EFAC",
  },
  dayCellFree: {
    backgroundColor: "#FAFAFA",
  },
  dayCellToday: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FBBF24",
  },
  dayCellTodayBorder: {
    borderWidth: 2,
    borderColor: "#F59E0B",
  },
  dayCellOtherMonth: {
    backgroundColor: "#F8FAFC",
    opacity: 0.6,
  },
  dayNumber: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600" as const,
  },
  dayNumberCompact: {
    fontSize: 11,
  },
  dayNumberWithEvents: {
    fontWeight: "600" as const,
    color: "#1E40AF",
  },
  dayNumberToday: {
    fontWeight: "700" as const,
    color: "#D97706",
  },
  dayNumberOtherMonth: {
    color: "#9CA3AF",
  },
  eventIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "#3B82F6",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  eventIndicatorCompact: {
    borderRadius: 6,
    paddingHorizontal: 3,
    paddingVertical: 0,
    bottom: 1,
    right: 1,
  },
  eventCount: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "600" as const,
  },
  eventCountCompact: {
    fontSize: 9,
  },
  eventIndicatorsContainer: {
    position: "absolute",
    bottom: 3,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 3,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  eventDotBooked: {
    backgroundColor: "#10B981",
  },
  eventDotTripIt: {
    backgroundColor: "#3B82F6",
  },
  eventDotManual: {
    backgroundColor: "#8B5CF6",
  },
  todayIndicator: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F59E0B",
  },
  legendContainer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500" as const,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
  },
  quickActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 6,
  },
  quickActionText: {
    fontSize: 12,
    color: "#6C5CE7",
    fontWeight: "600" as const,
  },
  syncContainer: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
  },
  syncButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6C5CE7",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  syncButtonSecondary: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#6C5CE7",
  },
  syncButtonDisabled: {
    opacity: 0.5,
  },
  syncButtonText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#FFFFFF",
  },
  syncButtonTextSecondary: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#6C5CE7",
  },
  eventsListContainer: {
    maxHeight: 160,
  },
  eventsList: {
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  eventItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 10,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tripitEvent: {
    borderLeftWidth: 4,
    borderLeftColor: "#3B82F6",
  },
  bookedEvent: {
    borderLeftWidth: 4,
    borderLeftColor: "#10B981",
  },
  manualEvent: {
    borderLeftWidth: 4,
    borderLeftColor: "#8B5CF6",
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  eventTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#1F2937",
    marginRight: 6,
  },
  eventBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  eventSource: {
    fontSize: 9,
    fontWeight: "700" as const,
    color: "#6B7280",
  },
  eventDetails: {
    gap: 4,
  },
  eventDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eventDate: {
    fontSize: 11,
    color: "#6B7280",
  },
  eventLocation: {
    flex: 1,
    fontSize: 11,
    color: "#6B7280",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#6B7280",
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  overlapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
    alignSelf: 'center',
    gap: 2,
  },
  overlapText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700' as const,
  },
  overlappingEvent: {
    borderColor: '#FCA5A5',
  },
});