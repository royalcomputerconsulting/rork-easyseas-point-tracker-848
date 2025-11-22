import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus, Bell, Settings, Calendar as CalendarIcon } from 'lucide-react-native';
import { trpc, isBackendEnabled } from '@/lib/trpc';
import { ThemedCard } from '@/components/ui/ThemedCard';
import { useAppState } from '@/state/AppStateProvider';

const { width } = Dimensions.get('window');
const CELL_SIZE = (width - 32) / 7; // 7 days per week, 16px padding on each side
const COMPACT_CELL_SIZE = (width - 48) / 7; // Smaller for 90-day view

export default function CalendarScreen() {
  const { localData, hasLocalData, refreshLocalData } = useAppState();
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<'WEEK' | 'MONTH' | '90 DAY'>('MONTH');
  
  console.log('[Calendar] Component mounted, viewMode:', viewMode);
  
  // Get ALL calendar events from backend - use direct procedure to avoid 404
  const calendarQuery = trpc.directCalendar.events.useQuery(
    {}, // Empty object to get all events
    {
      enabled: isBackendEnabled,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      staleTime: 0, // No caching to ensure fresh data
      refetchInterval: false
    }
  );
  
  // Get cruises data for calendar population - use direct procedure to avoid 404
  const cruisesQuery = trpc.directCruises.list.useQuery(
    { limit: 1000 }, // Get all cruises
    {
      enabled: isBackendEnabled,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      staleTime: 0,
      refetchInterval: false
    }
  );
  
  // Log calendar query results
  React.useEffect(() => {
    if (calendarQuery.data) {
      console.log('[Calendar] Events query success, received:', calendarQuery.data.length, 'events');
      if (calendarQuery.data.length > 0) {
        const tripitCount = calendarQuery.data.filter((e: any) => e.source === 'tripit').length;
        console.log('[Calendar] TripIt events in response:', tripitCount);
      }
    }
    if (calendarQuery.error) {
      console.error('[Calendar] Events query error:', calendarQuery.error);
    }
  }, [calendarQuery.data, calendarQuery.error]);
  

  
  // TripIt import mutation with proper error handling and state updates
  const calendarImportMutation = trpc.calendar.importTripItDirect.useMutation({
    onError: (error) => {
      console.error('[Calendar] Import mutation error:', error);
      Alert.alert(
        'Import Failed',
        'Failed to import TripIt calendar. Please try again.',
        [{ text: 'OK' }]
      );
    },
    onSuccess: async (data) => {
      console.log('[Calendar] ✅ Import successful!');
      console.log('[Calendar] Events imported:', data?.eventsImported);
      console.log('[Calendar] Total events in store:', data?.totalInStore);
      console.log('[Calendar] TripIt events in store:', data?.tripItEventsInStore);
      
      // Force immediate refetch
      console.log('[Calendar] Starting immediate refetch...');
      await calendarQuery.refetch();
      
      // Also refetch after a delay to catch any async updates
      setTimeout(async () => {
        console.log('[Calendar] Doing delayed refetch...');
        const refetchResult = await calendarQuery.refetch();
        console.log('[Calendar] Delayed refetch complete, events:', refetchResult.data?.length);
        const tripitCount = refetchResult.data?.filter(e => e.source === 'tripit').length || 0;
        console.log('[Calendar] TripIt events after refetch:', tripitCount);
      }, 1000);
      
      // Show success message
      if (data?.eventsImported === 78) {
        Alert.alert(
          '✅ TripIt Sync Complete!',
          `Successfully imported all ${data.eventsImported} events from TripIt!\n\nYour calendar is now fully synchronized.`,
          [{ text: 'Excellent!' }]
        );
      } else if (data?.eventsImported > 0) {
        Alert.alert(
          '✅ Import Successful',
          `Imported ${data.eventsImported} events from TripIt calendar.`,
          [{ text: 'OK' }]
        );
      }
    }
  });

  
  // Get events from backend or local storage
  const events = React.useMemo(() => {
    if (isBackendEnabled) {
      const backendEvents = calendarQuery.data || [];
      console.log('[Calendar] Using backend events:', backendEvents.length);
      if (backendEvents.length > 0) {
        const tripitCount = backendEvents.filter((e: any) => e.source === 'tripit').length;
        console.log('[Calendar] TripIt events in data:', tripitCount);
      }
      return backendEvents;
    }
    console.log('[Calendar] Using local events:', localData.calendar?.length || 0);
    return localData.calendar || [];
  }, [isBackendEnabled, calendarQuery.data, localData.calendar]);
  
  // Get cruises data
  const cruises = React.useMemo(() => {
    if (isBackendEnabled) {
      const backendCruises = cruisesQuery.data?.cruises || [];
      console.log('[Calendar] Using backend cruises:', backendCruises.length);
      return backendCruises;
    }
    console.log('[Calendar] Using local cruises:', localData.cruises?.length || 0);
    return localData.cruises || [];
  }, [isBackendEnabled, cruisesQuery.data, localData.cruises]);
  

  
  // Log event counts for debugging
  React.useEffect(() => {
    const tripitEvents = events.filter((e: any) => e.source === 'tripit');
    const bookedEvents = events.filter((e: any) => e.source === 'booked');
    const manualEvents = events.filter((e: any) => e.source === 'manual');
    
    console.log('[Calendar] Current events state:', {
      total: events.length,
      tripit: tripitEvents.length,
      booked: bookedEvents.length,
      manual: manualEvents.length,
      isLoading: calendarQuery.isLoading,
      isError: calendarQuery.isError,
      isFetching: calendarQuery.isFetching
    });
    
    // Log sample TripIt events if any
    if (tripitEvents.length > 0) {
      console.log('[Calendar] Sample TripIt events:', tripitEvents.slice(0, 3).map(e => ({
        summary: e.summary,
        startDate: e.startDate,
        endDate: e.endDate
      })));
    }
  }, [events, calendarQuery.isLoading, calendarQuery.isError, calendarQuery.isFetching]);

  // Generate calendar data based on view mode
  const generateCalendarData = () => {
    const calendarData = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (viewMode === 'WEEK') {
      // Generate current week
      const startOfWeek = new Date(currentDate);
      const dayOfWeek = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);
      
      const weekDays = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Check if this date has any events
        const dayEvents = events.filter((event: any) => {
          if (!event?.startDate || !event?.endDate) return false;
          const eventStart = new Date(event.startDate);
          const eventEnd = new Date(event.endDate);
          const currentDate = new Date(dateStr);
          return currentDate >= eventStart && currentDate <= eventEnd;
        });
        
        // Check if this date has any cruises
        const dayCruises = cruises.filter((cruise: any) => {
          if (!cruise?.departureDate || !cruise?.returnDate) return false;
          const cruiseStart = new Date(cruise.departureDate);
          const cruiseEnd = new Date(cruise.returnDate);
          const currentDate = new Date(dateStr);
          return currentDate >= cruiseStart && currentDate <= cruiseEnd;
        });
        
        const allDayItems = [...dayEvents, ...dayCruises];
        
        weekDays.push({
          date,
          dateStr,
          day: date.getDate(),
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          isToday: dateStr === today.toISOString().split('T')[0],
          events: dayEvents,
          cruises: dayCruises,
          isAvailable: allDayItems.length === 0
        });
      }
      
      calendarData.push({
        name: `Week of ${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        weeks: [weekDays],
        isWeekView: true
      });
      
    } else if (viewMode === '90 DAY') {
      // Generate 90 days from current date
      const startDate = new Date(currentDate);
      startDate.setHours(0, 0, 0, 0);
      
      for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
        const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + monthOffset, 1);
        const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
        const firstDayOfWeek = monthDate.getDay();
        
        const monthDays = [];
        
        // Add empty cells for days before month starts
        for (let i = 0; i < firstDayOfWeek; i++) {
          monthDays.push(null);
        }
        
        // Add actual days of the month
        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
          const dateStr = date.toISOString().split('T')[0];
          
          // Check if this date has any events
          const dayEvents = events.filter((event: any) => {
            if (!event?.startDate || !event?.endDate) return false;
            const eventStart = new Date(event.startDate);
            const eventEnd = new Date(event.endDate);
            const currentDate = new Date(dateStr);
            return currentDate >= eventStart && currentDate <= eventEnd;
          });
          
          // Check if this date has any cruises
          const dayCruises = cruises.filter((cruise: any) => {
            if (!cruise?.departureDate || !cruise?.returnDate) return false;
            const cruiseStart = new Date(cruise.departureDate);
            const cruiseEnd = new Date(cruise.returnDate);
            const currentDate = new Date(dateStr);
            return currentDate >= cruiseStart && currentDate <= cruiseEnd;
          });
          
          const allDayItems = [...dayEvents, ...dayCruises];
          
          monthDays.push({
            date,
            dateStr,
            day,
            month: date.toLocaleDateString('en-US', { month: 'short' }),
            isToday: dateStr === today.toISOString().split('T')[0],
            events: dayEvents,
            cruises: dayCruises,
            isAvailable: allDayItems.length === 0
          });
        }
        
        // Group days into weeks
        const weeks = [];
        for (let i = 0; i < monthDays.length; i += 7) {
          weeks.push(monthDays.slice(i, i + 7));
        }
        
        calendarData.push({
          name: monthName,
          weeks,
          monthDate
        });
      }
      
    } else {
      // MONTH view - single month
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
      const firstDayOfWeek = monthDate.getDay();
      
      const monthDays = [];
      
      // Add empty cells for days before month starts
      for (let i = 0; i < firstDayOfWeek; i++) {
        monthDays.push(null);
      }
      
      // Add actual days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
        const dateStr = date.toISOString().split('T')[0];
        
        // Check if this date has any events
        const dayEvents = events.filter((event: any) => {
          if (!event?.startDate || !event?.endDate) return false;
          const eventStart = new Date(event.startDate);
          const eventEnd = new Date(event.endDate);
          const currentDate = new Date(dateStr);
          return currentDate >= eventStart && currentDate <= eventEnd;
        });
        
        // Check if this date has any cruises
        const dayCruises = cruises.filter((cruise: any) => {
          if (!cruise?.departureDate || !cruise?.returnDate) return false;
          const cruiseStart = new Date(cruise.departureDate);
          const cruiseEnd = new Date(cruise.returnDate);
          const currentDate = new Date(dateStr);
          return currentDate >= cruiseStart && currentDate <= cruiseEnd;
        });
        
        const allDayItems = [...dayEvents, ...dayCruises];
        
        monthDays.push({
          date,
          dateStr,
          day,
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          isToday: dateStr === today.toISOString().split('T')[0],
          events: dayEvents,
          cruises: dayCruises,
          isAvailable: allDayItems.length === 0
        });
      }
      
      // Group days into weeks
      const weeks = [];
      for (let i = 0; i < monthDays.length; i += 7) {
        weeks.push(monthDays.slice(i, i + 7));
      }
      
      calendarData.push({
        name: monthName,
        weeks,
        monthDate
      });
    }
    
    return calendarData;
  };
  
  const calendarData = generateCalendarData();
  

  
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'WEEK') {
      // Navigate by week
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      // Navigate by month
      newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };
  
  const navigateYear = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(currentDate.getFullYear() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };
  


  return (
    <ScrollView style={styles.container} testID="calendar-screen">
      {/* Club Royale Point Tracker Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.leftSection}>
            <View style={styles.logoRow}>
              <Text style={styles.logoEmoji}>🚢</Text>
              <Text style={styles.appTitle}>CLUB ROYALE POINT TRACKER</Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>⭐ LEVEL: PRIME</Text>
              <Text style={styles.pointsText}>⭐ Points: 3,130 • Next: 25,000</Text>
            </View>
            <View style={styles.statusRow}>
              <View style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.statusText}>Open</Text>
              </View>
              <View style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={styles.statusText}>TripIt Items</Text>
              </View>
              <View style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={styles.statusText}>iCal Events</Text>
              </View>
            </View>
          </View>
          <View style={styles.rightSection}>
            <TouchableOpacity style={styles.headerIconButton}>
              <Plus size={20} color="#000000" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconButton}>
              <View style={styles.notificationContainer}>
                <Bell size={20} color="#000000" />
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationText}>66</Text>
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerIconButton}
              onPress={() => router.push('/settings')}
            >
              <Settings size={20} color="#000000" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      {/* Month/Year Navigation */}
      <View style={styles.navigation}>
        <TouchableOpacity onPress={() => navigateMonth('prev')} testID="prev-month">
          <ChevronLeft size={24} color="#374151" />
        </TouchableOpacity>
        <View style={styles.monthRow}>
          <Text style={styles.monthYearText}>
            {viewMode === 'WEEK' 
              ? `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity
            style={styles.syncButton}
            onPress={async () => {
              console.log('[Calendar] 🔄 Starting TripIt sync...');
              
              if (!isBackendEnabled) {
                Alert.alert(
                  'Backend Required',
                  'TripIt sync requires the backend to be enabled. Please ensure the backend is running.',
                  [{ text: 'OK' }]
                );
                return;
              }
              
              try {
                // Call the backend import mutation
                console.log('[Calendar] Calling importTripItDirect mutation...');
                const result = await calendarImportMutation.mutateAsync();
                console.log('[Calendar] Mutation result:', result);
                
                // Force immediate refetch after successful import
                if (result?.success) {
                  console.log('[Calendar] Import successful, forcing immediate refetch...');
                  await calendarQuery.refetch();
                }
              } catch (error: any) {
                console.error('[Calendar] Sync error:', error);
                // Error handling is done in the mutation's onError callback
              }
            }}
            testID="sync-calendar-button"
          >
            {calendarImportMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <CalendarIcon size={16} color="#FFFFFF" />
                <Text style={styles.syncButtonText}>Sync</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => navigateMonth('next')} testID="next-month">
          <ChevronRight size={24} color="#374151" />
        </TouchableOpacity>
      </View>


      
      {/* Filter Bubbles */}
      <View style={styles.filterContainer}>
        {(['WEEK', 'MONTH', '90 DAY'] as const).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.filterBubble,
              viewMode === mode && styles.filterBubbleActive
            ]}
            onPress={() => setViewMode(mode)}
          >
            <Text style={[
              styles.filterText,
              viewMode === mode && styles.filterTextActive
            ]}>
              {mode}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Calendar Container */}
      <View style={styles.calendarContainer}>
        
        {/* Calendar display based on view mode */}
        {viewMode === '90 DAY' ? (
          // 90 Day View - Show multiple months
          <ScrollView style={styles.multiMonthContainer}>
            {calendarData.map((month, monthIndex) => (
              <View key={`month-${monthIndex}`} style={styles.monthSection}>
                <Text style={styles.monthTitle}>{month.name}</Text>
                <View style={styles.monthGrid}>
                  {/* Day headers */}
                  <View style={styles.weekHeader}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                      <View key={`header-${monthIndex}-${idx}`} style={styles.compactDayHeader}>
                        <Text style={styles.compactDayHeaderText}>{day}</Text>
                      </View>
                    ))}
                  </View>
                  {/* Month weeks */}
                  {month.weeks.map((week, weekIndex) => (
                    <View key={`week-${monthIndex}-${weekIndex}`} style={styles.compactWeek}>
                      {week.map((day, dayIndex) => {
                        let backgroundColor = '#10B981';
                        let textColor = '#FFFFFF';
                        
                        if (day && ((day.events && day.events.length > 0) || (day.cruises && day.cruises.length > 0))) {
                          const hasTripit = day.events?.some((e: any) => e.source === 'tripit');
                          const hasBooked = day.events?.some((e: any) => e.source === 'booked');
                          const hasCruises = day.cruises && day.cruises.length > 0;
                          
                          if (hasCruises) {
                            backgroundColor = '#3B82F6'; // Blue for cruises
                          } else if (hasTripit) {
                            backgroundColor = '#3B82F6';
                          } else if (hasBooked) {
                            backgroundColor = '#EF4444';
                          } else {
                            backgroundColor = '#8B5CF6';
                          }
                        }
                        
                        return (
                          <TouchableOpacity
                            key={day ? `day-${day.dateStr}` : `empty-${monthIndex}-${weekIndex}-${dayIndex}`}
                            style={[
                              styles.compactDay,
                              day ? { backgroundColor } : styles.emptyDay,
                              day?.isToday && styles.todayBorder
                            ]}
                            onPress={() => {
                              if (day) {
                                setSelectedDate(day.dateStr);
                                router.push(`/day-agenda/${day.dateStr}`);
                              }
                            }}
                            disabled={!day}
                          >
                            {day && (
                              <Text style={[styles.compactDayText, { color: textColor }]}>
                                {day.day}
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        ) : viewMode === 'WEEK' ? (
          // Week View
          <View style={styles.weekViewContainer}>
            {calendarData[0].weeks[0].map((day, dayIndex) => {
              let backgroundColor = '#10B981';
              let textColor = '#FFFFFF';
              let eventCount = 0;
              
              if (day && ((day.events && day.events.length > 0) || (day.cruises && day.cruises.length > 0))) {
                const hasTripit = day.events?.some((e: any) => e.source === 'tripit');
                const hasBooked = day.events?.some((e: any) => e.source === 'booked');
                const hasCruises = day.cruises && day.cruises.length > 0;
                eventCount = (day.events?.length || 0) + (day.cruises?.length || 0);
                
                if (hasCruises) {
                  backgroundColor = '#3B82F6'; // Blue for cruises
                } else if (hasTripit) {
                  backgroundColor = '#3B82F6';
                } else if (hasBooked) {
                  backgroundColor = '#EF4444';
                } else {
                  backgroundColor = '#8B5CF6';
                }
              }
              
              return (
                <TouchableOpacity
                  key={`weekday-${dayIndex}`}
                  style={[
                    styles.weekDay,
                    { backgroundColor },
                    day?.isToday && styles.todayBorder
                  ]}
                  onPress={() => {
                    if (day) {
                      setSelectedDate(day.dateStr);
                      router.push(`/day-agenda/${day.dateStr}`);
                    }
                  }}
                >
                  <Text style={[styles.weekDayName, { color: textColor }]}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex]}
                  </Text>
                  <Text style={[styles.weekDayNumber, { color: textColor }]}>
                    {day?.day}
                  </Text>
                  {day?.month && (
                    <Text style={[styles.weekDayMonth, { color: textColor }]}>
                      {day.month}
                    </Text>
                  )}
                  {eventCount > 0 && (
                    <View style={styles.weekEventBadge}>
                      <Text style={[styles.weekEventCount, { color: textColor }]}>
                        {eventCount} {eventCount === 1 ? 'event' : 'events'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          // Month View (default)
          <>
            {/* Day headers */}
            <View style={styles.weekHeader}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, dayHeaderIndex) => (
                <View key={`header-${dayHeaderIndex}-${day}`} style={styles.dayHeader}>
                  <Text style={styles.dayHeaderText}>{day}</Text>
                </View>
              ))}
            </View>
            
            {/* Calendar weeks */}
            {calendarData[0].weeks.map((week, weekIndex) => (
              <View key={`week-${weekIndex}`} style={styles.week}>
                {week.map((day, dayIndex) => {
                  // Determine color based on events and status
                  let backgroundColor = '#10B981'; // Green (Open)
                  let textColor = '#FFFFFF';
                  let eventCount = 0;
                  
                  if (day) {
                    // Calculate total event count from both events and cruises
                    eventCount = (day.events?.length || 0) + (day.cruises?.length || 0);
                    
                    // Only change color if there are events
                    if (eventCount > 0) {
                      const hasTripit = day.events?.some((e: any) => e.source === 'tripit');
                      const hasBooked = day.events?.some((e: any) => e.source === 'booked');
                      const hasManual = day.events?.some((e: any) => e.source === 'manual');
                      const hasCruises = day.cruises && day.cruises.length > 0;
                      
                      // Priority order: Cruises > TripIt > Booked > Manual
                      if (hasCruises) {
                        backgroundColor = '#3B82F6'; // Blue for cruises
                      } else if (hasTripit) {
                        backgroundColor = '#3B82F6'; // Blue (TripIt)
                      } else if (hasBooked) {
                        backgroundColor = '#EF4444'; // Red (Booked)
                      } else if (hasManual) {
                        backgroundColor = '#8B5CF6'; // Violet (Manual iCal)
                      } else {
                        // Any other events
                        backgroundColor = '#6B7280'; // Gray
                      }
                    }
                  }
                  
                  return (
                    <TouchableOpacity
                      key={day ? `day-${day.dateStr}` : `empty-${weekIndex}-${dayIndex}`}
                      style={[
                        styles.calendarDay,
                        day ? { backgroundColor } : styles.emptyDay,
                        day?.isToday && styles.todayBorder
                      ]}
                      onPress={() => {
                        if (day) {
                          setSelectedDate(day.dateStr);
                          console.log('[Calendar] Selected date:', day.dateStr, 'Day number:', day.day);
                          router.push(`/day-agenda/${day.dateStr}`);
                        }
                      }}
                      disabled={!day}
                      testID={day ? `calendar-day-${day.dateStr}` : `empty-day-${weekIndex}-${dayIndex}`}
                    >
                      {day && (
                        <>
                          <Text style={[styles.calendarDayText, { color: textColor }]}>
                            {day.day}
                          </Text>
                          {eventCount > 0 && (
                            <View style={styles.eventCountBadge}>
                              <Text style={[styles.eventCountText, { color: textColor }]}>
                                {eventCount}
                              </Text>
                            </View>
                          )}
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </>
        )}
      </View>
      
      {/* Quick Actions */}
      <View style={styles.section}>
        <ThemedCard>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/(scheduling)')}
          >
            <View style={styles.actionIcon}>
              <CalendarIcon size={24} color="#6C5CE7" />
            </View>
            <Text style={styles.actionTitle}>View Available Cruises</Text>
            <Text style={styles.actionSubtitle}>See cruises that fit your schedule</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/import')}
          >
            <View style={styles.actionIcon}>
              <Plus size={24} color="#10B981" />
            </View>
            <Text style={styles.actionTitle}>Import Calendar</Text>
            <Text style={styles.actionSubtitle}>Add personal iCal events</Text>
          </TouchableOpacity>
          </View>
        </ThemedCard>
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leftSection: {
    flex: 1,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E3A8A',
    letterSpacing: 0.5,
  },
  levelBadge: {
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    alignSelf: 'stretch',
    marginBottom: 16,
  },
  levelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  pointsText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  notificationContainer: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 24,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 200,
    justifyContent: 'center',
  },
  monthYearText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 12,
  },
  filterBubble: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterBubbleActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  calendarContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  multiMonthContainer: {
    maxHeight: 600,
  },
  monthSection: {
    marginBottom: 24,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  monthGrid: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  weekViewContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  weekDay: {
    flex: 1,
    height: 120,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  weekDayName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  weekDayNumber: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 2,
  },
  weekDayMonth: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 8,
  },
  weekEventBadge: {
    marginTop: 4,
  },
  weekEventCount: {
    fontSize: 10,
    fontWeight: '600',
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayHeader: {
    width: CELL_SIZE,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  compactDayHeader: {
    width: COMPACT_CELL_SIZE,
    alignItems: 'center',
    paddingVertical: 4,
  },
  compactDayHeaderText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  week: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  compactWeek: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  calendarDay: {
    width: CELL_SIZE - 4,
    height: CELL_SIZE - 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginHorizontal: 2,
    marginVertical: 2,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  compactDay: {
    width: COMPACT_CELL_SIZE - 2,
    height: COMPACT_CELL_SIZE - 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginHorizontal: 1,
    marginVertical: 1,
  },
  compactDayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyDay: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  todayBorder: {
    borderWidth: 2,
    borderColor: '#111827',
  },
  calendarDayText: {
    fontSize: 16,
    fontWeight: '700',
  },
  eventCountBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  eventCountText: {
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
  },
  cruiseCard: {
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
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  cruiseDate: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
    marginRight: 8,
  },
  cruiseNights: {
    fontSize: 12,
    color: '#6B7280',
  },
  cruiseItinerary: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 2,
  },
  cruisePort: {
    fontSize: 11,
    color: '#6B7280',
  },
  eventsScrollView: {
    maxHeight: 300,
  },
  eventCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pastEventCard: {
    backgroundColor: '#F3F4F6',
    opacity: 0.7,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  eventDate: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
  },
  eventLocation: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  eventSource: {
    fontSize: 11,
    color: '#6B7280',
  },
  pastEventTitle: {
    color: '#9CA3AF',
  },
  pastEventDate: {
    color: '#9CA3AF',
  },
  pastEventLocation: {
    color: '#9CA3AF',
  },
  pastEventSource: {
    color: '#9CA3AF',
  },
  pastLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  importButton: {
    marginTop: 12,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  importButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});