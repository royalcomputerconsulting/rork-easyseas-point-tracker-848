import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import { 
  AlertCircle, 
  TrendingDown, 
  X,
  CheckCircle,
  Filter
} from "lucide-react-native";
import { trpc } from '@/lib/trpc';

type AlertType = "import_error" | "price_drop" | "threshold_hit";
type AlertSeverity = "info" | "warning" | "error";



export default function AlertsScreen() {
  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedFilter, setSelectedFilter] = React.useState<'all' | 'unresolved' | 'resolved'>('unresolved');
  const [selectedWindow, setSelectedWindow] = React.useState<'7d' | '30d' | '90d'>('30d');
  const [selectedShip, setSelectedShip] = React.useState<string | null>(null);

  console.log('[Alerts] Component mounted');

  // Get price alerts from backend
  const alertsQuery = trpc.cruises.priceAlerts.useQuery({
    resolved: selectedFilter === 'resolved' ? true : selectedFilter === 'unresolved' ? false : undefined,
    limit: 50
  });

  // Use local state for manual scanning
  const [isScanning, setIsScanning] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    console.log('[Alerts] Refreshing alerts');
    setRefreshing(true);
    await alertsQuery.refetch();
    setRefreshing(false);
  }, [alertsQuery]);

  const getAlertIcon = (type: AlertType, severity: AlertSeverity) => {
    const color = severity === 'error' ? '#EF4444' : severity === 'warning' ? '#F59E0B' : '#22C55E';
    
    switch (type) {
      case 'price_drop':
        return <TrendingDown size={20} color={color} />;
      case 'threshold_hit':
        return <AlertCircle size={20} color={color} />;
      case 'import_error':
        return <X size={20} color={color} />;
      default:
        return <AlertCircle size={20} color={color} />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleScanNow = async () => {
    console.log('[Alerts] Scan Now pressed - triggering web pricing check');
    setIsScanning(true);
    try {
      // Use trpcClient for direct query call
      const { trpcClient } = await import('@/lib/trpc');
      
      const result = await trpcClient.cruises.webPricing.query({
        forceRefresh: true,
        sources: ['iCruise', 'RoyalPriceTracker', 'CruiseSpotlight']
      });
      
      console.log('[Alerts] Web pricing scan completed:', result.summary);
      
      // Refetch alerts to show new price alerts
      await alertsQuery.refetch();
    } catch (error) {
      console.error('[Alerts] Error during web pricing scan:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleMarkAllRead = async () => {
    console.log('[Alerts] Mark All Read pressed');
    try {
      const { trpcClient } = await import('@/lib/trpc');
      const result = await trpcClient.cruises.markAllAlertsResolved.mutate({});
      
      if (result.success) {
        console.log('[Alerts] Successfully marked all alerts as resolved:', result.message);
        await alertsQuery.refetch();
      } else {
        console.error('[Alerts] Failed to mark alerts as resolved:', result.message);
      }
    } catch (error) {
      console.error('[Alerts] Error marking all alerts as resolved:', error);
    }
  };

  const handleClearFilters = () => {
    console.log('[Alerts] Clear Filters pressed');
    setSelectedFilter('all');
    setSelectedWindow('30d');
    setSelectedShip(null);
  };

  if (alertsQuery.isLoading || isScanning) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>
          {isScanning ? 'Scanning for price changes...' : 'Loading alerts...'}
        </Text>
      </View>
    );
  }

  const alerts = alertsQuery.data?.alerts || [];
  const filteredAlerts = alerts;

  const ships = ['Adventure', 'Allure', 'Anthem', 'Brilliance']; // Mock ship list

  return (
    <>
      <Stack.Screen 
        options={{
          title: "Price Alerts",
          headerBackTitle: "Back"
        }} 
      />
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        testID="alerts-screen"
      >
        {/* Header Actions */}
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={[styles.actionButton, isScanning && styles.actionButtonDisabled]}
            onPress={handleScanNow}
            disabled={isScanning}
            testID="scan-now-button"
          >
            <Text style={styles.actionButtonText}>
              {isScanning ? '⏳ Scanning...' : '🔍 Scan Now'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleMarkAllRead}
            testID="mark-all-read-button"
          >
            <CheckCircle size={16} color="#22C55E" />
            <Text style={styles.actionButtonText}>Mark All Read</Text>
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <View style={styles.filtersSection}>
          {/* Status Filter */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>📊 Status</Text>
            <View style={styles.filterButtons}>
              {[{key: 'all', label: 'All'}, {key: 'unresolved', label: 'Unresolved'}, {key: 'resolved', label: 'Resolved'}].map((status) => (
                <TouchableOpacity
                  key={status.key}
                  style={[
                    styles.filterButton,
                    selectedFilter === status.key && styles.filterButtonActive
                  ]}
                  onPress={() => setSelectedFilter(status.key as 'all' | 'unresolved' | 'resolved')}
                  testID={`status-filter-${status.key}`}
                >
                  <Text style={[
                    styles.filterButtonText,
                    selectedFilter === status.key && styles.filterButtonTextActive
                  ]}>
                    {status.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={handleClearFilters}
              testID="clear-filters-button"
            >
              <Filter size={16} color="#6B7280" />
              <Text style={styles.clearButtonText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>

          {/* Alert Type Filter */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>🔔 Type</Text>
            <View style={styles.filterButtons}>
              {[{key: 'price_drop', label: 'Price Drops'}, {key: 'historical_data', label: 'Historical'}, {key: 'threshold_hit', label: 'Thresholds'}].map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.filterButton,
                    false && styles.filterButtonActive // Placeholder for type filtering
                  ]}
                  onPress={() => {
                    console.log('[Alerts] Type filter pressed:', type.key);
                    // TODO: Implement type filtering
                  }}
                  testID={`type-filter-${type.key}`}
                >
                  <Text style={[
                    styles.filterButtonText,
                    false && styles.filterButtonTextActive
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Alerts Section */}
        <View style={styles.alertsSection}>
          <Text style={styles.sectionTitle}>Price & Combo Alerts</Text>
          
          {filteredAlerts.length > 0 ? (
            filteredAlerts.map((alert) => (
              <TouchableOpacity
                key={alert.id}
                style={styles.alertCard}
                onPress={async () => {
                  console.log(`[Alerts] Tapped alert ${alert.id} for cruise ${alert.cruiseId}`);
                  
                  // Mark alert as resolved when tapped
                  try {
                    const { trpcClient } = await import('@/lib/trpc');
                    await trpcClient.cruises.markAlertResolved.mutate({ alertId: alert.id });
                    await alertsQuery.refetch();
                  } catch (error) {
                    console.error('[Alerts] Error marking alert as resolved:', error);
                  }
                  
                  // TODO: Navigate to cruise details when route is created
                }}
                testID={`alert-${alert.id}`}
              >
                <View style={styles.alertHeader}>
                  {getAlertIcon(alert.type, alert.severity)}
                  <View style={styles.alertContent}>
                    <Text style={styles.alertMessage}>{alert.message}</Text>
                    <Text style={styles.alertDate}>{formatDate(alert.createdAt)}</Text>
                    {alert.source && (
                      <Text style={styles.alertSource}>Source: {alert.source}</Text>
                    )}
                    
                    {/* Price Details */}
                    <View style={styles.priceDetails}>
                      {alert.cabinType && alert.priceChange && (
                        <View style={styles.priceRow}>
                          <Text style={styles.priceLabel}>{alert.cabinType}:</Text>
                          <Text style={[styles.priceValue, { color: alert.priceChange < 0 ? '#22C55E' : '#EF4444' }]}>
                            ${Math.abs(alert.priceChange)} {alert.priceChange < 0 ? 'drop' : 'increase'}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.alertSubtext}>
                        {alert.severity === 'high' ? 'Significant price change' : 'Price change detected'}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <AlertCircle size={48} color="#6B7280" />
              <Text style={styles.emptyTitle}>No alerts found</Text>
              <Text style={styles.alertsCount}>
                Total: {alertsQuery.data?.total || 0} | Unresolved: {alertsQuery.data?.unresolved || 0}
              </Text>
              <Text style={styles.emptyDescription}>
                {selectedFilter === 'resolved' 
                  ? 'No resolved alerts to show'
                  : 'No active alerts at this time. Tap "Scan Now" to check for price changes.'
                }
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B82F6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  filtersSection: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterRow: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  filterButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterButtonActive: {
    backgroundColor: "#6C5CE7",
    borderColor: "#6C5CE7",
  },
  filterButtonText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  filterButtonTextActive: {
    color: "#FFFFFF",
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  clearButtonText: {
    fontSize: 12,
    color: "#6B7280",
  },
  alertsSection: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  alertCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  alertHeader: {
    flexDirection: "row",
    gap: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertMessage: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  alertDate: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  alertBookingId: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
  },
  priceDetails: {
    gap: 4,
    marginTop: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  priceLabel: {
    fontSize: 12,
    color: "#6B7280",
    flex: 1,
  },
  priceValue: {
    fontSize: 12,
    color: "#22C55E",
    fontWeight: "600",
    textAlign: 'right',
  },
  alertSubtext: {
    fontSize: 11,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  emptyDescription: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
  },
  actionButtonDisabled: {
    backgroundColor: "#9CA3AF",
    opacity: 0.6,
  },
  alertSource: {
    fontSize: 11,
    color: "#9CA3AF",
    marginBottom: 4,
  },
  alertsCount: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 8,
    textAlign: "center",
  },
});