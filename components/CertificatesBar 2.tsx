import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Award, AlertTriangle } from 'lucide-react-native';
import { useFinancials } from '@/state/FinancialsProvider';
import { router } from 'expo-router';
import { useAppState } from '@/state/AppStateProvider';

export interface CertificatesBarProps {
  cruiseId?: string;
  testID?: string;
}

export default function CertificatesBar({ cruiseId, testID }: CertificatesBarProps) {
  const { certificates, statements } = useFinancials();
  const { localData } = useAppState();

  const linked = React.useMemo(() => {
    return certificates.filter(c => (cruiseId ? (c.cruiseId === cruiseId || c.redeemedOnCruiseId === cruiseId || c.linkedCruiseId === cruiseId) : true));
  }, [certificates, cruiseId]);

  const cruise = React.useMemo(() => {
    if (!cruiseId || !localData?.cruises) return null;
    return localData.cruises.find((c: any) => String(c.id) === String(cruiseId));
  }, [cruiseId, localData]);

  const casinoComp = React.useMemo(() => {
    if (!cruise) return 0;
    const roomPrice = (cruise as any).balconyPrice || (cruise as any).oceanviewPrice || (cruise as any).interiorPrice || 0;
    const taxes = (cruise as any).portTaxesFees || (cruise as any).taxesFees || 0;
    return (roomPrice * 2) + taxes;
  }, [cruise]);

  const freePlay = React.useMemo(() => {
    if (!cruise) return 0;
    return (cruise as any).freePlay || 0;
  }, [cruise]);

  const casinoCharges = React.useMemo(() => {
    if (!cruiseId) return 0;
    const statement = statements.find(s => String(s.cruiseId) === String(cruiseId));
    if (!statement) return 0;
    return statement.clubRoyaleCoinIn || 0;
  }, [cruiseId, statements]);

  const totalValue = linked.reduce((s, c) => s + (c.valueUSD || 0), 0);
  const expiringSoonCount = React.useMemo(() => {
    const now = Date.now();
    const soon = now + 1000 * 60 * 60 * 24 * 45;
    return linked.filter(c => !c.isUsed && c.expiresOn && new Date(c.expiresOn).getTime() <= soon).length;
  }, [linked]);

  return (
    <View style={styles.card} testID={testID ?? 'certificates-bar'}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Award size={16} color="#10B981" />
        </View>
        <Text style={styles.title}>Casino & Certificates</Text>
        <View style={styles.spacer} />
        <Text style={styles.chip}>${totalValue.toLocaleString()}</Text>
      </View>
      {cruiseId && (
        <View style={styles.casinoSection}>
          <View style={styles.casinoRow}>
            <View style={styles.casinoItem}>
              <Text style={styles.casinoLabel}>Casino Comp</Text>
              <Text style={styles.casinoValue} testID="casino-comp-value">${casinoComp.toLocaleString()}</Text>
            </View>
            <View style={styles.casinoItem}>
              <Text style={styles.casinoLabel}>FreePlay</Text>
              <Text style={styles.casinoValue} testID="freeplay-value">${freePlay.toLocaleString()}</Text>
            </View>
            <View style={styles.casinoItem}>
              <Text style={styles.casinoLabel}>Casino Charges</Text>
              <Text style={styles.casinoValue} testID="casino-charges-value">${casinoCharges.toLocaleString()}</Text>
            </View>
          </View>
        </View>
      )}
      {expiringSoonCount > 0 && (
        <View style={styles.warningRow} testID="expiring-soon-banner">
          <AlertTriangle size={14} color="#B45309" />
          <Text style={styles.warningText}>{expiringSoonCount} expiring soon</Text>
        </View>
      )}
      <View style={styles.row}>
        {linked.length === 0 ? (
          <Text style={styles.empty}>No certificates linked.</Text>
        ) : (
          <View style={styles.badges}>
            {linked.map((c) => (
              <View key={c.id} style={styles.badge}>
                <Text style={styles.badgeText}>{c.type}</Text>
                <Text style={styles.badgeValue}>${c.valueUSD.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={styles.footer}>
        <TouchableOpacity onPress={() => { console.log('[CertificatesBar] manage pressed'); router.push('/certificates'); }} style={styles.manageBtn} testID="manage-certificates-btn">
          <Text style={styles.manageText}>Manage</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  spacer: { flex: 1 },
  chip: {
    backgroundColor: '#10B9811A',
    color: '#065F46',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    overflow: 'hidden',
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  warningText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
  },
  row: {},
  empty: {
    fontSize: 12,
    color: '#6B7280',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 10,
    color: '#374151',
    fontWeight: '700',
  },
  badgeValue: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '700',
  },
  footer: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  manageBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#111827',
    borderRadius: 8,
  },
  manageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  casinoSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  casinoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  casinoItem: {
    flex: 1,
    alignItems: 'center',
  },
  casinoLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  casinoValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '700',
    textAlign: 'center',
  },
});
