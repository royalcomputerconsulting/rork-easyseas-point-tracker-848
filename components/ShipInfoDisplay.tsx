import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getShipInfo } from '@/constants/shipInfo';

interface ShipInfoDisplayProps {
  shipName: string;
  compact?: boolean;
}

export function ShipInfoDisplay({ shipName, compact = false }: ShipInfoDisplayProps) {
  const shipInfo = getShipInfo(shipName);

  if (!shipInfo) {
    return null;
  }

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactItem}>
          <Text style={styles.compactIcon}>🎰</Text>
          <Text style={styles.compactText}>{shipInfo.slotGames} slots</Text>
        </View>
        <View style={styles.compactItem}>
          <Text style={styles.compactIcon}>👤</Text>
          <Text style={styles.compactText}>{shipInfo.casinoHost || 'N/A'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.infoItem}>
          <Text style={styles.label}>Slot Machines</Text>
          <Text style={styles.value}>{shipInfo.slotGames}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.label}>Table Games</Text>
          <Text style={styles.value}>{shipInfo.tableGames}</Text>
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.infoItem}>
          <Text style={styles.label}>Casino Host</Text>
          <Text style={styles.hostValue}>{shipInfo.casinoHost || 'Not Assigned'}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.label}>Ship Class</Text>
          <Text style={styles.value}>{shipInfo.shipClass}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  infoItem: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  hostValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  compactContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  compactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactIcon: {
    fontSize: 14,
  },
  compactText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
});
