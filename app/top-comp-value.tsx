import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ship } from 'lucide-react-native';

interface CruiseData {
  ship: string;
  date: string;
  nights: number;
  value: number;
}

export default function TopCompValueScreen() {
  const topCruises: CruiseData[] = [
    { ship: "Ovation Of The Seas", date: "2025-08-16", nights: 5, value: 637 },
    { ship: "Adventure Of The Seas", date: "2025-10-02", nights: 6, value: 2 },
    { ship: "Adventure Of The Seas", date: "2025-10-04", nights: 6, value: 2 },
    { ship: "Adventure Of The Seas", date: "2025-10-16", nights: 6, value: 2 },
    { ship: "Adventure Of The Seas", date: "2025-10-20", nights: 6, value: 2 },
    { ship: "Adventure Of The Seas", date: "2025-10-30", nights: 6, value: 2 },
    { ship: "Allure Of The Seas", date: "2025-03-08", nights: 6, value: 2 },
    { ship: "Allure Of The Seas", date: "2025-12-07", nights: 6, value: 2 },
    { ship: "Enchantment Of The Seas", date: "2025-10-04", nights: 5, value: 2 },
    { ship: "Enchantment Of The Seas", date: "2025-10-18", nights: 5, value: 2 },
  ];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <>
      <Stack.Screen 
        options={{
          title: "$2 • 25OCT106",
          headerBackTitle: "Back"
        }} 
      />
      <ScrollView style={styles.container} testID="top-comp-value-screen">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Top 10 Estimated Comp Value Cruises</Text>
        </View>

        {/* Cruises List */}
        <View style={styles.cruisesList}>
          {topCruises.map((cruise, index) => (
            <TouchableOpacity
              key={index}
              style={styles.cruiseItem}
              onPress={() => {
                console.log(`[TopCompValue] Tapped cruise: ${cruise.ship} on ${cruise.date}`);
              }}
              testID={`cruise-item-${index}`}
            >
              <View style={styles.cruiseInfo}>
                <Text style={styles.cruiseName}>{cruise.ship}</Text>
                <Text style={styles.cruiseDetails}>
                  {formatDate(cruise.date)} • {cruise.nights}n
                </Text>
              </View>
              <Text style={styles.cruiseValue}>${cruise.value}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Top Free Play Offers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Free Play Offers</Text>
          <View style={styles.offerCard}>
            <Text style={styles.offerName}>Odds on October</Text>
            <Text style={styles.offerValue}>$2</Text>
          </View>
        </View>

        {/* Per-ship Averages */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Per-ship Averages</Text>
          <View style={styles.shipCard}>
            <View style={styles.shipHeader}>
              <Ship size={20} color="#3B82F6" />
              <Text style={styles.shipName}>Ovation Of The Seas</Text>
              <Text style={styles.shipValue}>$364</Text>
            </View>
            <Text style={styles.calculationNote}>
              Calculation: For each ship, take the minimum available fare across Interior/Oceanview/Balcony/Suite per sailing, then average across that ship&apos;s sailings.
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
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  cruisesList: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  cruiseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cruiseInfo: {
    flex: 1,
  },
  cruiseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  cruiseDetails: {
    fontSize: 14,
    color: '#6B7280',
  },
  cruiseValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
  },
  section: {
    margin: 16,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  offerCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  offerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  offerValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
  },
  shipCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  shipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  shipName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  shipValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
  },
  calculationNote: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
    fontStyle: 'italic',
  },
});