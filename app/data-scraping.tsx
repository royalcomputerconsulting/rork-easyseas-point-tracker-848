import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { ArrowLeft, Globe, Calendar, DollarSign, Database, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';

interface ScrapingJob {
  id: string;
  type: 'pricing' | 'itineraries' | 'full';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  updated: number;
  errors: string[];
  startTime: string;
  endTime?: string;
}

export default function DataScrapingScreen() {
  const [jobs, setJobs] = React.useState<ScrapingJob[]>([]);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = React.useState(false);
  const [isRunning, setIsRunning] = React.useState(false);

  // tRPC mutations for scraping
  const scrapeDataMutation = trpc.cruises.scrapeData.useMutation();
  const updatePricingMutation = trpc.cruises.updatePricing.useMutation();
  const refreshItinerariesMutation = trpc.cruises.refreshItineraries.useMutation();

  const addJob = (type: ScrapingJob['type'], status: ScrapingJob['status'] = 'pending') => {
    const job: ScrapingJob = {
      id: Date.now().toString(),
      type,
      status,
      progress: 0,
      updated: 0,
      errors: [],
      startTime: new Date().toISOString(),
    };
    setJobs(prev => [job, ...prev]);
    return job;
  };

  const updateJob = (id: string, updates: Partial<ScrapingJob>) => {
    setJobs(prev => prev.map(job => 
      job.id === id ? { ...job, ...updates } : job
    ));
  };

  const runFullDataScrape = async () => {
    if (isRunning) return;
    
    Alert.alert(
      'Full Data Scrape',
      'This will scrape fresh data from CruiseTimetables and CruiseMapper for all cruises. This may take several minutes.\n\n• Update itineraries and schedules\n• Refresh pricing data\n• Validate ship information\n\nContinue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Start Scraping', 
          style: 'default', 
          onPress: async () => {
            setIsRunning(true);
            const job = addJob('full', 'running');
            
            try {
              updateJob(job.id, { progress: 25 });
              
              // Step 1: Scrape general data
              const scrapeResult = await scrapeDataMutation.mutateAsync({
                forceRefresh: true
              });
              
              updateJob(job.id, { 
                progress: 50, 
                updated: scrapeResult.summary.totalUpdated 
              });
              
              // Step 2: Update pricing
              const pricingResult = await updatePricingMutation.mutateAsync({
                daysAhead: 20,
                includeBooked: true
              });
              
              updateJob(job.id, { 
                progress: 75,
                updated: job.updated + pricingResult.updated
              });
              
              // Step 3: Refresh itineraries
              const itineraryResult = await refreshItinerariesMutation.mutateAsync({
                forceRefresh: true
              });
              
              updateJob(job.id, {
                status: 'completed',
                progress: 100,
                updated: scrapeResult.summary.totalUpdated + pricingResult.updated + itineraryResult.updated,
                errors: [...scrapeResult.summary.totalErrors > 0 ? ['Some scraping errors occurred'] : [], ...pricingResult.errors, ...itineraryResult.errors],
                endTime: new Date().toISOString()
              });
              
              Alert.alert(
                'Scraping Complete! ✅',
                `Successfully updated ${scrapeResult.summary.totalUpdated + pricingResult.updated + itineraryResult.updated} cruise records with fresh data from CruiseTimetables and CruiseMapper.`,
                [{ text: 'Great!', style: 'default' }]
              );
              
            } catch (error) {
              updateJob(job.id, {
                status: 'failed',
                errors: [`Scraping failed: ${error}`],
                endTime: new Date().toISOString()
              });
              
              Alert.alert(
                'Scraping Failed',
                'Failed to scrape cruise data. Please check your internet connection and try again.',
                [{ text: 'OK', style: 'default' }]
              );
            } finally {
              setIsRunning(false);
            }
          }
        }
      ]
    );
  };

  const runPricingUpdate = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    const job = addJob('pricing', 'running');
    
    try {
      const result = await updatePricingMutation.mutateAsync({
        daysAhead: 20,
        includeBooked: true
      });
      
      updateJob(job.id, {
        status: 'completed',
        progress: 100,
        updated: result.updated,
        errors: result.errors,
        endTime: new Date().toISOString()
      });
      
      Alert.alert(
        'Pricing Updated! 💰',
        `Updated pricing for ${result.updated} cruises departing in the next 20 days and all booked cruises.`,
        [{ text: 'Great!', style: 'default' }]
      );
      
    } catch (error) {
      updateJob(job.id, {
        status: 'failed',
        errors: [`Pricing update failed: ${error}`],
        endTime: new Date().toISOString()
      });
    } finally {
      setIsRunning(false);
    }
  };

  const runItineraryRefresh = async () => {
    if (isRunning) return;
    
    setIsRunning(true);
    const job = addJob('itineraries', 'running');
    
    try {
      const result = await refreshItinerariesMutation.mutateAsync({
        forceRefresh: false
      });
      
      updateJob(job.id, {
        status: 'completed',
        progress: 100,
        updated: result.updated,
        errors: result.errors,
        endTime: new Date().toISOString()
      });
      
      Alert.alert(
        'Itineraries Refreshed! 🗺️',
        `Refreshed itinerary data for ${result.updated} cruises from CruiseTimetables.`,
        [{ text: 'Great!', style: 'default' }]
      );
      
    } catch (error) {
      updateJob(job.id, {
        status: 'failed',
        errors: [`Itinerary refresh failed: ${error}`],
        endTime: new Date().toISOString()
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getJobIcon = (job: ScrapingJob) => {
    if (job.status === 'running') return <ActivityIndicator size="small" color="#3B82F6" />;
    if (job.status === 'completed') return <CheckCircle size={20} color="#22C55E" />;
    if (job.status === 'failed') return <AlertTriangle size={20} color="#EF4444" />;
    return <Database size={20} color="#6B7280" />;
  };

  const getJobTypeLabel = (type: ScrapingJob['type']) => {
    switch (type) {
      case 'pricing': return 'Pricing Update';
      case 'itineraries': return 'Itinerary Refresh';
      case 'full': return 'Full Data Scrape';
      default: return 'Unknown';
    }
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.round((end.getTime() - start.getTime()) / 1000);
    
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.round(duration / 60)}m`;
    return `${Math.round(duration / 3600)}h`;
  };

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Data Scraping',
          headerStyle: { backgroundColor: '#3B82F6' },
          headerTintColor: '#FFFFFF',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <ScrollView style={styles.container} testID="data-scraping-screen">
        {/* Header Info */}
        <View style={styles.headerSection}>
          <Globe size={48} color="#3B82F6" />
          <Text style={styles.headerTitle}>Real-World Data Integration</Text>
          <Text style={styles.headerSubtitle}>
            Keep your cruise data up-to-date with fresh information from CruiseTimetables and CruiseMapper
          </Text>
        </View>

        {/* Data Sources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Sources</Text>
          
          <View style={styles.sourceCard}>
            <View style={styles.sourceHeader}>
              <Globe size={24} color="#22C55E" />
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceName}>CruiseTimetables.com</Text>
                <Text style={styles.sourceDescription}>Primary source for itineraries and schedules</Text>
              </View>
            </View>
            <Text style={styles.sourceDetails}>
              • Daily updates for all major cruise lines{'\n'}
              • Comprehensive port schedules{'\n'}
              • Departure and arrival times
            </Text>
          </View>
          
          <View style={styles.sourceCard}>
            <View style={styles.sourceHeader}>
              <Globe size={24} color="#3B82F6" />
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceName}>CruiseMapper.com</Text>
                <Text style={styles.sourceDescription}>Ship details and verification</Text>
              </View>
            </View>
            <Text style={styles.sourceDetails}>
              • Ship specifications and amenities{'\n'}
              • Live ship positions{'\n'}
              • Detailed itinerary information
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.primaryButton]}
            onPress={runFullDataScrape}
            disabled={isRunning}
          >
            <Database size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Full Data Scrape</Text>
            <Text style={styles.actionButtonSubtext}>Update all cruise data</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={runPricingUpdate}
            disabled={isRunning}
          >
            <DollarSign size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Update Pricing</Text>
            <Text style={styles.actionButtonSubtext}>Next 20 days + booked cruises</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.tertiaryButton]}
            onPress={runItineraryRefresh}
            disabled={isRunning}
          >
            <Calendar size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Refresh Itineraries</Text>
            <Text style={styles.actionButtonSubtext}>Weekly schedule updates</Text>
          </TouchableOpacity>
        </View>

        {/* Auto-Refresh Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Automation Settings</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto-Refresh Pricing</Text>
              <Text style={styles.settingDescription}>Daily updates for upcoming cruises</Text>
            </View>
            <Switch
              value={autoRefreshEnabled}
              onValueChange={setAutoRefreshEnabled}
              trackColor={{ false: '#E5E7EB', true: '#3B82F6' }}
              thumbColor={autoRefreshEnabled ? '#FFFFFF' : '#9CA3AF'}
            />
          </View>
          
          <Text style={styles.automationNote}>
            🚧 Automation features coming soon! For now, use manual updates above.
          </Text>
        </View>

        {/* Recent Jobs */}
        {jobs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Jobs</Text>
            
            {jobs.slice(0, 5).map(job => (
              <View key={job.id} style={styles.jobCard}>
                <View style={styles.jobHeader}>
                  {getJobIcon(job)}
                  <View style={styles.jobInfo}>
                    <Text style={styles.jobType}>{getJobTypeLabel(job.type)}</Text>
                    <Text style={styles.jobTime}>
                      {formatDuration(job.startTime, job.endTime)} ago
                    </Text>
                  </View>
                  <View style={styles.jobStats}>
                    <Text style={styles.jobUpdated}>{job.updated} updated</Text>
                    {job.errors.length > 0 && (
                      <Text style={styles.jobErrors}>{job.errors.length} errors</Text>
                    )}
                  </View>
                </View>
                
                {job.status === 'running' && (
                  <View style={styles.progressBar}>
                    <View 
                      style={[styles.progressFill, { width: `${job.progress}%` }]} 
                    />
                  </View>
                )}
                
                {job.errors.length > 0 && (
                  <View style={styles.errorContainer}>
                    {job.errors.slice(0, 2).map((error, index) => (
                      <Text key={index} style={styles.errorText}>• {error}</Text>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Implementation Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Implementation Status</Text>
          
          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>🚧 Development Phase</Text>
            <Text style={styles.noteText}>
              This is the foundation for real-world data scraping. The current implementation includes:
              {'\n\n'}
              ✅ Backend infrastructure for multiple data sources{'\n'}
              ✅ Rate limiting and error handling{'\n'}
              ✅ Data merging from multiple sources{'\n'}
              ✅ Mock scraping to demonstrate functionality{'\n'}
              {'\n'}
              🔄 Next steps:{'\n'}
              • Implement actual web scraping for CruiseTimetables{'\n'}
              • Add CruiseMapper integration{'\n'}
              • Set up automated scheduling{'\n'}
              • Add pricing validation and alerts
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  backButton: {
    padding: 8,
  },
  headerSection: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  sourceCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sourceInfo: {
    marginLeft: 12,
    flex: 1,
  },
  sourceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  sourceDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  sourceDetails: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
  },
  secondaryButton: {
    backgroundColor: '#10B981',
  },
  tertiaryButton: {
    backgroundColor: '#8B5CF6',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 12,
    flex: 1,
  },
  actionButtonSubtext: {
    fontSize: 12,
    color: '#E5E7EB',
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  settingDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  automationNote: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 12,
    fontStyle: 'italic',
  },
  jobCard: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  jobInfo: {
    marginLeft: 12,
    flex: 1,
  },
  jobType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  jobTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  jobStats: {
    alignItems: 'flex-end',
  },
  jobUpdated: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22C55E',
  },
  jobErrors: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 2,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  errorContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    lineHeight: 16,
  },
  noteCard: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
});