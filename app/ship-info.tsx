import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { SHIP_INFO } from '@/constants/shipInfo';

export default function ShipInfoScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Ship & Host Information' }} />
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Royal Caribbean Fleet</Text>
          <Text style={styles.subtitle}>Casino information for all ships</Text>
        </View>

        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, styles.shipColumn]}>Ship</Text>
            <Text style={[styles.headerCell, styles.hostColumn]}>Casino Host</Text>
            <Text style={[styles.headerCell, styles.slotsColumn]}>Slots</Text>
            <Text style={[styles.headerCell, styles.tablesColumn]}>Tables</Text>
            <Text style={[styles.headerCell, styles.classColumn]}>Class</Text>
          </View>

          {SHIP_INFO.map((ship, index) => (
            <View 
              key={ship.shipName} 
              style={[
                styles.tableRow,
                index % 2 === 0 ? styles.evenRow : styles.oddRow
              ]}
            >
              <Text style={[styles.cell, styles.shipColumn, styles.shipName]}>
                {ship.shipName}
              </Text>
              <Text style={[styles.cell, styles.hostColumn, styles.hostName]}>
                {ship.casinoHost || 'N/A'}
              </Text>
              <Text style={[styles.cell, styles.slotsColumn, styles.numberValue]}>
                {ship.slotGames || '-'}
              </Text>
              <Text style={[styles.cell, styles.tablesColumn, styles.numberValue]}>
                {ship.tableGames || '-'}
              </Text>
              <Text style={[styles.cell, styles.classColumn, styles.className]}>
                {ship.shipClass}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Total Ships: {SHIP_INFO.length}
          </Text>
          <Text style={styles.footerNote}>
            Data includes slot machines, table games, and current casino host assignments
          </Text>
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
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  tableContainer: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#D1D5DB',
  },
  headerCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  evenRow: {
    backgroundColor: '#FFFFFF',
  },
  oddRow: {
    backgroundColor: '#F9FAFB',
  },
  cell: {
    fontSize: 13,
    color: '#111827',
  },
  shipColumn: {
    flex: 2,
  },
  hostColumn: {
    flex: 2,
  },
  slotsColumn: {
    flex: 1,
    textAlign: 'center',
  },
  tablesColumn: {
    flex: 1,
    textAlign: 'center',
  },
  classColumn: {
    flex: 1.5,
  },
  shipName: {
    fontWeight: '600',
    color: '#1F2937',
  },
  hostName: {
    color: '#3B82F6',
    fontWeight: '500',
  },
  numberValue: {
    fontWeight: '600',
    color: '#059669',
  },
  className: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  footerNote: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});
