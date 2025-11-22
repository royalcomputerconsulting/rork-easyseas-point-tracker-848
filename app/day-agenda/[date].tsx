import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { 
  ArrowLeft,
  Calendar,
  Ship,
  Plane,
  MapPin,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  MapPinIcon,
} from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { COLORS, SHADOW, SPACING, BORDER_RADIUS } from '@/constants/theme';

type ViewMode = 'day' | 'week' | 'month' | 'year';

export default function DayAgendaScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  
  const normalizedDate = date?.includes('T') ? date.split('T')[0] : date;
  console.log('[DayAgenda] Loading agenda for date:', normalizedDate);
  
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  
  const eventsQuery = trpc.calendar.events.useQuery({
    dateRange: {
      from: normalizedDate!,
      to: normalizedDate!
    }
  });
  
  const events = useMemo(() => {
    const allEvents = eventsQuery.data || [];
    
    const uniqueEventsMap = new Map<string, any>();
    allEvents.forEach((event: any) => {
      if (!event || !event.startDate || !event.endDate) return;
      
      const eventStartDate = event.startDate.split('T')[0];
      const eventEndDate = event.endDate.split('T')[0];
      
      if (normalizedDate >= eventStartDate && normalizedDate <= eventEndDate) {
        const key = `${event.summary}-${event.startDate}-${event.endDate}-${event.source}`;
        if (!uniqueEventsMap.has(key)) {
          uniqueEventsMap.set(key, event);
        }
      }
    });
    
    return Array.from(uniqueEventsMap.values());
  }, [eventsQuery.data, normalizedDate]);

  const dailyActivities = useMemo(() => {
    const activities: any[] = [];
    const seenIds = new Set<string>();
    
    events.forEach((event: any) => {
      if (seenIds.has(event.id)) {
        return;
      }
      
      const startDate = new Date(event.startDate);
      const endDate = new Date(event.endDate);
      
      const hasTimeComponent = event.startDate.includes('T');
      
      if (!hasTimeComponent) {
        return;
      }
      
      seenIds.add(event.id);
      
      const timeStr = startDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      const durationMs = endDate.getTime() - startDate.getTime();
      const durationMinutes = Math.max(15, Math.round(durationMs / (1000 * 60)));
      
      let icon = Calendar;
      if (event.source === 'tripit') {
        if (event.summary.toLowerCase().includes('flight')) {
          icon = Plane;
        } else if (event.summary.toLowerCase().includes('cruise')) {
          icon = Ship;
        } else {
          icon = MapPin;
        }
      } else if (event.source === 'booked') {
        icon = Ship;
      }
      
      activities.push({
        id: event.id,
        time: timeStr,
        title: event.summary,
        location: event.location || '',
        description: event.description || '',
        duration: durationMinutes,
        source: event.source,
        icon,
        startDate,
        endDate
      });
    });
    
    activities.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    
    return activities;
  }, [events]);

  const allDayEvents = useMemo(() => {
    const seenIds = new Set<string>();
    return events.filter((event: any) => {
      if (seenIds.has(event.id) || event.startDate.includes('T')) {
        return false;
      }
      seenIds.add(event.id);
      return true;
    });
  }, [events]);
  
  if (eventsQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    );
  }
  
  const [year, month, day] = normalizedDate!.split('-').map(Number);
  const selectedDate = new Date(year, month - 1, day);
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  const formatDayOfWeek = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };
  
  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    const newDateStr = newDate.toISOString().split('T')[0];
    router.replace(`/day-agenda/${newDateStr}`);
  };
  
  const goToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    router.replace(`/day-agenda/${today}`);
  };
  
  const handleEventPress = (event: any) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };
  
  const generateCalendarDays = () => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    const days: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return days;
  };
  
  const calendarDays = generateCalendarDays();
  const monthName = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const getEventColor = (source: string) => {
    switch (source) {
      case 'tripit': return { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626' };
      case 'manual': return { bg: '#EBF4FF', border: '#BFDBFE', text: '#2563EB' };
      case 'booked': return { bg: '#EBF8FF', border: '#BFDBFE', text: '#0EA5E9' };
      default: return { bg: '#F3F4F6', border: '#D1D5DB', text: '#374151' };
    }
  };

  const getEventIcon = (event: any) => {
    if (event.source === 'tripit') {
      return event.summary?.toLowerCase().includes('flight') ? 
        <Plane size={16} color={getEventColor(event.source).text} /> :
        <Calendar size={16} color={getEventColor(event.source).text} />;
    }
    if (event.source === 'booked') {
      return <Ship size={16} color={getEventColor(event.source).text} />;
    }
    return <Calendar size={16} color={getEventColor(event.source).text} />;
  };
  
  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: false,
        }} 
      />
      <View style={styles.container}>
        {/* Custom Header */}
        <View style={styles.customHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={COLORS.textLight} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Day Agenda</Text>
          <View style={{ width: 40 }} />
        </View>
        
        {/* Date Header with Navigation */}
        <View style={styles.dateHeader}>
          <View style={styles.dateNavigationRow}>
            <TouchableOpacity onPress={() => navigateDate('prev')} style={styles.navButton}>
              <ChevronLeft size={24} color={COLORS.textLight} />
            </TouchableOpacity>
            
            <View style={styles.dateInfo}>
              <Text style={styles.dateTitle}>{formatDateShort(selectedDate)}</Text>
              <Text style={styles.dayOfWeek}>{formatDayOfWeek(selectedDate)}</Text>
            </View>
            
            <TouchableOpacity onPress={() => navigateDate('next')} style={styles.navButton}>
              <ChevronRight size={24} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
            <Text style={styles.todayButtonText}>Today</Text>
          </TouchableOpacity>
        </View>
        
        {/* View Mode Selector */}
        <View style={styles.viewModeContainer}>
          {(['day', 'week', 'month', 'year'] as ViewMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.viewModeButton,
                viewMode === mode && styles.viewModeButtonActive,
              ]}
              onPress={() => setViewMode(mode)}
            >
              <Text
                style={[
                  styles.viewModeText,
                  viewMode === mode && styles.viewModeTextActive,
                ]}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <ScrollView style={styles.scrollContent} testID="day-agenda-screen">

        {allDayEvents.length > 0 && (
          <View style={styles.allDaySection}>
            <Text style={styles.allDayTitle}>All-day</Text>
            {allDayEvents.map((event: any) => {
              const colors = getEventColor(event.source);
              return (
                <TouchableOpacity
                  key={event.id}
                  style={[styles.allDayEvent, { backgroundColor: colors.bg, borderColor: colors.border }]}
                  onPress={() => handleEventPress(event)}
                >
                  <View style={styles.allDayEventContent}>
                    {getEventIcon(event)}
                    <Text style={[styles.allDayEventTitle, { color: colors.text }]}>{event.summary}</Text>
                  </View>
                  {event.location && (
                    <Text style={styles.allDayEventLocation}>{event.location}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.activitiesContainer}>
          <View style={styles.activitiesHeader}>
            <Text style={styles.activitiesTitle}>Schedule</Text>
          </View>
          
          {dailyActivities.length > 0 ? (
            <View style={styles.activitiesList}>
              {dailyActivities.map((activity, index) => {
                const colors = getEventColor(activity.source);
                const Icon = activity.icon;
                
                const endTime = new Date(activity.endDate);
                const endTimeStr = endTime.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                });
                
                return (
                  <TouchableOpacity
                    key={activity.id}
                    style={styles.activityItem}
                    onPress={() => handleEventPress(activity)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.activityTime}>
                      <Text style={styles.activityTimeText}>{activity.time}</Text>
                    </View>
                    <View 
                      style={[
                        styles.activityContent,
                        { backgroundColor: colors.bg, borderLeftColor: colors.border }
                      ]}
                    >
                      <View style={styles.activityHeader}>
                        <Icon size={18} color={colors.text} />
                        <Text style={[styles.activityTitle, { color: colors.text }]}>
                          {activity.title}
                        </Text>
                      </View>
                      {activity.location && (
                        <Text style={styles.activityLocation} numberOfLines={1}>
                          {activity.location}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.noActivitiesContainer}>
              <Calendar size={48} color="#6B7280" />
              <Text style={styles.noActivitiesTitle}>No scheduled activities</Text>
              <Text style={styles.noActivitiesDescription}>
                No events with specific times for this day.
              </Text>
            </View>
          )}
        </View>
        
        {events.length === 0 && (
          <View style={styles.emptyState}>
            <Calendar size={48} color={COLORS.textLightSecondary} />
            <Text style={styles.emptyTitle}>No events scheduled</Text>
            <Text style={styles.emptyDescription}>
              This day is available for new activities.
            </Text>
          </View>
        )}
        
        {/* Mini Calendar */}
        <View style={styles.miniCalendarSection}>
          <Text style={styles.miniCalendarTitle}>{monthName}</Text>
          <View style={styles.miniCalendar}>
            <View style={styles.weekDaysRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayName, idx) => (
                <Text key={idx} style={styles.weekDayText}>{dayName}</Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarDays.map((dayNum, idx) => {
                const isToday = dayNum === day;
                const hasEvents = dayNum ? events.some((e: any) => {
                  const eventDate = new Date(e.startDate);
                  return eventDate.getDate() === dayNum && 
                         eventDate.getMonth() === month - 1 && 
                         eventDate.getFullYear() === year;
                }) : false;
                
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.calendarDay,
                      isToday && styles.calendarDayToday,
                      !dayNum && styles.calendarDayEmpty,
                    ]}
                    disabled={!dayNum}
                    onPress={() => {
                      if (dayNum) {
                        const newDate = new Date(year, month - 1, dayNum);
                        const newDateStr = newDate.toISOString().split('T')[0];
                        router.replace(`/day-agenda/${newDateStr}`);
                      }
                    }}
                  >
                    {dayNum && (
                      <>
                        <Text style={[
                          styles.calendarDayText,
                          isToday && styles.calendarDayTextToday,
                        ]}>
                          {dayNum}
                        </Text>
                        {hasEvents && <View style={styles.eventDot} />}
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
      
      {/* Event Detail Modal */}
      <Modal
        visible={showEventModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEventModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowEventModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Event Details</Text>
              <TouchableOpacity onPress={() => setShowEventModal(false)}>
                <X size={24} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>
            
            {selectedEvent && (
              <View style={styles.modalBody}>
                <View style={styles.modalEventHeader}>
                  {selectedEvent.icon && <selectedEvent.icon size={24} color={COLORS.highlightAqua} />}
                  <Text style={styles.modalEventTitle}>{selectedEvent.title || selectedEvent.summary}</Text>
                </View>
                
                {selectedEvent.time && (
                  <View style={styles.modalRow}>
                    <Clock size={18} color={COLORS.textLightSecondary} />
                    <Text style={styles.modalRowText}>
                      {selectedEvent.time}
                      {selectedEvent.endDate && ` - ${new Date(selectedEvent.endDate).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}`}
                    </Text>
                  </View>
                )}
                
                {selectedEvent.location && (
                  <View style={styles.modalRow}>
                    <MapPinIcon size={18} color={COLORS.textLightSecondary} />
                    <Text style={styles.modalRowText}>{selectedEvent.location}</Text>
                  </View>
                )}
                
                {selectedEvent.description && (
                  <View style={styles.modalDescription}>
                    <Text style={styles.modalDescriptionText}>{selectedEvent.description}</Text>
                  </View>
                )}
                
                {selectedEvent.source && (
                  <View style={styles.modalSource}>
                    <Text style={styles.modalSourceText}>Source: {selectedEvent.source}</Text>
                  </View>
                )}
                
                {selectedEvent.source === 'booked' && selectedEvent.cruiseId && (
                  <TouchableOpacity
                    style={styles.viewCruiseButton}
                    onPress={() => {
                      setShowEventModal(false);
                      router.push(`/cruise/${selectedEvent.cruiseId}`);
                    }}
                  >
                    <Ship size={18} color="#FFFFFF" />
                    <Text style={styles.viewCruiseButtonText}>View Cruise Details</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryDark,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: 60,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.primaryDark,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: COLORS.textLight,
  },
  dateHeader: {
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  dateNavigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dateInfo: {
    alignItems: 'center',
    gap: 4,
  },
  dateTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: COLORS.textLight,
  },
  dayOfWeek: {
    fontSize: 14,
    color: COLORS.textLightSecondary,
  },
  todayButton: {
    alignSelf: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.highlightAqua,
    borderRadius: BORDER_RADIUS.pill,
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  viewModeButtonActive: {
    backgroundColor: COLORS.highlightAqua,
  },
  viewModeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: COLORS.textLightSecondary,
  },
  viewModeTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  dateSubtitle: {
    fontSize: 14,
    color: COLORS.textLightSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  allDaySection: {
    backgroundColor: COLORS.navyDeep,
    padding: SPACING.lg,
    marginBottom: 2,
  },
  allDayTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: COLORS.textLightSecondary,
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  allDayEvent: {
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
  },
  allDayEventContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allDayEventTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    flex: 1,
  },
  allDayEventLocation: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  activitiesContainer: {
    backgroundColor: COLORS.primaryDark,
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  activitiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  activitiesTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: COLORS.textLight,
  },
  activitiesList: {
    paddingVertical: 16,
  },
  activityItem: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  activityTime: {
    width: 60,
    paddingTop: SPACING.md,
  },
  activityTimeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: COLORS.textLightSecondary,
  },
  activityContent: {
    flex: 1,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.navyDeep,
    borderLeftWidth: 4,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
    color: COLORS.textLight,
  },
  activityLocation: {
    fontSize: 12,
    color: COLORS.textLightSecondary,
    marginTop: 4,
  },
  noActivitiesContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
    backgroundColor: COLORS.navyDeep,
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
  },
  noActivitiesTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: COLORS.textLight,
  },
  noActivitiesDescription: {
    fontSize: 14,
    color: COLORS.textLightSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
    gap: 16,
    backgroundColor: COLORS.navyDeep,
    margin: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: COLORS.textLight,
  },
  emptyDescription: {
    fontSize: 14,
    color: COLORS.textLightSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  miniCalendarSection: {
    backgroundColor: COLORS.navyDeep,
    margin: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOW.oceanicCard,
  },
  miniCalendarTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.textLight,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  miniCalendar: {
    gap: SPACING.sm,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.sm,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: COLORS.textLightSecondary,
    width: 40,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  calendarDayToday: {
    backgroundColor: COLORS.highlightAqua,
    borderRadius: BORDER_RADIUS.sm,
  },
  calendarDayEmpty: {
    opacity: 0,
  },
  calendarDayText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  calendarDayTextToday: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.accentMagenta,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.navyDeep,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: COLORS.textLight,
  },
  modalBody: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  modalEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  modalEventTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: COLORS.textLight,
    flex: 1,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  modalRowText: {
    fontSize: 14,
    color: COLORS.textLightSecondary,
    flex: 1,
  },
  modalDescription: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
  },
  modalDescriptionText: {
    fontSize: 14,
    color: COLORS.textLightSecondary,
    lineHeight: 20,
  },
  modalSource: {
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalSourceText: {
    fontSize: 12,
    color: COLORS.textLightSecondary,
    textTransform: 'capitalize',
  },
  viewCruiseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.highlightAqua,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
  },
  viewCruiseButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
