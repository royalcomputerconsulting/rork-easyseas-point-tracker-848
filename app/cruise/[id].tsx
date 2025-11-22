import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
  Modal,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { router, useLocalSearchParams, Stack } from 'expo-router';
import { 
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  Anchor,
  Globe,
  DollarSign,
  Edit3,
  Save,
  X,
  Upload,
  FileText,
  Receipt,
  Award,
  Brain,
  Sparkles,
  AlertTriangle
} from 'lucide-react-native';
import { CruiseUnifiedCard } from '@/components/CruiseUnifiedCard';
import { detectAndMapUnified } from '@/lib/unifiedCruise';
import { trpc, trpcClient, isBackendEnabled } from '@/lib/trpc';
import { useAppState } from '@/state/AppStateProvider';
import { formatDateForDisplay, createDateFromString } from '@/lib/date';
import { STATIC_BOOKED_CRUISES } from '@/state/staticBooked';
import { FINANCIAL_SAMPLE_DATA } from '@/constants/financials';
import { useCruiseStore } from '@/state/CruiseStore';
import { useSimpleAnalytics, type SimpleCruise, calculateCruiseROI, calculateValuePerPoint, calculateCoinIn, calculateActualCostPerPoint, calculateActualCoinIn, calculateNetProfit } from '@/state/SimpleAnalyticsProvider';
import { useCelebrity } from '@/state/CelebrityProvider';
import CasinoMetrics from '@/components/CasinoMetrics';
import CertificatesBar from '@/components/CertificatesBar';
import { Badge } from '@/components/ui/Badge';
import { useCruiseEstimator } from '@/lib/cruise-estimator';
import { useConfidence } from '@/state/FinancialsProvider';
import { onFveUpdated } from '@/lib/fveEvents';

function SimpleCruiseDetail({ cruise }: { cruise: SimpleCruise }) {
  const analytics = useSimpleAnalytics();
  const roi = calculateCruiseROI(cruise);
  const valuePerPoint = calculateValuePerPoint(cruise);
  const coinIn = calculateCoinIn(cruise);
  const actualCostPerPoint = calculateActualCostPerPoint(cruise);
  const actualCoinIn = calculateActualCoinIn(cruise);
  const netProfit = calculateNetProfit(cruise);
  const conf = useConfidence(String(cruise.id));
  const [isInlineEditing, setIsInlineEditing] = React.useState<boolean>(false);
  const [editPoints, setEditPoints] = React.useState<string>(String(cruise.pointsEarned ?? 0));
  const [editWinnings, setEditWinnings] = React.useState<string>(String(cruise.winnings ?? 0));
  const [editAmountPaid, setEditAmountPaid] = React.useState<string>(String(cruise.amountPaid ?? 0));
  const [editTaxesFees, setEditTaxesFees] = React.useState<string>(String(cruise.taxesFees ?? 0));
  const [editCasinoComp, setEditCasinoComp] = React.useState<string>(String(cruise.casinoComp ?? 0));
  const [editFreePlay, setEditFreePlay] = React.useState<string>(String(cruise.freePlay ?? 0));

  React.useEffect(() => {
    setEditPoints(String(cruise.pointsEarned ?? 0));
    setEditWinnings(String(cruise.winnings ?? 0));
    setEditAmountPaid(String(cruise.amountPaid ?? 0));
    setEditTaxesFees(String(cruise.taxesFees ?? 0));
    setEditCasinoComp(String(cruise.casinoComp ?? 0));
    setEditFreePlay(String(cruise.freePlay ?? 0));
  }, [cruise.pointsEarned, cruise.winnings, cruise.amountPaid, cruise.taxesFees, cruise.casinoComp, cruise.freePlay]);

  const saveInline = React.useCallback(async () => {
    const pts = Math.max(0, parseInt(editPoints.replace(/[^0-9]/g, ''), 10) || 0);
    const win = parseFloat(editWinnings.replace(/[^0-9.-]/g, ''));
    const safeWin = Number.isFinite(win) ? Math.round(win) : 0;
    const amtPaid = Math.max(0, parseInt(editAmountPaid.replace(/[^0-9]/g, ''), 10) || 0);
    const taxes = Math.max(0, parseInt(editTaxesFees.replace(/[^0-9]/g, ''), 10) || 0);
    const comp = Math.max(0, parseInt(editCasinoComp.replace(/[^0-9]/g, ''), 10) || 0);
    const free = Math.max(0, parseInt(editFreePlay.replace(/[^0-9]/g, ''), 10) || 0);
    console.log('[SimpleCruiseDetail] Inline save', { id: cruise.id, pts, safeWin, amtPaid, taxes, comp, free });
    if (analytics.updateCruise) {
      await analytics.updateCruise(cruise.id, { 
        pointsEarned: pts, 
        winnings: safeWin,
        amountPaid: amtPaid,
        taxesFees: taxes,
        casinoComp: comp,
        freePlay: free
      });
      setIsInlineEditing(false);
    }
  }, [analytics.updateCruise, cruise.id, editPoints, editWinnings, editAmountPaid, editTaxesFees, editCasinoComp, editFreePlay]);

  const breakdown = React.useMemo(() => {
    const spend = Math.max(cruise.onboardSpend ?? 0, 0);
    const taxes = Math.max(cruise.taxesFees ?? 0, 0);
    const categories = [
      { key: 'casino', label: 'Casino Charges', color: '#FDE68A', pct: 0.35 },
      { key: 'dining', label: 'Dining', color: '#BFDBFE', pct: 0.25 },
      { key: 'drinks', label: 'Drinks', color: '#C7D2FE', pct: 0.2 },
      { key: 'wifi', label: 'Wi‑Fi & Services', color: '#FBCFE8', pct: 0.1 },
      { key: 'other', label: 'Other', color: '#E9D5FF', pct: 0.1 },
    ];
    const items = categories.map((c, i) => ({
      key: c.key,
      label: c.label,
      color: c.color,
      amount: i === categories.length - 1
        ? Math.max(spend - categories.slice(0, -1).reduce((s, k) => s + Math.round(spend * k.pct), 0), 0)
        : Math.round(spend * c.pct),
    }));
    const total = items.reduce((s, it) => s + it.amount, 0) + taxes;
    return { items, total, taxes };
  }, [cruise.onboardSpend, cruise.taxesFees]);

  const risk = React.useMemo(() => {
    const stopLoss = (cruise.nights || 0) * 200;
    const grossOut = (cruise.amountPaid || 0) + (cruise.onboardSpend || 0) + (cruise.taxesFees || 0);
    const net = (cruise.winnings || 0) - grossOut;
    const actualRisk = Math.max(Math.min(grossOut, stopLoss), 0);
    const label = net >= 0 ? 'Profit' : 'Loss';
    return { stopLoss, grossOut, net, actualRisk, label };
  }, [cruise.nights, cruise.amountPaid, cruise.onboardSpend, cruise.taxesFees, cruise.winnings]);

  const { estimateCruise } = useCruiseEstimator();
  const expected = React.useMemo(() => estimateCruise({ nights: cruise.nights ?? 1, ship: cruise.ship }), [cruise.nights, cruise.ship, estimateCruise]);

  return (
    <>
      <Stack.Screen 
        options={{
          title: '',
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <ArrowLeft size={24} color="#111827" />
            </TouchableOpacity>
          ),
        }} 
      />
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }} testID="simple-cruise-detail">
        <View style={{ backgroundColor: '#FFFFFF', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#3B82F6', marginBottom: 4 }}>{cruise.ship}</Text>
          <Text style={{ fontSize: 14, color: '#6B7280' }}>
            {new Date(cruise.sailDate).toLocaleDateString()} - {new Date(cruise.endDate).toLocaleDateString()} • {cruise.nights} nights
          </Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={{ color: '#6B7280', marginBottom: 8 }}>STEP 2.2B: Rendering Club Royale breakdown...</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
            <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
              <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>ROI</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: roi >= 0 ? '#16A34A' : '#DC2626' }}>{roi.toFixed(0)}%</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
              <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>Value</Text>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>${(cruise.retailPrice + cruise.casinoComp + cruise.freePlay + cruise.winnings).toLocaleString()}</Text>
            </View>
          </View>

          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Financials</Text>
              {!isInlineEditing && (
                <TouchableOpacity onPress={() => setIsInlineEditing(true)} style={{ backgroundColor: '#3B82F6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12 }}>
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Amount Paid</Text>
                {isInlineEditing ? (
                  <TextInput
                    value={editAmountPaid}
                    onChangeText={(t: string) => setEditAmountPaid(t.replace(/[^0-9]/g, '').slice(0, 8))}
                    keyboardType="numeric"
                    style={{ fontSize: 16, fontWeight: '700', backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 6 }}
                    placeholder="0"
                    testID="simple-edit-amount-paid"
                  />
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: '700' }}>${cruise.amountPaid.toLocaleString()}</Text>
                )}
              </View>
              <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12 }}>
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Taxes & Fees</Text>
                {isInlineEditing ? (
                  <TextInput
                    value={editTaxesFees}
                    onChangeText={(t: string) => setEditTaxesFees(t.replace(/[^0-9]/g, '').slice(0, 8))}
                    keyboardType="numeric"
                    style={{ fontSize: 16, fontWeight: '700', backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 6 }}
                    placeholder="0"
                    testID="simple-edit-taxes-fees"
                  />
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: '700' }}>${cruise.taxesFees.toLocaleString()}</Text>
                )}
              </View>
              <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12 }}>
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Casino Comp</Text>
                {isInlineEditing ? (
                  <TextInput
                    value={editCasinoComp}
                    onChangeText={(t: string) => setEditCasinoComp(t.replace(/[^0-9]/g, '').slice(0, 8))}
                    keyboardType="numeric"
                    style={{ fontSize: 16, fontWeight: '700', backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 6 }}
                    placeholder="0"
                    testID="simple-edit-casino-comp"
                  />
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: '700' }}>${cruise.casinoComp.toLocaleString()}</Text>
                )}
              </View>
              <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12 }}>
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>FreePlay</Text>
                {isInlineEditing ? (
                  <TextInput
                    value={editFreePlay}
                    onChangeText={(t: string) => setEditFreePlay(t.replace(/[^0-9]/g, '').slice(0, 8))}
                    keyboardType="numeric"
                    style={{ fontSize: 16, fontWeight: '700', backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 6 }}
                    placeholder="0"
                    testID="simple-edit-freeplay"
                  />
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: '700' }}>${cruise.freePlay.toLocaleString()}</Text>
                )}
              </View>
            </View>
          </View>

          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16 }} testID="expected-vs-actual">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Brain size={18} color="#3B82F6" />
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Expected vs Actual</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 12, color: '#6B7280' }}>Expected Points</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#3B82F6' }}>{expected.expectedPoints.toLocaleString()}</Text>
                <Text style={{ fontSize: 11, color: '#6B7280' }}>Model: {expected.confidence}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 12, color: '#6B7280' }}>Actual Points</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827' }}>{cruise.pointsEarned.toLocaleString()}</Text>
                <Text style={{ fontSize: 11, color: '#6B7280' }}>{expected.notes[0] ?? ''}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <View>
                <Text style={{ fontSize: 12, color: '#6B7280' }}>Data Confidence</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }} testID="data-confidence-pct">{Math.round((conf?.confidence ?? 0) * 100)}%</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 12, color: '#6B7280' }}>Smoothed Points</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }} testID="smoothed-points">{Math.round(conf?.smoothedPoints ?? 0).toLocaleString()}</Text>
              </View>
            </View>
          </View>

          <CasinoMetrics
            coinIn={coinIn}
            points={cruise.pointsEarned}
            valuePerPoint={valuePerPoint}
            netResult={netProfit}
            actualCostPerPoint={actualCostPerPoint}
            actualCoinIn={actualCoinIn}
            testID="casino-metrics"
          />

          <CertificatesBar cruiseId={String(cruise.id)} testID="certificates-bar" />

          {false && (
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16 }} testID="club-royale-breakdown">
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 }}>Club Royale Charges Breakdown</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              {breakdown.items.map((it) => (
                <View key={it.key} style={{ flex: it.amount, height: 10, backgroundColor: it.color, borderRadius: 4 }} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {breakdown.items.map((it) => (
                <View key={`${it.key}-legend`} style={{ flexBasis: '48%', backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: it.color }} />
                    <Text style={{ fontSize: 12, color: '#6B7280' }}>{it.label}</Text>
                    <Text style={{ marginLeft: 'auto', fontSize: 14, fontWeight: '700', color: '#111827' }}>${it.amount.toLocaleString()}</Text>
                  </View>
                </View>
              ))}
              <View style={{ flexBasis: '100%', backgroundColor: '#FFF7ED', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#FDBA74' }}>
                <Text style={{ fontSize: 12, color: '#9A3412' }}>Taxes & Fees</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#9A3412' }}>${breakdown.taxes.toLocaleString()}</Text>
              </View>
            </View>
          </View>
          )}

          <Text style={{ color: '#6B7280', marginBottom: 8 }}>STEP 2.2C: Rendering winnings vs losses & risk...</Text>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16 }} testID="risk-analysis">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Financial Summary</Text>
              {isInlineEditing ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={saveInline} style={{ backgroundColor: '#16A34A', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 }} testID="simple-inline-save">
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { 
                  setEditPoints(String(cruise.pointsEarned ?? 0)); 
                  setEditWinnings(String(cruise.winnings ?? 0));
                  setEditAmountPaid(String(cruise.amountPaid ?? 0));
                  setEditTaxesFees(String(cruise.taxesFees ?? 0));
                  setEditCasinoComp(String(cruise.casinoComp ?? 0));
                  setEditFreePlay(String(cruise.freePlay ?? 0));
                  setIsInlineEditing(false); 
                }} style={{ backgroundColor: '#6B7280', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 }} testID="simple-inline-cancel">
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setIsInlineEditing(true)} style={{ backgroundColor: '#3B82F6', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 }} testID="simple-inline-edit">
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>Quick Edit</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <View style={{ flex: 1, backgroundColor: '#ECFDF5', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#22C55E' }}>
                <Text style={{ fontSize: 12, color: '#16A34A' }}>Winnings</Text>
                {isInlineEditing ? (
                  <TextInput
                    value={editWinnings}
                    onChangeText={(t: string) => setEditWinnings(t.replace(/[^0-9.-]/g, '').slice(0, 8))}
                    keyboardType="numeric"
                    style={{ fontSize: 18, fontWeight: '800', color: '#16A34A', backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 6 }}
                    placeholder="0"
                    testID="simple-edit-winnings"
                  />
                ) : (
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#16A34A' }}>${(cruise.winnings || 0).toLocaleString()}</Text>
                )}
              </View>
              <View style={{ flex: 1, backgroundColor: netProfit >= 0 ? '#ECFDF5' : '#FEF2F2', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: netProfit >= 0 ? '#22C55E' : '#FCA5A5' }}>
                <Text style={{ fontSize: 12, color: netProfit >= 0 ? '#16A34A' : '#DC2626', fontWeight: '700' }}>{netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS'}</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: netProfit >= 0 ? '#16A34A' : '#DC2626' }}>${Math.abs(netProfit).toLocaleString()}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <View style={{ flex: 1, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#BFDBFE' }}>
                <Text style={{ fontSize: 12, color: '#1D4ED8' }}>Points Earned</Text>
                {isInlineEditing ? (
                  <TextInput
                    value={editPoints}
                    onChangeText={(t: string) => setEditPoints(t.replace(/[^0-9]/g, '').slice(0, 6))}
                    keyboardType="numeric"
                    style={{ fontSize: 18, fontWeight: '800', color: '#1D4ED8', backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 6 }}
                    placeholder="0"
                    testID="simple-edit-points"
                  />
                ) : (
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#1D4ED8' }}>{(cruise.pointsEarned || 0).toLocaleString()} pts</Text>
                )}
              </View>
              <View style={{ flex: 1 }} />
            </View>

            <View style={{ height: 12, backgroundColor: '#F3F4F6', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
              <View style={{ width: `${Math.min(100, (risk.actualRisk / Math.max(risk.stopLoss, 1)) * 100)}%`, backgroundColor: '#3B82F6', height: 12 }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: '#6B7280' }}>Actual Risk: ${risk.actualRisk.toLocaleString()}</Text>
              <Text style={{ fontSize: 12, color: '#6B7280' }}>Stop-Loss Cap: ${risk.stopLoss.toLocaleString()}</Text>
            </View>
            <View style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>Cruise Costs: <Text style={{ color: '#6B7280' }}>${((cruise.amountPaid || 0) + (cruise.taxesFees || 0)).toLocaleString()}</Text></Text>
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Coin-in estimated: ${coinIn.toLocaleString()} • Value/pt: ${valuePerPoint.toFixed(2)}</Text>
              <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Note: Net profit = Winnings - Cruise costs</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

export default function CruiseDetailScreen() {
  const { id, bookedData } = useLocalSearchParams<{ id: string; bookedData?: string }>();
  const { localData, hasLocalData, updateCruise, unbookCruise } = useAppState();
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  const [isEditing, setIsEditing] = React.useState<boolean>(false);
  const [editedCruise, setEditedCruise] = React.useState<any>(null);
  const [scrapingStatus, setScrapingStatus] = React.useState<string>('');
  const [webPricing, setWebPricing] = React.useState<{ interior: number; oceanview: number; balcony: number; suite: number } | null>(null);
  const [webPricingMeta, setWebPricingMeta] = React.useState<{ fetchedAt: string | null; source: string | null }>({ fetchedAt: null, source: null });
  const [fveUpdate, setFveUpdate] = React.useState<{ total: number; roi: number } | null>(null);
  const [itineraryUpdatedAt, setItineraryUpdatedAt] = React.useState<string | null>(null);
  const [showConfirm, setShowConfirm] = React.useState<boolean>(false);
  const [pendingFetch, setPendingFetch] = React.useState<{ ship: string; depDate: string } | null>(null);
  const [uploadingReceipts, setUploadingReceipts] = React.useState<boolean>(false);
  const [uploadingStatements, setUploadingStatements] = React.useState<boolean>(false);
  const [aiNarrative, setAiNarrative] = React.useState<string | null>(null);
  const [isGeneratingNarrative, setIsGeneratingNarrative] = React.useState<boolean>(false);
  const [narrativeError, setNarrativeError] = React.useState<string | null>(null);
  
  // Unified edit state for all sections
  const [isEditMode, setIsEditMode] = React.useState<boolean>(false);
  const [editWinLoss, setEditWinLoss] = React.useState<string>('0');
  const [editPointsEarned, setEditPointsEarned] = React.useState<string>('0');
  const [editAmountPaid, setEditAmountPaid] = React.useState<string>('0');
  const [editTaxesFees, setEditTaxesFees] = React.useState<string>('0');
  const [editCasinoComp, setEditCasinoComp] = React.useState<string>('0');
  const [editFreePlay, setEditFreePlay] = React.useState<string>('0');
  const [editItinerary, setEditItinerary] = React.useState<string>('');
  const [editInteriorPrice, setEditInteriorPrice] = React.useState<string>('0');
  const [editOceanviewPrice, setEditOceanviewPrice] = React.useState<string>('0');
  const [editBalconyPrice, setEditBalconyPrice] = React.useState<string>('0');
  const [editSuitePrice, setEditSuitePrice] = React.useState<string>('0');
  const [editPortTaxes, setEditPortTaxes] = React.useState<string>('0');
  const [editPortsAndTimes, setEditPortsAndTimes] = React.useState<string>('');
  const fveLinkQuery = trpc.fve.getLink.useQuery({ cruiseId: String(id ?? '') }, { enabled: Boolean(id) });

  const aiNarrativeMutation = trpc.analytics.cruiseNarrative.useMutation();
  const { cruises: storedCruises } = useCruiseStore();
  const celebrity = useCelebrity();

  const handleGenerateNarrative = React.useCallback(async () => {
    const cruiseId = id ? String(id) : undefined;
    if (!cruiseId) {
      Alert.alert('Error', 'Cruise ID is missing');
      return;
    }
    try {
      setIsGeneratingNarrative(true);
      setNarrativeError(null);
      const res = await aiNarrativeMutation.mutateAsync({ cruiseId });
      setAiNarrative(res.narrative ?? null);
    } catch (e: any) {
      console.error('[CruiseDetail] AI narrative error:', e);
      setNarrativeError(e?.message ?? 'Failed to generate narrative');
      Alert.alert('AI Error', e?.message ?? 'Failed to generate narrative');
    } finally {
      setIsGeneratingNarrative(false);
    }
  }, [id, aiNarrativeMutation]);
  
  // Parse booked cruise data if provided
  const parsedBookedData = React.useMemo(() => {
    if (bookedData) {
      try {
        return JSON.parse(bookedData);
      } catch (error) {
        console.error('[CruiseDetail] Failed to parse booked data:', error);
        return null;
      }
    }
    return null;
  }, [bookedData]);
  
  console.log('[CruiseDetail] Loading cruise:', id);

  React.useEffect(() => {
    const off = onFveUpdated((p) => {
      if (String(p.cruiseId) === String(id)) {
        console.log('[CruiseDetail] Received FVE update', p);
        setFveUpdate({ total: p.fveTotalUsd, roi: p.roi });
        setTimeout(() => setFveUpdate(null), 6000);
      }
    });
    return off;
  }, [id]);

  const simpleAnalytics = useSimpleAnalytics();
  const simpleCruise: SimpleCruise | undefined = React.useMemo(() => {
    if (!id) return undefined;
    return simpleAnalytics.cruises.find(c => String(c.id) === String(id));
  }, [simpleAnalytics.cruises, id]);

  // Reserved for booked-state checks (moved below after cruise is resolved)

  // Check if this is a Celebrity cruise - they are handled client-side only
  const isCelebrityCruise = id && String(id).startsWith('celeb-cruise-');
  
  // Data queries and mutations must be declared unconditionally to keep hooks order stable
  const cruiseQuery = trpc.cruises.get.useQuery(
    { id: id! },
    {
      enabled: !!id && !hasLocalData && !parsedBookedData && !simpleCruise && !isCelebrityCruise,
      retry: 1,
    }
  );

  const expectedAnalyticsQuery = trpc.cruises.getExpectedAnalytics.useQuery(
    { cruiseId: id! },
    {
      enabled: false,
      retry: 1,
    }
  );

  const userProfileQuery = trpc.analytics.getUserProfile.useQuery(undefined, { enabled: false });

  const receiptsQuery = trpc.analytics.getReceiptAnalytics.useQuery(undefined, {
    enabled: false,
  });

  const statementsQuery = trpc.analytics.getClubRoyaleAnalytics.useQuery(undefined, {
    enabled: false,
  });

  const historicalAnalyticsQuery = trpc.analytics.getHistoricalAnalytics.useQuery(
    { ship: undefined },
    {
      enabled: false,
      retry: 1,
    }
  );

  const updateCruiseMutation = trpc.cruises.update.useMutation({
    onSuccess: (data) => {
      console.log('[CruiseDetail] Cruise updated successfully:', data);
      if (data.cruise) Object.assign(cruise, data.cruise);
      cruiseQuery.refetch();
    },
    onError: (error) => {
      console.error('[CruiseDetail] Failed to update cruise:', error);
      Alert.alert('Error', `Failed to update cruise: ${error.message}`);
    },
  });

  const updateFinancialsMutation = trpc.cruises.updateFinancialData.useMutation({
    onSuccess: () => {
      console.log('[CruiseDetail] Financial data updated successfully');
      setIsEditing(false);
      expectedAnalyticsQuery.refetch();
      statementsQuery.refetch();
      receiptsQuery.refetch();
      Alert.alert('Success', 'Cruise information updated successfully!');
    },
    onError: (error) => {
      console.error('[CruiseDetail] Failed to update financial data:', error);
      Alert.alert('Error', `Failed to update financial data: ${error.message}`);
    },
  });

  const receiptUploadMutation = trpc.ocr.receipt.useMutation({
    onSuccess: (data) => {
      console.log('[CruiseDetail] Receipt uploaded successfully:', data);
      setUploadingReceipts(false);
      receiptsQuery.refetch();
      Alert.alert('Success', 'Receipt processed successfully! The extracted data has been saved.');
    },
    onError: (error) => {
      console.error('[CruiseDetail] Receipt upload failed:', error);
      setUploadingReceipts(false);
      Alert.alert('Error', `Failed to process receipt: ${error.message}`);
    },
  });

  const statementUploadMutation = trpc.ocr.cruiseStatement.useMutation({
    onSuccess: (data) => {
      console.log('[CruiseDetail] Cruise statement uploaded successfully:', data);
      setUploadingStatements(false);
      statementsQuery.refetch();
      Alert.alert('Success', `Successfully processed ${data.processedCount} cruise statement(s)! The extracted data has been saved.`);
    },
    onError: (error) => {
      console.error('[CruiseDetail] Cruise statement upload failed:', error);
      setUploadingStatements(false);
      Alert.alert('Error', `Failed to process cruise statement: ${error.message}`);
    },
  });

  const scrapeMutation = trpc.cruises.scrapeSingle.useMutation({
    onSuccess: (data) => {
      console.log('[CruiseDetail] Scraping successful:', data);
      setScrapingStatus('REFRESH AND GO BACK');

      setTimeout(() => {
        setIsRefreshing(false);
        setScrapingStatus('');

        if (data.success && data.result?.updated) {
          Alert.alert(
            'DATA FOUND - POPULATING COMPLETE! ✅',
            data.result?.message ||
              `Successfully updated cruise information with current pricing and itinerary from web sources. The page will refresh to show the latest data.`,
            [
              {
                text: 'REFRESH AND GO BACK',
                onPress: () => {
                  cruiseQuery.refetch();
                  expectedAnalyticsQuery.refetch();
                  historicalAnalyticsQuery.refetch();
                  receiptsQuery.refetch();
                  statementsQuery.refetch();
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'DATA NOT FOUND',
            data.result?.message || data.error || 'No new data was found from web sources.',
            [{ text: 'OK' }]
          );
        }
      }, 1000);
    },
    onError: (error) => {
      console.error('[CruiseDetail] Scraping error:', error);
      setScrapingStatus('DATA NOT FOUND');

      setTimeout(() => {
        setIsRefreshing(false);
        setScrapingStatus('');
        Alert.alert('Update Failed', `Failed to get current data from the web: ${error.message}`, [{ text: 'OK' }]);
      }, 1000);
    },
  });

  const fetchWebPricingMutation = trpc.cruises.fetchWebPricing.useMutation();

  // Try to find cruise in local data first, then static data, hardcoded financials, or use booked data
  let cruise: any = null;
  if (parsedBookedData) {
    cruise = parsedBookedData;
    console.log('[CruiseDetail] Using booked cruise data:', !!cruise);
  } else {
    // Combine local data and static data for searching
    const allCruises: any[] = [];
    
    if (hasLocalData && localData.cruises) {
      allCruises.push(...localData.cruises);
      console.log('[CruiseDetail] Added local cruises to search:', localData.cruises.length);
    }
    if (Array.isArray(storedCruises) && storedCruises.length > 0) {
      allCruises.push(...storedCruises);
      console.log('[CruiseDetail] Added CruiseStore cruises to search:', storedCruises.length);
    }
    try {
      const celebCruises = Array.isArray(celebrity?.cruises) ? celebrity.cruises : [];
      const celebBooked = Array.isArray(celebrity?.bookedCruises) ? celebrity.bookedCruises : [];
      const totalCeleb = celebCruises.length + celebBooked.length;
      if (totalCeleb > 0) {
        allCruises.push(...celebCruises, ...celebBooked);
        console.log('[CruiseDetail] Added Celebrity cruises to search:', totalCeleb);
      }
    } catch (e) {
      console.log('[CruiseDetail] Celebrity provider not available or empty');
    }
    
    // Always include static booked cruises as they represent real bookings
    allCruises.push(...STATIC_BOOKED_CRUISES);
    console.log('[CruiseDetail] Added static booked cruises to search:', STATIC_BOOKED_CRUISES.length);

    // Include hardcoded financials cruises (reservationId treated as the canonical ID)
    const mappedFinancialCruises = (FINANCIAL_SAMPLE_DATA?.cruises ?? []).map((r) => ({
      id: r.reservationId,
      reservationId: r.reservationId,
      reservationNumber: r.reservationId,
      bookingId: r.reservationId,
      ship: r.ship,
      departureDate: r.sailingDate,
      returnDate: r.departureDate,
      nights: r.nights,
      itineraryName: r.itinerary,
      stateroom: r.stateroom,
      guests: r.guests,
      amountPaid: r.amountPaid,
      taxesFees: r.taxesFees,
      casinoComp: r.casinoComp,
    }));
    allCruises.push(...mappedFinancialCruises);
    console.log('[CruiseDetail] Added hardcoded financial cruises to search:', mappedFinancialCruises.length);
    console.log('[CruiseDetail] Total cruises to search:', allCruises.length);
    
    // First try to find by ID/booking/reservation match
    cruise = allCruises.find((c: any) => {
      const target = String(id);
      return (
        String(c.id ?? '') === target ||
        String(c.bookingId ?? '') === target ||
        String(c.reservationNumber ?? '') === target ||
        String(c.reservationId ?? '') === target
      );
    });
    console.log('[CruiseDetail] Found cruise by ID/booking/reservation match:', !!cruise);
    
    // If not found by ID, try to find by temporary ID pattern or booked ID pattern
    if (!cruise && id && (id.startsWith('temp-') || id.startsWith('booked-'))) {
      console.log('[CruiseDetail] Searching for cruise by ID pattern:', id);
      
      let shipPart = '';
      let datePart = '';
      
      if (id.startsWith('temp-')) {
        // Extract ship name and date from temp ID
        const tempIdParts = id.replace('temp-', '').split('-');
        if (tempIdParts.length >= 2) {
          shipPart = tempIdParts.slice(0, -1).join(' ').replace(/-/g, ' ');
          datePart = tempIdParts[tempIdParts.length - 1];
        }
      } else if (id.startsWith('booked-')) {
        // Extract ship name from booked ID (format: booked-shipname-number)
        const bookedIdParts = id.replace('booked-', '').split('-');
        if (bookedIdParts.length >= 1) {
          // Take all parts except the last one (which is usually a number)
          shipPart = bookedIdParts.slice(0, -1).join(' ').replace(/-/g, ' ');
          // For booked cruises, we don't rely on date matching as much
          datePart = '';
        }
      }
      
      if (shipPart) {
        console.log('[CruiseDetail] Looking for ship containing:', shipPart, 'and date:', datePart || 'any');
        
        cruise = allCruises.find((c: any) => {
          const shipName = (c.ship || c['Ship Name'] || '').toLowerCase();
          const cruiseDate = c.departureDate || c['Sailing Date'] || c.startDate || '';
          
          const shipMatches = shipName.includes(shipPart.toLowerCase());
          const dateMatches = !datePart || cruiseDate.includes(datePart) || cruiseDate === datePart || datePart === 'unknown';
          
          console.log('[CruiseDetail] Checking cruise:', {
            ship: shipName,
            date: cruiseDate,
            shipMatches,
            dateMatches,
            cruiseId: c.id
          });
          
          return shipMatches && dateMatches;
        });
        
        if (cruise) {
          console.log('[CruiseDetail] Found cruise by ID pattern:', cruise.ship, cruise.departureDate || cruise['Sailing Date'] || cruise.startDate);
        } else {
          console.log('[CruiseDetail] No cruise found matching pattern. Available ships:', 
            allCruises.map((c: any) => c.ship || c['Ship Name']).join(', '));
        }
      }
    }
    
    console.log('[CruiseDetail] Found cruise in combined data:', !!cruise);
    
    // If still not found, try backend data
    if (!cruise && cruiseQuery.data) {
      cruise = cruiseQuery.data;
      console.log('[CruiseDetail] Using cruise from backend:', !!cruise);
    }
  }
  const analyticsMatch: SimpleCruise | undefined = React.useMemo(() => {
    try {
      if (!cruise) return undefined;
      const cid = String((cruise as any)?.id ?? '');
      const byId = simpleAnalytics.cruises.find(c => String(c.id) === cid);
      if (byId) return byId;

      const ship = String((cruise as any)?.ship ?? '').trim().toLowerCase();
      const dep = String(
        (cruise as any)?.departureDate ??
        (cruise as any)?.['Sailing Date'] ??
        (cruise as any)?.startDate ??
        ''
      ).slice(0, 10);
      if (!ship || !dep) return undefined;

      // Exact date match first
      let match = simpleAnalytics.cruises.find(c => c.ship.trim().toLowerCase() === ship && String(c.sailDate).slice(0,10) === dep);
      if (match) return match;

      // Fuzzy: allow +/- 2 days window
      const depDate = createDateFromString(dep);
      const windowDays = 2;
      match = simpleAnalytics.cruises.find(c => {
        if (c.ship.trim().toLowerCase() !== ship) return false;
        const sd = createDateFromString(String(c.sailDate).slice(0,10));
        const diff = Math.abs(Math.round((sd.getTime() - depDate.getTime()) / 86400000));
        return diff <= windowDays;
      });
      return match;
    } catch (e) {
      console.log('[CruiseDetail] analyticsMatch error', e);
      return undefined;
    }
  }, [simpleAnalytics.cruises, cruise]);

  const mergedFinancials = React.useMemo(() => {
    const amt = Number((analyticsMatch?.amountPaid ?? (cruise as any)?.amountPaid ?? 0) ?? 0);
    const tax = Number((analyticsMatch?.taxesFees ?? (cruise as any)?.taxesFees ?? 0) ?? 0);
    const comp = Number((analyticsMatch?.casinoComp ?? (cruise as any)?.casinoComp ?? 0) ?? 0);
    const fp = Number((analyticsMatch?.freePlay ?? (cruise as any)?.freePlay ?? 0) ?? 0);
    const cert = Number(((analyticsMatch as any)?.usedCruiseCertificate ?? (cruise as any)?.usedCruiseCertificate ?? 0) ?? 0);
    return { amountPaid: amt, taxesFees: tax, casinoComp: comp, freePlay: fp, usedCruiseCertificate: cert } as const;
  }, [analyticsMatch, cruise]);
  
  // Check if cruise is booked using AppStateProvider (after cruise is available)
  const isCruiseBooked = React.useMemo(() => {
    if (!id || !hasLocalData || !Array.isArray(localData.booked)) return false;
    return localData.booked.some((b: any) => {
      const idMatch = String(b.cruiseId ?? '') === String(id);
      const shipMatch = cruise ? b.ship === cruise.ship : false;
      const dateMatch = cruise ? (b.startDate === cruise.departureDate || b.departureDate === cruise.departureDate) : false;
      return idMatch || (shipMatch && dateMatch);
    });
  }, [id, hasLocalData, localData.booked, cruise]);
  
  // Initialize edited cruise data
  React.useEffect(() => {
    if (cruise && !editedCruise) {
      setEditedCruise({ ...cruise });
    }
  }, [cruise, editedCruise]);
  
  React.useEffect(() => {
    if (cruiseQuery.error) {
      console.error('[CruiseDetail] Query error:', cruiseQuery.error);
    }
  }, [cruiseQuery.error]);

  React.useEffect(() => {
    if (cruise && statementsQuery.refetch) {
      statementsQuery.refetch();
    }
  }, [cruise, statementsQuery.refetch]);

  if (simpleCruise) {
    return <SimpleCruiseDetail cruise={simpleCruise} />;
  }

  const performFetch = React.useCallback(async (args: { ship: string; depDate: string }) => {
    console.log('[CruiseDetail] performFetch called');
    console.log('[CruiseDetail] cruise object:', cruise);
    console.log('[CruiseDetail] cruise.id:', cruise?.id);

    const hasId = Boolean(cruise?.id);
    const cruiseId = hasId ? String(cruise.id) : `temp-${args.ship.replace(/\s+/g, '-').toLowerCase()}-${args.depDate || 'unknown'}`;

    setIsRefreshing(true);
    setScrapingStatus('Fetching');

    const doEstimatedFallback = async () => {
      try {
        const nights = Number((cruise as any)?.nights ?? 7) || 7;
        const shipName = String((cruise as any)?.ship ?? args.ship ?? '');
        const baseForShip = (() => {
          const s = shipName.toLowerCase();
          if (s.includes('star of the seas')) return 180;
          if (s.includes('wonder') || s.includes('symphony')) return 160;
          if (s.includes('harmony') || s.includes('allure') || s.includes('oasis')) return 140;
          if (s.includes('navigator') || s.includes('voyager') || s.includes('mariner')) return 120;
          return 120;
        })();
        const calc = (mult: number) => Math.round(baseForShip * Math.max(1, nights) * mult * 2 * 1.15);
        const mapped = {
          interior: calc(1.0),
          oceanview: calc(1.3),
          balcony: calc(1.8),
          suite: calc(3.2),
        } as { interior: number; oceanview: number; balcony: number; suite: number };

        setWebPricing(mapped);
        setWebPricingMeta({ fetchedAt: new Date().toISOString(), source: 'Estimated (offline)' });

        try {
          if (hasLocalData && updateCruise && cruise?.id) {
            const prevLowest = (cruise as any)?.pricingLowest ?? {};
            const newLowest = {
              interior: Math.min(prevLowest.interior ?? Infinity, mapped.interior || Infinity),
              oceanview: Math.min(prevLowest.oceanview ?? Infinity, mapped.oceanview || Infinity),
              balcony: Math.min(prevLowest.balcony ?? Infinity, mapped.balcony || Infinity),
              suite: Math.min(prevLowest.suite ?? Infinity, mapped.suite || Infinity),
              source: 'Estimated (offline)',
              fetchedAt: new Date().toISOString(),
            } as any;
            await updateCruise(String(cruise.id), {
              pricingCurrent: {
                interior: mapped.interior,
                oceanview: mapped.oceanview,
                balcony: mapped.balcony,
                suite: mapped.suite,
                source: 'Estimated (offline)',
                fetchedAt: new Date().toISOString(),
              },
              pricingLowest: {
                interior: Number.isFinite(newLowest.interior) ? newLowest.interior : null,
                oceanview: Number.isFinite(newLowest.oceanview) ? newLowest.oceanview : null,
                balcony: Number.isFinite(newLowest.balcony) ? newLowest.balcony : null,
                suite: Number.isFinite(newLowest.suite) ? newLowest.suite : null,
                source: newLowest.source ?? null,
                fetchedAt: newLowest.fetchedAt ?? null,
              },
              verified: false,
              verifiedAt: new Date().toISOString(),
              verifiedSource: 'estimated-offline',
            });
            Object.assign(cruise, {
              pricingCurrent: {
                interior: mapped.interior,
                oceanview: mapped.oceanview,
                balcony: mapped.balcony,
                suite: mapped.suite,
                source: 'Estimated (offline)',
                fetchedAt: new Date().toISOString(),
              },
              pricingLowest: {
                interior: Number.isFinite(newLowest.interior) ? newLowest.interior : null,
                oceanview: Number.isFinite(newLowest.oceanview) ? newLowest.oceanview : null,
                balcony: Number.isFinite(newLowest.balcony) ? newLowest.balcony : null,
                suite: Number.isFinite(newLowest.suite) ? newLowest.suite : null,
                source: newLowest.source ?? null,
                fetchedAt: newLowest.fetchedAt ?? null,
              },
              verified: false,
              verifiedAt: new Date().toISOString(),
              verifiedSource: 'estimated-offline',
            });
          }
        } catch (persistErr) {
          console.warn('[CruiseDetail] Failed to persist estimated pricing locally:', persistErr);
        }

        setItineraryUpdatedAt(new Date().toISOString());
        cruiseQuery.refetch();
        expectedAnalyticsQuery.refetch();
        Alert.alert('Offline mode', 'Backend is not connected. Showing estimated pricing.');
      } catch (e) {
        console.error('[CruiseDetail] Estimated pricing fallback failed', e);
      }
    };

    if (!isBackendEnabled) {
      await doEstimatedFallback();
      setIsRefreshing(false);
      setScrapingStatus('');
      return;
    }

    try {
      const result = await fetchWebPricingMutation.mutateAsync({ 
        cruiseId,
        fetchItinerary: true,
        ship: args.ship || undefined,
        departureDate: args.depDate || undefined,
      });

      console.log('[CruiseDetail] fetchWebPricing success:', result);
      setScrapingStatus('FINISHED');

      try {
        const p = (result as any)?.pricing as any;
        if (p) {
          const mapped = {
            interior: Number(p.interior ?? 0) || 0,
            oceanview: Number(p.oceanview ?? 0) || 0,
            balcony: Number(p.balcony ?? 0) || 0,
            suite: Number(p.suite ?? 0) || 0,
          } as { interior: number; oceanview: number; balcony: number; suite: number };

          setWebPricing(mapped);
          setWebPricingMeta({ fetchedAt: String(p.fetchedAt ?? null), source: String(p.source ?? '') || null });

          try {
            if (hasLocalData && updateCruise && cruise?.id) {
              const prevLowest = (cruise as any)?.pricingLowest ?? {};
              const newLowest = {
                interior: Math.min(prevLowest.interior ?? Infinity, mapped.interior || Infinity),
                oceanview: Math.min(prevLowest.oceanview ?? Infinity, mapped.oceanview || Infinity),
                balcony: Math.min(prevLowest.balcony ?? Infinity, mapped.balcony || Infinity),
                suite: Math.min(prevLowest.suite ?? Infinity, mapped.suite || Infinity),
                source: String(p.source ?? prevLowest.source ?? 'Estimated'),
                fetchedAt: String(p.fetchedAt ?? prevLowest.fetchedAt ?? new Date().toISOString()),
              } as any;
              await updateCruise(String(cruise.id), {
                pricingCurrent: {
                  interior: mapped.interior,
                  oceanview: mapped.oceanview,
                  balcony: mapped.balcony,
                  suite: mapped.suite,
                  source: String(p.source ?? 'Estimated'),
                  fetchedAt: String(p.fetchedAt ?? new Date().toISOString()),
                },
                pricingLowest: {
                  interior: Number.isFinite(newLowest.interior) ? newLowest.interior : null,
                  oceanview: Number.isFinite(newLowest.oceanview) ? newLowest.oceanview : null,
                  balcony: Number.isFinite(newLowest.balcony) ? newLowest.balcony : null,
                  suite: Number.isFinite(newLowest.suite) ? newLowest.suite : null,
                  source: newLowest.source ?? null,
                  fetchedAt: newLowest.fetchedAt ?? null,
                },
                verified: true,
                verifiedAt: new Date().toISOString(),
                verifiedSource: String(p.source ?? 'web-scraper'),
              });
              Object.assign(cruise, {
                pricingCurrent: {
                  interior: mapped.interior,
                  oceanview: mapped.oceanview,
                  balcony: mapped.balcony,
                  suite: mapped.suite,
                  source: String(p.source ?? 'Estimated'),
                  fetchedAt: String(p.fetchedAt ?? new Date().toISOString()),
                },
                pricingLowest: {
                  interior: Number.isFinite(newLowest.interior) ? newLowest.interior : null,
                  oceanview: Number.isFinite(newLowest.oceanview) ? newLowest.oceanview : null,
                  balcony: Number.isFinite(newLowest.balcony) ? newLowest.balcony : null,
                  suite: Number.isFinite(newLowest.suite) ? newLowest.suite : null,
                  source: newLowest.source ?? null,
                  fetchedAt: newLowest.fetchedAt ?? null,
                },
                verified: true,
                verifiedAt: new Date().toISOString(),
                verifiedSource: String(p.source ?? 'web-scraper'),
              });
            }
          } catch (persistErr) {
            console.warn('[CruiseDetail] Failed to persist pricing locally (will still be in memoryStore backend if enabled):', persistErr);
          }
        }
        setItineraryUpdatedAt(new Date().toISOString());
        cruiseQuery.refetch();
        expectedAnalyticsQuery.refetch();
      } catch (e) {
        console.error('[CruiseDetail] fetchWebPricing result mapping error', e);
      }
    } catch (err) {
      console.error('[CruiseDetail] fetchWebPricing mutate error:', err);
      await doEstimatedFallback();
      setScrapingStatus('DATA NOT FOUND');
    } finally {
      setIsRefreshing(false);
      setScrapingStatus('');
    }
  }, [cruise, fetchWebPricingMutation, cruiseQuery, expectedAnalyticsQuery, hasLocalData, updateCruise]);
  
  
  if (cruiseQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    );
  }
  
  if (!cruise && !parsedBookedData && ((hasLocalData && !cruise) || (!hasLocalData && !parsedBookedData && cruiseQuery.error) || (!hasLocalData && !parsedBookedData && !cruiseQuery.isLoading && !cruiseQuery.data))) {
    console.error('[CruiseDetail] Error loading cruise:', cruiseQuery.error);
    console.error('[CruiseDetail] Cruise ID:', id);
    // Show available cruise IDs from both local and static data
    const allAvailableCruises: any[] = [];
    if (hasLocalData && localData.cruises) {
      allAvailableCruises.push(...localData.cruises);
    }
    allAvailableCruises.push(...STATIC_BOOKED_CRUISES);
    try {
      const celebCruises = Array.isArray(celebrity?.cruises) ? celebrity.cruises : [];
      const celebBooked = Array.isArray(celebrity?.bookedCruises) ? celebrity.bookedCruises : [];
      allAvailableCruises.push(...celebCruises, ...celebBooked);
    } catch {}
    
    
    console.error('[CruiseDetail] Available cruise IDs:', allAvailableCruises.length > 0 ? 
      allAvailableCruises.map((c: any) => `${c.id || 'no-id'} (${c.ship || c['Ship Name'] || 'no-ship'})`).join(', ') : 
      'No cruises available');
    
    return (
      <>
        <Stack.Screen 
          options={{
            title: 'Cruise Not Found',
            headerStyle: {
              backgroundColor: '#FFFFFF',
            },
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
                <ArrowLeft size={24} color="#111827" />
              </TouchableOpacity>
            ),
          }} 
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Cruise not found (ID: {id})
          </Text>
          <Text style={styles.errorSubtext}>
            {cruiseQuery.error?.message || 'The cruise you are looking for could not be found in the system.'}
          </Text>
          <TouchableOpacity 
            style={styles.errorBackButton}
            onPress={() => router.back()}
          >
            <Text style={styles.errorBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }
  
  if (!cruise && !parsedBookedData && (!hasLocalData && cruiseQuery.isLoading)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    );
  }
  
  if (!cruise) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Cruise not found</Text>
        <TouchableOpacity 
          style={styles.errorBackButton}
          onPress={() => router.back()}
        >
          <Text style={styles.errorBackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }




  const handleSaveChanges = async () => {
    if (!editedCruise) {
      Alert.alert('Error', 'No changes to save');
      return;
    }

    Alert.alert(
      'Save Changes',
      'This will update the cruise information. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            console.log('[CruiseDetail] Saving changes:', editedCruise);
            
            try {
              // If we have local data, use the AppStateProvider's updateCruise method
              if (hasLocalData && localData.cruises) {
                await updateCruise(editedCruise.id, {
                  ship: editedCruise.ship,
                  itineraryName: editedCruise.itineraryName,
                  departureDate: editedCruise.departureDate,
                  returnDate: editedCruise.returnDate,
                  pricing: editedCruise.pricing,
                  winningsBroughtHome: editedCruise.winningsBroughtHome,
                  cruisePointsEarned: editedCruise.cruisePointsEarned
                });
                
                // Update the current cruise object for immediate UI update
                Object.assign(cruise, editedCruise);
                
                console.log('[CruiseDetail] Successfully updated local cruise data');
                setIsEditing(false);
                Alert.alert('Success', 'Cruise information updated successfully!');
              } else {
                // Save to backend (structure + financials)
                updateCruiseMutation.mutate({
                  id: editedCruise.id,
                  updates: {
                    ship: editedCruise.ship,
                    itineraryName: editedCruise.itineraryName,
                    departureDate: editedCruise.departureDate,
                    returnDate: editedCruise.returnDate,
                    pricing: editedCruise.pricing
                  }
                });

                updateFinancialsMutation.mutate({
                  cruiseId: editedCruise.id,
                  userFinancialData: {
                    totalWinningsEarned: Number(editedCruise?.winningsBroughtHome ?? 0),
                    pointsEarnedOnCruise: Number(editedCruise?.cruisePointsEarned ?? 0),
                    actualAmountPaid: Number(editedCruise?.amountPaid ?? 0),
                    additionalFreeplayReceived: Number(editedCruise?.freePlay ?? 0),
                  }
                });
              }
            } catch (error) {
              console.error('[CruiseDetail] Failed to save changes:', error);
              Alert.alert('Error', `Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        }
      ]
    );
  };

  const handleCancelEdit = () => {
    setEditedCruise({ ...cruise });
    setIsEditing(false);
  };

  const handleReceiptUpload = async () => {
    try {
      Alert.alert(
        'Upload Receipt',
        'Choose how you want to upload your cruise receipt:',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: () => uploadReceiptFromCamera() },
          { text: 'Choose from Gallery', onPress: () => uploadReceiptFromGallery() },
        ]
      );
    } catch (error) {
      console.error('[CruiseDetail] Receipt upload error:', error);
      Alert.alert('Error', 'Failed to upload receipt');
    }
  };

  const uploadReceiptFromCamera = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setUploadingReceipts(true);
        receiptUploadMutation.mutate({
          imageBase64: result.assets[0].base64,
          cruiseId: cruise.id,
          bookingId: cruise.bookingId || cruise.reservationNumber
        });
      }
    } catch (error) {
      console.error('[CruiseDetail] Camera receipt upload error:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadReceiptFromGallery = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Photo library permission is required to select images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setUploadingReceipts(true);
        receiptUploadMutation.mutate({
          imageBase64: result.assets[0].base64,
          cruiseId: cruise.id,
          bookingId: cruise.bookingId || cruise.reservationNumber
        });
      }
    } catch (error) {
      console.error('[CruiseDetail] Gallery receipt upload error:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const handleStatementUpload = async () => {
    try {
      Alert.alert(
        'Upload Cruise Statement',
        'Choose how you want to upload your cruise statement or folio:',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: () => uploadStatementFromCamera() },
          { text: 'Choose from Gallery', onPress: () => uploadStatementFromGallery() },
          { text: 'Select PDF/Files', onPress: () => uploadStatementFromFiles() },
        ]
      );
    } catch (error) {
      console.error('[CruiseDetail] Statement upload error:', error);
      Alert.alert('Error', 'Failed to upload statement');
    }
  };

  const uploadStatementFromCamera = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setUploadingStatements(true);
        statementUploadMutation.mutate({
          files: [{
            base64: result.assets[0].base64,
            type: 'image' as const,
            name: `statement_${Date.now()}.jpg`
          }],
          cruiseId: cruise.id,
          bookingId: cruise.bookingId || cruise.reservationNumber
        });
      }
    } catch (error) {
      console.error('[CruiseDetail] Camera statement upload error:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const uploadStatementFromGallery = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Photo library permission is required to select images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        setUploadingStatements(true);
        const files = result.assets
          .filter(asset => asset.base64)
          .map((asset, index) => ({
            base64: asset.base64!,
            type: 'image' as const,
            name: `statement_${Date.now()}_${index + 1}.jpg`
          }));

        if (files.length > 0) {
          statementUploadMutation.mutate({
            files,
            cruiseId: cruise.id,
            bookingId: cruise.bookingId || cruise.reservationNumber
          });
        } else {
          setUploadingStatements(false);
          Alert.alert('Error', 'No valid images selected');
        }
      }
    } catch (error) {
      console.error('[CruiseDetail] Gallery statement upload error:', error);
      setUploadingStatements(false);
      Alert.alert('Error', 'Failed to select images');
    }
  };

  const uploadStatementFromFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        setUploadingStatements(true);
        
        const files = [];
        for (const asset of result.assets) {
          try {
            // Convert file to base64
            const response = await fetch(asset.uri);
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                // Remove data URL prefix
                const base64Data = result.split(',')[1];
                resolve(base64Data);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            files.push({
              base64,
              type: asset.mimeType?.includes('pdf') ? 'pdf' as const : 'image' as const,
              name: asset.name || `statement_${Date.now()}.${asset.mimeType?.includes('pdf') ? 'pdf' : 'jpg'}`
            });
          } catch (fileError) {
            console.error('[CruiseDetail] Error processing file:', asset.name, fileError);
          }
        }

        if (files.length > 0) {
          statementUploadMutation.mutate({
            files,
            cruiseId: cruise.id,
            bookingId: cruise.bookingId || cruise.reservationNumber
          });
        } else {
          setUploadingStatements(false);
          Alert.alert('Error', 'No valid files could be processed');
        }
      }
    } catch (error) {
      console.error('[CruiseDetail] File statement upload error:', error);
      setUploadingStatements(false);
      Alert.alert('Error', 'Failed to select files');
    }
  };



  const displayCruise = isEditing ? editedCruise : cruise;
  const unifiedDisplay = React.useMemo(() => detectAndMapUnified(displayCruise as any), [displayCruise]);
  const itineraryText = React.useMemo(() => {
    const pr = String(unifiedDisplay.portsRoute ?? '').trim();
    const itin = String(unifiedDisplay.itineraryName ?? '').trim();
    const depPort = String(unifiedDisplay.departurePort ?? '').trim();
    const looksDetailed = pr.includes(',') || pr.includes(' - ');
    const isSameAsPort = depPort.length > 0 && pr.toLowerCase() === depPort.toLowerCase();
    const isValidPr = pr.length > 0 && looksDetailed && !isSameAsPort;
    if (isValidPr) return pr;
    if (itin && itin.toLowerCase() !== String(unifiedDisplay.ship || '').toLowerCase()) return itin;
    const combined = [depPort, itin].filter(Boolean).join(' • ');
    return combined || '—';
  }, [unifiedDisplay.portsRoute, unifiedDisplay.itineraryName, unifiedDisplay.departurePort, unifiedDisplay.ship]);
  
  const hasReceiptOrStatement = Boolean((cruise as any)?.hasReceiptData || (displayCruise as any)?.hasReceiptData || (cruise as any)?.hasStatementData || (displayCruise as any)?.hasStatementData);
  const isBookedLike = Boolean((cruise as any)?.isBooked || (cruise as any)?.reservationNumber || hasReceiptOrStatement);
  const showCurrentPricing = true;

  return (
    <>
      <Stack.Screen 
        options={{
          title: '',
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBackButton}>
              <ArrowLeft size={24} color="#111827" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={styles.headerRightContainer}>
              {isEditing ? (
                <>
                  <TouchableOpacity onPress={handleCancelEdit} style={styles.headerButton}>
                    <X size={20} color="#EF4444" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveChanges} style={styles.headerButton}>
                    <Save size={20} color="#22C55E" />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.headerButton}>
                  <Edit3 size={20} color="#3B82F6" />
                </TouchableOpacity>
              )}
            </View>
          ),
        }} 
      />
      <View style={styles.container}>
        <View style={styles.header}>
          {isEditing ? (
            <TextInput
              style={styles.editableShipName}
              value={editedCruise?.ship || editedCruise?.['Ship Name'] || ''}
              onChangeText={(text) => setEditedCruise((prev: any) => ({ ...prev, ship: text }))}
              placeholder="Ship Name"
              testID="editable-ship-name"
            />
          ) : (
            <Text style={styles.shipName} testID="ship-name-header">{((displayCruise as any).ship || (displayCruise as any)['Ship Name'] || 'Unknown Ship').replace(/\[R\]/g, '®')}</Text>
          )}
          <View style={[styles.offerCodeRow, { justifyContent: 'space-between' }]}>
            {(() => {
              const current = isEditing ? editedCruise : displayCruise;
              const code = (current?.offerCode || current?.offerDetails?.offerCode || (current as any)['Offer Code']) ?? '';
              return (
                <>
                  {code ? (
                    <View style={styles.offerCodeChip} testID="offer-code-chip">
                      <Text style={styles.offerCodeChipText}>{String(code)}</Text>
                    </View>
                  ) : (
                    <View />
                  )}
                  {isBookedLike && (current?.reservationNumber || current?.bookingId) ? (
                    <View style={styles.statusBadge} testID="availability-pill">
                      <Text style={styles.statusText}>#{current?.reservationNumber || current?.bookingId}</Text>
                    </View>
                  ) : (
                    <View style={styles.statusBadge} testID="availability-pill">
                      <Text style={styles.statusText}>{isBookedLike ? 'Booked' : 'Available'}</Text>
                    </View>
                  )}
                </>
              );
            })()}
          </View>
        </View>



        {/* Content */}
        <ScrollView style={styles.tabContentContainer} testID="cruise-detail-screen">
          <View style={styles.tabContent}>
            <CruiseUnifiedCard cruise={displayCruise} mode="detail" />

            {/* Cruise Details */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Cruise Details</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Itinerary:</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.editableDetailValue}
                    value={editedCruise?.itineraryName || ''}
                    onChangeText={(text) => setEditedCruise((prev: any) => ({ ...prev, itineraryName: text }))}
                    placeholder="Itinerary Name"
                    multiline
                  />
                ) : (
                  <Text style={styles.detailValue}>{itineraryText}</Text>
                )}
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Departure Date:</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.editableDetailValue}
                    value={editedCruise?.departureDate || editedCruise?.['Sailing Date'] || editedCruise?.startDate || ''}
                    onChangeText={(text) => setEditedCruise((prev: any) => ({ ...prev, departureDate: text }))}
                    placeholder="YYYY-MM-DD"
                  />
                ) : (
                  <Text style={styles.detailValue}>
                    {(() => {
                      const depDate = displayCruise.departureDate || (displayCruise as any)['Sailing Date'] || (displayCruise as any).startDate;
                      if (depDate) {
                        return formatDateForDisplay(depDate);
                      }
                      return 'Date not available';
                    })()} 
                  </Text>
                )}
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Return Date:</Text>
                {isEditing ? (
                  <TextInput
                    style={styles.editableDetailValue}
                    value={editedCruise?.returnDate || editedCruise?.['Return Date'] || editedCruise?.endDate || ''}
                    onChangeText={(text) => setEditedCruise((prev: any) => ({ ...prev, returnDate: text }))}
                    placeholder="YYYY-MM-DD"
                  />
                ) : (
                  <Text style={styles.detailValue}>
                    {(() => {
                      let returnDate = displayCruise.returnDate || (displayCruise as any)['Return Date'] || (displayCruise as any).endDate;
                      if (!returnDate || returnDate === displayCruise.departureDate) {
                        const depDate = displayCruise.departureDate || (displayCruise as any)['Sailing Date'] || (displayCruise as any).startDate;
                        const nights = displayCruise.nights || (displayCruise as any)['Nights'] || (displayCruise as any).Nights || 4;
                        if (depDate && nights > 0) {
                          const startDate = createDateFromString(depDate);
                          const endDate = new Date(startDate);
                          endDate.setDate(endDate.getDate() + nights);
                          const year = endDate.getFullYear();
                          const month = String(endDate.getMonth() + 1).padStart(2, '0');
                          const day = String(endDate.getDate()).padStart(2, '0');
                          returnDate = `${year}-${month}-${day}`;
                        }
                      }
                      return returnDate ? formatDateForDisplay(returnDate) : 'Date not available';
                    })()} 
                  </Text>
                )}
              </View>
              {!isEditMode && (
                <View style={[styles.detailRow, { justifyContent: 'flex-end' }]}>
                  <TouchableOpacity 
                    onPress={() => {
                      setIsEditMode(true);
                      setEditWinLoss(String((cruise as any)?.winnings ?? 0));
                      setEditPointsEarned(String((cruise as any)?.pointsEarned ?? 0));
                      setEditAmountPaid(String(mergedFinancials.amountPaid ?? 0));
                      setEditTaxesFees(String(mergedFinancials.taxesFees ?? 0));
                      setEditCasinoComp(String(mergedFinancials.casinoComp ?? 0));
                      setEditFreePlay(String(mergedFinancials.freePlay ?? 0));
                      const c: any = cruise as any;
                      const current = c?.pricingCurrent ?? {};
                      setEditInteriorPrice(String(current?.interior ?? c?.interiorPrice ?? 0));
                      setEditOceanviewPrice(String(current?.oceanview ?? c?.oceanviewPrice ?? 0));
                      setEditBalconyPrice(String(current?.balcony ?? c?.balconyPrice ?? 0));
                      setEditSuitePrice(String(current?.suite ?? c?.suitePrice ?? 0));
                      setEditPortTaxes(String(c?.portTaxesFees ?? c?.taxesFees ?? 0));
                      const portsRoute = String(unifiedDisplay.portsRoute ?? '');
                      setEditPortsAndTimes(portsRoute);
                    }}
                    style={{ backgroundColor: '#3B82F6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    testID="global-edit-button"
                  >
                    <Edit3 size={16} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>Edit All</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status:</Text>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{isBookedLike ? 'Booked' : 'Available'}</Text>
                </View>
              </View>
            </View>

            {/* Itinerary */}
            <View style={styles.detailsSection}>
              <View style={styles.sectionHeader}>
                <Calendar size={20} color="#3B82F6" />
                <Text style={styles.sectionTitle}>Itinerary</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <View style={styles.pillInfo}><Text style={styles.pillInfoText}>{(displayCruise as any)?.nights ?? (displayCruise as any)?.Nights ?? 7} Nights</Text></View>
                {displayCruise.departurePort ? (
                  <View style={styles.pillInfo}><Text style={styles.pillInfoText}>{displayCruise.departurePort}</Text></View>
                ) : null}
                {(itineraryText) ? (
                  <View style={[styles.pillInfo, { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }]}><Text style={[styles.pillInfoText, { color: '#111827' }]} numberOfLines={1}>{itineraryText}</Text></View>
                ) : null}
              </View>
              {isEditMode && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4, fontWeight: '600' }}>Ports & Times (comma separated)</Text>
                  <TextInput
                    value={editPortsAndTimes}
                    onChangeText={setEditPortsAndTimes}
                    style={{ fontSize: 14, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 8, color: '#111827', minHeight: 60 }}
                    placeholder="e.g. Port A, Port B, Port C"
                    multiline
                    testID="edit-ports-and-times"
                  />
                </View>
              )}
              <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
                {(() => {
                  const dep = (displayCruise as any).departureDate || (displayCruise as any)['Sailing Date'] || (displayCruise as any).startDate;
                  const ret = (displayCruise as any).returnDate || (displayCruise as any)['Return Date'] || (displayCruise as any).endDate;
                  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' } as const;
                  const depF = dep ? createDateFromString(dep).toLocaleDateString('en-US', options) : '';
                  const retF = ret ? createDateFromString(ret).toLocaleDateString('en-US', options) : '';
                  const range = depF && retF ? `${depF} - ${retF}` : depF || 'Dates not available';
                  const updated = itineraryUpdatedAt ? ` • Last updated ${createDateFromString(itineraryUpdatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` : '';
                  return `${range}${updated}`;
                })()}
              </Text>
              {(() => {
                const getNights = () => {
                  const explicit = (displayCruise as any)?.nights ?? (displayCruise as any)?.Nights ?? (displayCruise as any)?.NIGHTS ?? (displayCruise as any)?.['Nights'];
                  if (typeof explicit === 'number' && !Number.isNaN(explicit) && explicit > 0) return explicit;
                  if (typeof explicit === 'string') {
                    const parsed = parseInt(explicit, 10);
                    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
                  }
                  if ((displayCruise as any)?.departureDate && (displayCruise as any)?.returnDate) {
                    const dep = createDateFromString((displayCruise as any).departureDate).getTime();
                    const ret = createDateFromString((displayCruise as any).returnDate).getTime();
                    const diff = Math.round((ret - dep) / (1000 * 60 * 60 * 24));
                    if (!Number.isNaN(diff) && diff > 0) return diff;
                  }
                  return 4;
                };
                const nights = getNights();
                const depDate = createDateFromString((displayCruise as any).departureDate || (displayCruise as any)['Sailing Date'] || (displayCruise as any).startDate || new Date().toISOString().slice(0,10));

                const portsData = Array.isArray((displayCruise as any)?.ports)
                  ? ((displayCruise as any).ports as Array<{ name: string; arrivalTime?: string | null; departureTime?: string | null }>)
                  : [];

                const fallbackPorts: string[] = (() => {
                  try {
                    const raw = String(unifiedDisplay?.portsRoute ?? (displayCruise as any)?.['All Ports'] ?? '').trim();
                    if (!raw) return [];
                    const parts = raw.includes(',') ? raw.split(',') : raw.split(' - ');
                    return parts.map(p => p.trim()).filter(Boolean);
                  } catch {
                    return [];
                  }
                })();

                const rows = Array.from({ length: nights + 1 }, (_, index) => {
                  const dayDate = new Date(depDate);
                  dayDate.setDate(dayDate.getDate() + index);

                  let name = 'At Sea';
                  let type: 'departure' | 'arrival' | 'port' | 'sea' = 'sea';
                  let arrival: string | null = null;
                  let departure: string | null = null;

                  if (index === 0) {
                    name = (displayCruise as any).departurePort ?? 'Departure Port';
                    type = 'departure';
                    departure = '3:00 pm';
                  } else if (index === nights) {
                    name = (displayCruise as any).departurePort ?? 'Departure Port';
                    type = 'arrival';
                    departure = 'Arrival';
                  } else {
                    if (portsData.length > 0) {
                      const p = portsData[index - 1];
                      if (p && p.name) {
                        name = p.name;
                        type = 'port';
                        arrival = p.arrivalTime ?? null;
                        departure = p.departureTime ?? null;
                      } else {
                        name = 'At Sea';
                        type = 'sea';
                      }
                    } else {
                      const portFromData = fallbackPorts[index - 1];
                      if (portFromData) {
                        name = portFromData;
                        type = 'port';
                      } else {
                        name = 'At Sea';
                        type = 'sea';
                      }
                    }
                  }

                  return { key: `it-${index}`, index, dayDate, name, type, arrival, departure };
                });

                return (
                  <View>
                    {rows.map(r => (
                      <View key={r.key} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, color: '#6B7280' }}>{r.dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }} numberOfLines={1}>{r.name}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          {r.type === 'sea' ? (
                            <Text style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>At Sea</Text>
                          ) : (
                            <Text style={{ fontSize: 12, color: '#6B7280' }}>{[r.arrival, r.departure].filter(Boolean).join(' • ')}</Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </View>

            {/* Day-by-Day Itinerary (hidden in compact mode) */}
            {false && (
            <View style={styles.detailsSection}>
              <View style={styles.itineraryHeader}>
                <Text style={styles.sectionTitle}>Itinerary</Text>
                <Text style={styles.itinerarySubtitle}>
                  {(() => {
                    // Helper function to get nights value
                    const getNights = () => {
                      const explicit = (cruise as any)?.nights ?? (cruise as any)?.Nights ?? (cruise as any)?.NIGHTS ?? (cruise as any)?.['Nights'];
                      
                      if (typeof explicit === 'number' && !Number.isNaN(explicit) && explicit > 0) {
                        return explicit;
                      }
                      
                      if (typeof explicit === 'string') {
                        const parsed = parseInt(explicit, 10);
                        if (!Number.isNaN(parsed) && parsed > 0) {
                          return parsed;
                        }
                      }
                      
                      if (cruise?.departureDate && cruise?.returnDate) {
                        const dep = new Date(cruise.departureDate).getTime();
                        const ret = new Date(cruise.returnDate).getTime();
                        const diff = Math.round((ret - dep) / (1000 * 60 * 60 * 24));
                        if (!Number.isNaN(diff) && diff > 0) {
                          return diff;
                        }
                      }
                      
                      const itinerary = cruise?.itineraryName || '';
                      const nightMatch = itinerary.match(/(\d+)\s*[Nn]ight/);
                      if (nightMatch) {
                        const nights = parseInt(nightMatch[1], 10);
                        if (!Number.isNaN(nights) && nights > 0) {
                          return nights;
                        }
                      }
                      
                      return 7;
                    };
                    
                    const nights = getNights();
                    const itineraryName = cruise.itineraryName || 'Caribbean Cruise';
                    // Remove any existing "X Night" prefix from itinerary name to avoid duplication
                    const cleanItinerary = itineraryName.replace(/^\d+\s*[Nn]ight\s*/, '');
                    
                    return `${nights} Night ${cleanItinerary}`;
                  })()} 
                </Text>
                <Text style={styles.itineraryNote}>
                  {(() => {
                    const depDate = cruise.departureDate || (cruise as any)['Sailing Date'] || (cruise as any).startDate;
                    let returnDate = cruise.returnDate || (cruise as any)['Return Date'] || (cruise as any).endDate;
                    
                    // Calculate return date if missing
                    if (!returnDate || returnDate === depDate) {
                      const nights = cruise.nights || (cruise as any)['Nights'] || (cruise as any).Nights || 4;
                      if (depDate && nights > 0) {
                        const startDate = createDateFromString(depDate);
                        const endDate = new Date(startDate);
                        endDate.setDate(endDate.getDate() + nights);
                        const year = endDate.getFullYear();
                        const month = String(endDate.getMonth() + 1).padStart(2, '0');
                        const day = String(endDate.getDate()).padStart(2, '0');
                        returnDate = `${year}-${month}-${day}`;
                      }
                    }
                    
                    const depFormatted = depDate ? formatDateForDisplay(depDate) : '';
                    const retFormatted = returnDate ? formatDateForDisplay(returnDate) : '';
                    
                    if (depFormatted && retFormatted) {
                      return `${depFormatted} - ${retFormatted}`;
                    }
                    return 'Dates not available';
                  })()} 
                </Text>
                <Text style={styles.itineraryWarning}>
                  Arrival and departure times may change. Check back for updates!
                </Text>
              </View>
              
              {(() => {
                // Helper function to get nights value
                const getNights = () => {
                  const explicit = (cruise as any)?.nights ?? (cruise as any)?.Nights ?? (cruise as any)?.NIGHTS ?? (cruise as any)?.['Nights'];
                  
                  if (typeof explicit === 'number' && !Number.isNaN(explicit) && explicit > 0) {
                    return explicit;
                  }
                  
                  if (typeof explicit === 'string') {
                    const parsed = parseInt(explicit, 10);
                    if (!Number.isNaN(parsed) && parsed > 0) {
                      return parsed;
                    }
                  }
                  
                  if (cruise?.departureDate && cruise?.returnDate) {
                    const dep = new Date(cruise.departureDate).getTime();
                    const ret = new Date(cruise.returnDate).getTime();
                    const diff = Math.round((ret - dep) / (1000 * 60 * 60 * 24));
                    if (!Number.isNaN(diff) && diff > 0) {
                      return diff;
                    }
                  }
                  
                  const itinerary = cruise?.itineraryName || '';
                  const nightMatch = itinerary.match(/(\d+)\s*[Nn]ight/);
                  if (nightMatch) {
                    const nights = parseInt(nightMatch[1], 10);
                    if (!Number.isNaN(nights) && nights > 0) {
                      return nights;
                    }
                  }
                  
                  return 7;
                };
                
                const nights = getNights();
                const departureDate = createDateFromString(cruise.departureDate || '2025-08-27');
                
                return Array.from({ length: nights + 1 }, (_, index) => {
                  const dayDate = new Date(departureDate);
                  dayDate.setDate(dayDate.getDate() + index);
                  
                  // Get port information
                  const getPortInfo = () => {
                    
                    if (index === 0) {
                      return {
                        name: cruise.departurePort || 'Los Angeles, California',
                        type: 'departure',
                        arrivalTime: null,
                        departureTime: '3:00 pm'
                      };
                    } else if (index === nights) {
                      return {
                        name: cruise.departurePort || 'Los Angeles, California',
                        type: 'arrival',
                        arrivalTime: null,
                        departureTime: 'Departure'
                      };
                    } else {
                      // Generate realistic ports based on ship
                      let portName = 'At Sea';
                      let arrivalTime = null;
                      let departureTime = null;
                      
                      if (cruise.ship && cruise.ship.toLowerCase().includes('navigator')) {
                        const westCoastPorts = [
                          { name: 'Ensenada, Mexico', arrival: '8:30 am', departure: '4:30 pm' },
                          { name: 'Catalina Island, CA', arrival: '8:00 am', departure: '5:00 pm' }
                        ];
                        const portData = westCoastPorts[(index - 1) % westCoastPorts.length];
                        if (portData) {
                          portName = portData.name;
                          arrivalTime = portData.arrival;
                          departureTime = portData.departure;
                        }
                      } else if (cruise.ship && cruise.ship.toLowerCase().includes('of the seas')) {
                        const rcPorts = [
                          { name: 'Perfect Day at CocoCay', arrival: '8:00 am', departure: '5:00 pm' },
                          { name: 'Nassau, Bahamas', arrival: '7:00 am', departure: '4:00 pm' },
                          { name: 'Cozumel, Mexico', arrival: '8:30 am', departure: '4:30 pm' }
                        ];
                        const portData = rcPorts[(index - 1) % rcPorts.length];
                        if (portData) {
                          portName = portData.name;
                          arrivalTime = portData.arrival;
                          departureTime = portData.departure;
                        }
                      }
                      
                      return {
                        name: portName,
                        type: portName === 'At Sea' ? 'sea' : 'port',
                        arrivalTime,
                        departureTime
                      };
                    }
                  };
                  
                  const portInfo = getPortInfo();
                  const isToday = index === 0; // First day is "Today"
                  
                  return (
                    <View key={`day-${index}`} style={styles.modernItineraryDay}>
                      {/* Day Header */}
                      <View style={styles.modernDayHeader}>
                        <View style={styles.modernDayLeft}>
                          <View style={[styles.modernDayIcon, portInfo.type === 'departure' && styles.departureIcon, portInfo.type === 'sea' && styles.seaIcon]}>
                            {portInfo.type === 'departure' || portInfo.type === 'arrival' ? (
                              <Anchor size={16} color="#3B82F6" />
                            ) : portInfo.type === 'sea' ? (
                              <Text style={styles.seaWaveIcon}>〜</Text>
                            ) : (
                              <Anchor size={16} color="#3B82F6" />
                            )}
                          </View>
                          <View style={styles.modernDayInfo}>
                            <Text style={[styles.modernDayTitle, isToday && styles.todayTitle]}>
                              {isToday ? 'Today' : `Day ${index + 1}`}
                              {isToday && <Text style={styles.viewingLabel}> Viewing</Text>}
                            </Text>
                            <Text style={styles.modernDayDate}>
                              {dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </Text>
                            <Text style={styles.modernPortName}>{portInfo.name}</Text>
                          </View>
                        </View>
                        
                        {/* Times */}
                        <View style={styles.modernTimesContainer}>
                          {portInfo.type === 'departure' && (
                            <View style={styles.modernTimeSlot}>
                              <Text style={styles.modernTimeLabel}>All aboard</Text>
                              <Text style={styles.modernTimeValue}>{portInfo.departureTime}</Text>
                            </View>
                          )}
                          {portInfo.type === 'port' && portInfo.arrivalTime && (
                            <>
                              <View style={styles.modernTimeSlot}>
                                <Text style={styles.modernTimeLabel}>Gangway</Text>
                                <Text style={styles.modernTimeValue}>{portInfo.arrivalTime}</Text>
                              </View>
                              {portInfo.departureTime && (
                                <View style={styles.modernTimeSlot}>
                                  <Text style={styles.modernTimeValue}>{portInfo.departureTime}</Text>
                                </View>
                              )}
                            </>
                          )}
                          {portInfo.type === 'arrival' && (
                            <View style={styles.modernTimeSlot}>
                              <Text style={styles.modernTimeLabel}>{portInfo.departureTime}</Text>
                            </View>
                          )}
                          {portInfo.type === 'sea' && (
                            <View style={styles.modernTimeSlot}>
                              <Text style={styles.seaDayLabel}>Cruising</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                });
              })()}
              
              {/* Removed Change Ship/Dates button - these are unique sailings */}
            </View>
            )}



            {/* Cruise Value Analysis - hidden (non-CSV) */}
            {false && (cruise.ship && cruise.ship.toLowerCase().includes('star of the seas') && 
             ((cruise.startDate && cruise.startDate.includes('2025-08-23')) || 
              (cruise.departureDate && cruise.departureDate.includes('2025-08-23')))) && (
              <View style={styles.detailsSection}>
                <View style={styles.sectionHeader}>
                  <Award size={20} color="#22C55E" />
                  <Text style={styles.sectionTitle}>Your Cruise Value Analysis</Text>
                </View>
                
                {(() => {
                  // Star of the Seas 8/23-8/27 specific calculations
                  const currentBalconyPrice = 2981; // Current market price per person
                  const portFees = 200; // Estimated port fees
                  const totalMarketPrice = (currentBalconyPrice * 2) + portFees; // For 2 passengers
                  
                  // User's actual costs
                  const outOfPocket = 77; // What user paid
                  const nextCruiseCertificate = 200; // Applied towards port fees
                  const totalUserPaid = outOfPocket + nextCruiseCertificate;
                  
                  // Savings calculation
                  const totalSavings = totalMarketPrice - totalUserPaid;
                  
                  // Points calculation (assuming 800 points earned to achieve this)
                  const pointsEarned = 800;
                  const dollarValuePerPoint = pointsEarned > 0 ? totalSavings / pointsEarned : 0;
                  
                  return (
                    <>
                      <View style={styles.valueAnalysisCard}>
                        <Text style={styles.valueAnalysisTitle}>💎 Exceptional Value Achieved!</Text>
                        <Text style={styles.valueAnalysisSubtitle}>Star of the Seas • Balcony Cabin • Aug 23-27, 2025</Text>
                        
                        <View style={styles.valueBreakdown}>
                          <View style={styles.valueRow}>
                            <Text style={styles.valueLabel}>Current Market Price (2 guests):</Text>
                            <Text style={styles.valueAmount}>${totalMarketPrice.toLocaleString()}</Text>
                          </View>
                          
                          <View style={styles.valueRow}>
                            <Text style={styles.valueLabel}>Your Out-of-Pocket:</Text>
                            <Text style={styles.valueAmount}>${outOfPocket}</Text>
                          </View>
                          
                          <View style={styles.valueRow}>
                            <Text style={styles.valueLabel}>Next Cruise Certificate Applied:</Text>
                            <Text style={styles.valueAmount}>${nextCruiseCertificate}</Text>
                          </View>
                          
                          <View style={[styles.valueRow, styles.totalRow]}>
                            <Text style={styles.totalLabel}>Total You Paid:</Text>
                            <Text style={styles.totalAmount}>${totalUserPaid}</Text>
                          </View>
                          
                          <View style={[styles.valueRow, styles.savingsRow]}>
                            <Text style={styles.savingsLabel}>🎉 Total Savings:</Text>
                            <Text style={styles.savingsAmount}>${totalSavings.toLocaleString()}</Text>
                          </View>
                        </View>
                        
                        <View style={styles.pointsAnalysis}>
                          <Text style={styles.pointsTitle}>Casino Points Value Analysis</Text>
                          <View style={styles.pointsRow}>
                            <Text style={styles.pointsLabel}>Points Earned to Achieve This:</Text>
                            <Text style={styles.pointsValue}>{pointsEarned.toLocaleString()} points</Text>
                          </View>
                          <View style={styles.pointsRow}>
                            <Text style={styles.pointsLabel}>Value Per Point:</Text>
                            <Text style={styles.pointsHighlight}>${dollarValuePerPoint.toFixed(2)}</Text>
                          </View>
                          <Text style={styles.pointsNote}>
                            💡 Each casino point you earned was worth ${dollarValuePerPoint.toFixed(2)} in cruise value!
                          </Text>
                        </View>
                        
                        <View style={styles.valueInsights}>
                          <Text style={styles.insightsTitle}>🎯 Value Insights</Text>
                          <Text style={styles.insightItem}>• You saved {((totalSavings / totalMarketPrice) * 100).toFixed(1)}% off market price</Text>
                          <Text style={styles.insightItem}>• This represents exceptional casino offer value</Text>
                          <Text style={styles.insightItem}>• Your effective cost per night: ${(totalUserPaid / 3).toFixed(0)} for balcony cabin</Text>
                          <Text style={styles.insightItem}>• Market rate per night: ${(totalMarketPrice / 3).toFixed(0)} for same cabin</Text>
                        </View>
                      </View>
                    </>
                  );
                })()}
              </View>
            )}



            {/* Enhanced Financial Analysis (hidden for compact) */}
            {false && (
            <View style={styles.detailsSection}>
              <View style={styles.sectionHeader}>
                <DollarSign size={20} color="#22C55E" />
                <Text style={styles.sectionTitle}>Financial Analysis</Text>
              </View>
              
              {/* Retail vs Paid Comparison */}
              <View style={styles.comparisonCard}>
                <Text style={styles.comparisonTitle}>💰 Retail Price vs Amount Paid</Text>
                <View style={styles.comparisonRow}>
                  <View style={styles.comparisonItem}>
                    <Text style={styles.comparisonLabel}>Retail Cabin Price</Text>
                    <Text style={styles.retailPriceValue}>${Number((cruise as any).retailPrice ?? 0).toLocaleString()}</Text>
                    <Text style={styles.comparisonSubtext}>Market value</Text>
                  </View>
                  <View style={styles.comparisonVs}>
                    <Text style={styles.vsText}>VS</Text>
                  </View>
                  <View style={styles.comparisonItem}>
                    <Text style={styles.comparisonLabel}>Amount Paid</Text>
                    <Text style={styles.paidPriceValue}>${Number((cruise as any).amountPaid ?? 0).toLocaleString()}</Text>
                    <Text style={styles.comparisonSubtext}>Your cost</Text>
                  </View>
                </View>
                <View style={styles.savingsHighlight}>
                  <Text style={styles.savingsText}>
                    💎 You saved ${(Number((cruise as any).retailPrice ?? 0) - Number((cruise as any).amountPaid ?? 0)).toLocaleString()}
                  </Text>
                  <Text style={styles.savingsPercentage}>
                    ({(((Number((cruise as any).retailPrice ?? 0) - Number((cruise as any).amountPaid ?? 0)) / Math.max(Number((cruise as any).retailPrice ?? 0), 1)) * 100).toFixed(1)}% discount)
                  </Text>
                </View>
              </View>

              {/* Financial Breakdown */}
              <View style={styles.financialGrid}>
                <View style={styles.financialItem}>
                  <Text style={styles.financialLabel}>Amount Paid</Text>
                  <Text style={styles.financialValue}>${Number((cruise as any).amountPaid ?? 0).toLocaleString()}</Text>
                </View>
                <View style={styles.financialItem}>
                  <Text style={styles.financialLabel}>Taxes & Fees</Text>
                  <Text style={styles.financialValue}>${Number((cruise as any).taxesFees ?? 0).toLocaleString()}</Text>
                </View>
                <View style={styles.financialItem}>
                  <Text style={styles.financialLabel}>Casino Comp</Text>
                  <Text style={styles.financialValue}>${Number((cruise as any).casinoComp ?? 0).toLocaleString()}</Text>
                </View>
                <View style={styles.financialItem}>
                  <Text style={styles.financialLabel}>FreePlay</Text>
                  <Text style={styles.financialValue}>${Number((cruise as any).freePlay ?? 0).toLocaleString()}</Text>
                </View>
                <View style={[styles.financialItem, styles.totalItem]}>
                  <Text style={styles.financialTotalLabel}>Net Out-of-Pocket</Text>
                  <Text style={styles.financialTotalValue}>${Number(((cruise as any).amountPaid ?? 0) + ((cruise as any).taxesFees ?? 0)).toLocaleString()}</Text>
                </View>
              </View>
            </View>
            )}

            {/* Certificates */}
            <View>
              <CertificatesBar cruiseId={String(cruise.id)} testID="certificates-bar" />
            </View>

            {/* Pricing & Historical Pricing Section */}
            <View style={styles.detailsSection} testID="pricing-history-section">
              <View style={styles.sectionHeader}>
                <DollarSign size={20} color="#3B82F6" />
                <Text style={styles.sectionTitle}>Pricing & History</Text>
              </View>

              {(() => {
                const c: any = cruise as any;
                const current = c?.pricingCurrent ?? {};
                const lowest = c?.pricingLowest ?? {};
                
                // Read pricing from multiple sources with proper fallback
                const getPrice = (pricingField: string | null | undefined, directField: number | null | undefined): number | null => {
                  if (typeof pricingField === 'number' && pricingField > 0) return pricingField;
                  if (typeof directField === 'number' && directField > 0) return directField;
                  return null;
                };

                const rows: Array<{ key: 'Interior'|'Oceanview'|'Balcony'|'Suite'; now: number | null; low: number | null; editValue: string; setEditValue: (v: string) => void; }> = [
                  { 
                    key: 'Interior', 
                    now: getPrice(current?.interior, c?.interiorPrice), 
                    low: getPrice(lowest?.interior, null),
                    editValue: editInteriorPrice,
                    setEditValue: setEditInteriorPrice
                  },
                  { 
                    key: 'Oceanview', 
                    now: getPrice(current?.oceanview, c?.oceanviewPrice), 
                    low: getPrice(lowest?.oceanview, null),
                    editValue: editOceanviewPrice,
                    setEditValue: setEditOceanviewPrice
                  },
                  { 
                    key: 'Balcony', 
                    now: getPrice(current?.balcony, c?.balconyPrice), 
                    low: getPrice(lowest?.balcony, null),
                    editValue: editBalconyPrice,
                    setEditValue: setEditBalconyPrice
                  },
                  { 
                    key: 'Suite', 
                    now: getPrice(current?.suite, c?.suitePrice), 
                    low: getPrice(lowest?.suite, null),
                    editValue: editSuitePrice,
                    setEditValue: setEditSuitePrice
                  },
                ];

                const hasAnyPricing = rows.some(r => r.now !== null || r.low !== null);
                const fetchedAt = (current?.fetchedAt ?? lowest?.fetchedAt ?? null) as string | null;
                const source = (current?.source ?? lowest?.source ?? (hasAnyPricing ? 'cruises.xlsx' : null)) as string | null;

                return (
                  <>
                    <View style={styles.pricingGrid}>
                      {rows.map((r) => (
                        <View key={r.key} style={styles.priceCard}>
                          <Text style={styles.cabinType}>{r.key}</Text>
                          <View style={{ flexDirection: 'column' }}>
                            {isEditMode ? (
                              <TextInput
                                value={r.editValue}
                                onChangeText={(t: string) => r.setEditValue(t.replace(/[^0-9]/g, '').slice(0, 8))}
                                keyboardType="numeric"
                                style={{ fontSize: 16, fontWeight: '600', backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 6, color: '#22C55E' }}
                                placeholder="0"
                                testID={`edit-${r.key.toLowerCase()}-price`}
                              />
                            ) : (
                              <Text style={styles.priceValue}>
                                {r.now !== null && r.now > 0 ? `${Math.round(r.now).toLocaleString()}` : '—'}
                              </Text>
                            )}
                            <Text style={styles.priceSubtext}>current • per person</Text>
                          </View>
                          <View style={{ marginTop: 6 }}>
                            <Text style={[styles.priceSubtext, { color: '#059669' }]}>
                              {r.low !== null && r.low > 0 ? `lowest seen ${Math.round(r.low).toLocaleString()}` : 'lowest seen —'}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>

                    <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', marginTop: 12 }}>
                      <Text style={{ fontSize: 12, color: '#6B7280' }}>
                        {source ? `Source: ${source}` : 'Source: —'}{fetchedAt ? ` • Updated ${new Date(fetchedAt).toLocaleDateString()}` : ''}
                      </Text>
                    </View>

                    <View style={{ backgroundColor: '#FFF7ED', borderRadius: 8, padding: 12, marginTop: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 14, color: '#9A3412', fontWeight: '600' }}>Port Taxes & Fees</Text>
                        {isEditMode ? (
                          <TextInput
                            value={editPortTaxes}
                            onChangeText={(t: string) => setEditPortTaxes(t.replace(/[^0-9]/g, '').slice(0, 8))}
                            keyboardType="numeric"
                            style={{ fontSize: 16, fontWeight: '700', backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 6, color: '#9A3412', minWidth: 80 }}
                            placeholder="0"
                            testID="edit-port-taxes"
                          />
                        ) : (
                          <Text style={{ fontSize: 16, fontWeight: '700', color: '#9A3412' }}>
                            {(() => {
                              const fees = (c?.portTaxesFees ?? c?.taxesFees ?? 0) as number;
                              return fees > 0 ? `${Math.round(fees).toLocaleString()}` : '—';
                            })()}
                          </Text>
                        )}
                      </View>
                      <Text style={{ fontSize: 11, color: '#9A3412', marginTop: 4 }}>per person • From cruises.xlsx database</Text>
                    </View>
                  </>
                );
              })()}
            </View>

            {/* User Loyalty Section */}
            <View style={styles.detailsSection}>
              <View style={styles.sectionHeader}>
                <Award size={20} color="#6B7280" />
                <Text style={styles.sectionTitle}>User Loyalty</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={[styles.financialItem, { flex: 1 }]}>
                  <Text style={styles.financialLabel}>Earned Points</Text>
                  {isEditMode ? (
                    <TextInput
                      value={editPointsEarned}
                      onChangeText={(t: string) => setEditPointsEarned(t.replace(/[^0-9]/g, '').slice(0, 6))}
                      keyboardType="numeric"
                      style={[styles.editableFinancialValue, { fontSize: 18, fontWeight: '800', color: '#3B82F6' }]}
                      placeholder="0"
                      testID="edit-earned-points"
                    />
                  ) : (
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#3B82F6' }}>
                      {((cruise as any)?.pointsEarned ?? (cruise as any)?.cruisePointsEarned ?? 0).toLocaleString()} pts
                    </Text>
                  )}
                  <Text style={styles.financialSubtext}>Club Royale Points</Text>
                </View>
              </View>
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8 }}>Win/Loss Data</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, color: '#6B7280' }}>Winnings:</Text>
                  {isEditMode ? (
                    <TextInput
                      value={editWinLoss}
                      onChangeText={(t: string) => setEditWinLoss(t.replace(/[^0-9.-]/g, '').slice(0, 8))}
                      keyboardType="numeric"
                      style={[styles.editableFinancialValue, { fontSize: 14, fontWeight: '600' }]}
                      placeholder="0"
                      testID="edit-win-loss"
                    />
                  ) : (
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>
                      ${((cruise as any)?.winnings ?? (cruise as any)?.winningsBroughtHome ?? 0).toLocaleString()}
                    </Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: '#6B7280' }}>Net Result:</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: ((cruise as any)?.winnings ?? 0) >= 0 ? '#16A34A' : '#DC2626' }}>
                    ${Math.abs((cruise as any)?.winnings ?? (cruise as any)?.winningsBroughtHome ?? 0).toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Pricing - Removed per user request */}
          </View>
        </ScrollView>
        
        {/* Actions */}
        <View style={styles.actionSection}>
          {fveUpdate && (
            <View style={styles.fveBanner} testID="fve-updated-banner">
              <Sparkles size={18} color="#1D4ED8" />
              <Text style={styles.fveBannerText}>Future Value Updated</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.fveBannerValue}>${fveUpdate.total.toLocaleString()}</Text>
              <Text style={styles.fveBannerRoi}>{Math.round(fveUpdate.roi * 100)}%</Text>
            </View>
          )}
          {isEditMode && (
            <View style={styles.editModeBar}>
              <Text style={styles.editModeText}>Editing Mode</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.editModeSaveButton}
                  onPress={async () => {
                    const win = parseFloat(editWinLoss.replace(/[^0-9.-]/g, ''));
                    const safeWin = Number.isFinite(win) ? Math.round(win) : 0;
                    const pts = Math.max(0, parseInt(editPointsEarned.replace(/[^0-9]/g, ''), 10) || 0);
                    const amt = Math.max(0, parseInt(editAmountPaid.replace(/[^0-9]/g, ''), 10) || 0);
                    const tax = Math.max(0, parseInt(editTaxesFees.replace(/[^0-9]/g, ''), 10) || 0);
                    const comp = Math.max(0, parseInt(editCasinoComp.replace(/[^0-9]/g, ''), 10) || 0);
                    const free = Math.max(0, parseInt(editFreePlay.replace(/[^0-9]/g, ''), 10) || 0);
                    const interior = Math.max(0, parseInt(editInteriorPrice.replace(/[^0-9]/g, ''), 10) || 0);
                    const oceanview = Math.max(0, parseInt(editOceanviewPrice.replace(/[^0-9]/g, ''), 10) || 0);
                    const balcony = Math.max(0, parseInt(editBalconyPrice.replace(/[^0-9]/g, ''), 10) || 0);
                    const suite = Math.max(0, parseInt(editSuitePrice.replace(/[^0-9]/g, ''), 10) || 0);
                    const portTaxes = Math.max(0, parseInt(editPortTaxes.replace(/[^0-9]/g, ''), 10) || 0);
                    const portsRoute = editPortsAndTimes.trim();
                    if (hasLocalData && updateCruise) {
                      await updateCruise(String(cruise.id), {
                        winnings: safeWin,
                        pointsEarned: pts,
                        amountPaid: amt,
                        taxesFees: tax,
                        casinoComp: comp,
                        freePlay: free,
                        pricingCurrent: {
                          interior,
                          oceanview,
                          balcony,
                          suite,
                          source: 'Manual Entry',
                          fetchedAt: new Date().toISOString(),
                        },
                        portTaxesFees: portTaxes,
                        portsRoute,
                      });
                      Object.assign(cruise, {
                        winnings: safeWin,
                        pointsEarned: pts,
                        amountPaid: amt,
                        taxesFees: tax,
                        casinoComp: comp,
                        freePlay: free,
                        pricingCurrent: {
                          interior,
                          oceanview,
                          balcony,
                          suite,
                          source: 'Manual Entry',
                          fetchedAt: new Date().toISOString(),
                        },
                        portTaxesFees: portTaxes,
                        portsRoute,
                      });
                    }
                    setIsEditMode(false);
                  }}
                  testID="save-all-button"
                >
                  <Save size={16} color="#FFFFFF" />
                  <Text style={styles.editModeSaveText}>Save All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editModeCancelButton}
                  onPress={() => setIsEditMode(false)}
                  testID="cancel-edit-button"
                >
                  <X size={16} color="#FFFFFF" />
                  <Text style={styles.editModeCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {!isEditMode && (
            <View style={styles.actionsRow}>
              <TouchableOpacity 
                style={[styles.schedulingActionButton, styles.pillEqual]}
                testID="book-cruise-button"
                onPress={() => {
                  console.log(`[CruiseDetail] Booking cruise ${cruise.id}`);
                  router.push(`/book-cruise?cruiseId=${encodeURIComponent(cruise.id)}`);
                }}
              >
                <Text style={styles.schedulingActionButtonText}>Book Cruise</Text>
              </TouchableOpacity>
              {isCruiseBooked ? (
                <TouchableOpacity 
                  style={[styles.schedulingActionButton, styles.pillEqual]}
                  testID="unbook-cruise-button"
                  onPress={() => {
                    try {
                      console.log('[CruiseDetail] Unbook action', (cruise as any).id, (cruise as any).ship, (cruise as any).departureDate);
                      unbookCruise({ id: (cruise as any).id, ship: (cruise as any).ship ?? undefined, startDate: (cruise as any).departureDate ?? undefined, departureDate: (cruise as any).departureDate ?? undefined });
                    } catch (e) {
                      console.error('[CruiseDetail] Unbook failed', e);
                    }
                  }}
                >
                  <Text style={styles.schedulingActionButtonText}>Unbook</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity 
                style={[styles.schedulingActionButton, styles.pillEqual, isRefreshing && styles.disabledButton]}
                testID="refresh-web-data-button"
                onPress={() => {
                  const shipName = String((cruise as any)?.ship ?? '');
                  const depDate = String((cruise as any)?.departureDate ?? (cruise as any)?.startDate ?? '');
                  const args = { ship: shipName, depDate };
                  if (Platform.OS === 'web') {
                    setPendingFetch(args);
                    setShowConfirm(true);
                  } else {
                    void performFetch(args);
                  }
                }}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color="#003B6F" />
                ) : (
                  <Globe size={16} color="#003B6F" />
                )}
                <Text style={[styles.schedulingActionButtonText, isRefreshing && styles.disabledButtonText]}>
                  {isRefreshing ? (scrapingStatus || 'Updating...') : 'Fetch Pricing'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <Modal
        visible={showConfirm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConfirm(false)}
      >
        <View style={styles.confirmSheetContainer}>
          <View style={styles.confirmSheetContent}>
            <Text style={styles.confirmTitle}>Fetch Current Pricing?</Text>
            <Text style={styles.confirmText}>
              This will fetch live pricing and itinerary data for
              {` ${pendingFetch?.ship ?? ''}`} departing {pendingFetch?.depDate ?? ''}.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmCancel]}
                onPress={() => setShowConfirm(false)}
                testID="confirm-cancel"
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmPrimary]}
                onPress={() => {
                  if (pendingFetch) {
                    setShowConfirm(false);
                    void performFetch(pendingFetch);
                  } else {
                    setShowConfirm(false);
                  }
                }}
                testID="confirm-fetch-pricing"
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmPrimaryText}>Fetch Now</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  headerBackButton: {
    padding: 8,
  },
  errorBackButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  errorBackButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  shipName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3B82F6',
    marginBottom: 4,
    flexWrap: 'wrap',
    lineHeight: 28,
  },
  cruiseSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  daysToGo: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  daysToGoText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  departureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  departureText: {
    fontSize: 14,
    color: '#374151',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
  },
  cruiseMetrics: {
    flexDirection: 'row',
    gap: 16,
  },
  metricItem: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  itineraryDescription: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
  },
  itineraryAlert: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D97706',
    marginBottom: 4,
  },
  alertDescription: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  unbookButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  unbookButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  pricingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  priceCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    alignItems: 'flex-start',
  },
  cabinType: {
    fontSize: 12,
    color: '#22C55E',
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22C55E',
  },
  priceSubtext: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  priceNote: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  bookingCard: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
  },
  bookingLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  bookingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  receiptCard: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 8,
  },
  receiptTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D97706',
    marginBottom: 8,
  },
  receiptDescription: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  actionSection: {
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  editModeBar: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  editModeText: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '700',
  },
  editModeSaveButton: {
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  editModeSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  editModeCancelButton: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  editModeCancelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  schedulingActionButton: {
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  schedulingActionButtonText: {
    color: '#003B6F',
    fontSize: 14,
    fontWeight: '700',
  },
  fveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  fveBannerText: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  fveBannerValue: {
    color: '#111827',
    fontWeight: '800',
    marginRight: 8,
  },
  fveBannerRoi: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pillButtonPrimary: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  pillButtonSuccess: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillButtonSuccessText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  pillButtonDanger: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillButtonDangerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
    gap: 8,
  },
  pillButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderColor: '#3B82F6',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillEqual: {
    flex: 1,
    justifyContent: 'center',
  },
  pillButtonSecondaryText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
  },
  // Tab styles
  tabNavigation: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabScrollView: {
    paddingHorizontal: 16,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#EBF8FF',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  tabContentContainer: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  // Overview tab styles
  shipImageContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  shipImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 16,
  },
  shipNameOverlay: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  cruiseLineOverlay: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.9,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statItem: {
    alignItems: 'center',
    gap: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  detailsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  statusBadge: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  amenitiesSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  amenityItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  amenityIcon: {
    fontSize: 20,
  },
  amenityText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
  },
  // Itinerary tab styles
  itineraryDay: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  dayNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dayInfo: {
    flex: 1,
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  dayLocation: {
    fontSize: 14,
    color: '#6B7280',
  },
  dayDetails: {
    paddingLeft: 44,
  },
  timeSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  timeText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  dayDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  // Pricing tab styles
  priceLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  selectButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  pricingNotes: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  notesText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  // Reviews tab styles
  reviewsHeader: {
    marginBottom: 16,
  },
  ratingOverview: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  overallRating: {
    alignItems: 'center',
    gap: 8,
  },
  ratingNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#F59E0B',
  },
  stars: {
    flexDirection: 'row',
    gap: 4,
  },
  reviewCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 'auto',
  },
  reviewText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledButtonText: {
    opacity: 0.6,
  },
  pricingUpdateBanner: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  pricingUpdateText: {
    fontSize: 14,
    color: '#15803D',
    fontWeight: '500',
    textAlign: 'center',
  },
  // Casino Analytics Styles
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  analyticsOverview: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  analyticsCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  analyticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  analyticsTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  analyticsValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  analyticsSubtext: {
    fontSize: 11,
    color: '#64748B',
  },
  recommendationBox: {
    backgroundColor: '#EBF8FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  recommendationText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  analyticsDetails: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  analyticsDetailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  analyticsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  analyticsLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  analyticsDetailValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  totalValueText: {
    color: '#22C55E',
    fontSize: 16,
  },
  recommendationsSection: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#15803D',
    marginBottom: 12,
  },
  recommendationItem: {
    fontSize: 13,
    color: '#15803D',
    marginBottom: 6,
    lineHeight: 18,
  },
  noAnalyticsBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  noAnalyticsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D97706',
    marginBottom: 8,
  },
  noAnalyticsText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 20,
  },
  userStatsBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  userStatsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  userStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  userStatsLabel: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  // Value Analysis Styles
  valueAnalysisCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  valueAnalysisTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#15803D',
    textAlign: 'center',
    marginBottom: 4,
  },
  valueAnalysisSubtitle: {
    fontSize: 14,
    color: '#15803D',
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.8,
  },
  valueBreakdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  valueLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  valueAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  savingsRow: {
    backgroundColor: '#ECFDF5',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  savingsLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#15803D',
    flex: 1,
  },
  savingsAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#15803D',
  },
  pointsAnalysis: {
    backgroundColor: '#EBF8FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  pointsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 12,
    textAlign: 'center',
  },
  pointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pointsLabel: {
    fontSize: 14,
    color: '#1E40AF',
    flex: 1,
  },
  pointsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
  },
  pointsHighlight: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E40AF',
  },
  pointsNote: {
    fontSize: 12,
    color: '#1E40AF',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  valueInsights: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 12,
    textAlign: 'center',
  },
  insightItem: {
    fontSize: 13,
    color: '#92400E',
    marginBottom: 6,
    lineHeight: 18,
  },
  
  // Booked cruise styles
  bookedBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  bookedBadgeText: {
    backgroundColor: '#22C55E',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reservationText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
  },
  bookedStatusSection: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  bookedStatusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#15803D',
    marginBottom: 4,
  },
  bookedStatusSubtitle: {
    fontSize: 14,
    color: '#15803D',
    fontWeight: '500',
  },
  offerCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    minHeight: 18,
  },
  offerCodeChip: {
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  offerCodeChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  
  // Modern Itinerary Styles
  itineraryHeader: {
    marginBottom: 20,
  },
  pillInfo: {
    backgroundColor: '#EBF8FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillInfoText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
  },
  itinerarySubtitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  itineraryNote: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  itineraryWarning: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  modernItineraryDay: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modernDayHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  modernDayLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12,
  },
  modernDayIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  departureIcon: {
    backgroundColor: '#EBF8FF',
  },
  seaIcon: {
    backgroundColor: '#F0F9FF',
  },
  seaWaveIcon: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
  },
  modernDayInfo: {
    flex: 1,
  },
  modernDayTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  todayTitle: {
    color: '#3B82F6',
  },
  viewingLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
  },
  modernDayDate: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  modernPortName: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  modernTimesContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  modernTimeSlot: {
    alignItems: 'flex-end',
  },
  modernTimeLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
  },
  modernTimeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
  },
  seaDayLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  changeShipButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  changeShipButtonText: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '500',
  },
  
  // Edit mode styles
  headerRightContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  editableShipName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3B82F6',
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 4,
  },
  editableDetailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 4,
    minHeight: 24,
  },
  editablePriceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22C55E',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 4,
    textAlign: 'center',
    minWidth: 80,
  },
  
  // Inline confirmation sheet styles
  confirmSheetContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  confirmSheetContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancel: {
    backgroundColor: '#F3F4F6',
  },
  confirmPrimary: {
    backgroundColor: '#3B82F6',
  },
  confirmCancelText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '700',
  },
  confirmPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  
  // Document upload styles
  documentSectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  documentUploadGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  documentUploadCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 120,
  },
  documentUploadCardDisabled: {
    opacity: 0.6,
  },
  documentUploadIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EBF8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  documentUploadTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    textAlign: 'center',
  },
  documentUploadDescription: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  documentUploadNote: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  
  finKpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  finKpiItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    alignItems: 'center',
  },
  finKpiLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  finKpiValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  
  // Receipt and Statement Data Styles
  receiptDataCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  receiptDataTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#15803D',
    marginBottom: 12,
    textAlign: 'center',
  },
  receiptDataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  receiptDataItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  receiptDataLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  receiptDataValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#15803D',
    textAlign: 'center',
  },
  statementDataCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  statementDataTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D97706',
    marginBottom: 12,
    textAlign: 'center',
  },
  statementDataGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statementDataItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statementDataLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  statementDataValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D97706',
    textAlign: 'center',
  },
  
  // Casino Overview Styles
  casinoOverviewGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  casinoOverviewItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  casinoOverviewLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  casinoOverviewValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D97706',
    textAlign: 'center',
  },
  
  // Category Breakdown Styles
  categoryBreakdownSection: {
    marginTop: 8,
  },
  categoryBreakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#D97706',
    marginBottom: 16,
    textAlign: 'center',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryItem: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
    minHeight: 80,
  },
  categoryIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  categoryLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 14,
  },
  categoryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D97706',
    textAlign: 'center',
  },
  categoryNote: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  categoryNoteText: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  
  // Winnings Input Styles
  winningsInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#22C55E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 120,
  },
  dollarSign: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22C55E',
    marginRight: 4,
  },
  winningsInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
    minWidth: 60,
  },
  winningsDisplayContainer: {
    alignItems: 'flex-end',
    paddingVertical: 4,
  },
  winningsDisplayValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22C55E',
  },
  winningsEditHint: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 2,
  },
  
  // Financial Analysis Styles
  financialAnalysisCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  financialAnalysisTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#15803D',
    textAlign: 'center',
    marginBottom: 20,
  },
  financialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  financialItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  calculatedItem: {
    backgroundColor: '#EBF8FF',
    borderColor: '#3B82F6',
  },
  totalItem: {
    backgroundColor: '#ECFDF5',
    borderColor: '#22C55E',
    minWidth: '100%',
  },
  roiItem: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  financialLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  financialValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  financialHighlight: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
    textAlign: 'center',
  },
  financialTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#15803D',
    marginBottom: 8,
    textAlign: 'center',
  },
  financialTotalValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#15803D',
    textAlign: 'center',
  },
  roiValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#D97706',
    textAlign: 'center',
  },
  financialSubtext: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  editableFinancialValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 4,
    minWidth: 80,
  },
  financialInsights: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  
  // Points Input Styles
  pointsInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 120,
  },
  pointsLabelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
    marginLeft: 4,
  },
  pointsInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
    minWidth: 60,
  },
  pointsDisplayContainer: {
    alignItems: 'flex-end',
    paddingVertical: 4,
  },
  pointsDisplayValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  pointsEditHint: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 2,
  },
  // Expected Analysis Styles
  expectationBreakdown: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  expectationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  expectationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  expectationLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  expectationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  expectationTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
  },
  expectationTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  expectationTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  confidenceNote: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginTop: 8,
  },
  confidenceText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  // Historical Styles
  historicalGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  historicalCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  historicalLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  historicalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  historicalInsights: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historicalInsightsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  historicalInsight: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 4,
  },
  // Recommendation Styles
  recommendationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginBottom: 12,
  },
  recommendationScore: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  recommendationScoreSubtext: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  reasonsList: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  reasonsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  reasonItem: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 4,
  },
  actionAdvice: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  actionAdviceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 6,
  },
  actionAdviceText: {
    fontSize: 12,
    color: '#065F46',
    lineHeight: 18,
  },
  compareItem: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E5E7EB',
  },
  
  // Comparison Card Styles
  comparisonCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  comparisonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  comparisonItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  comparisonLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  retailPriceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 4,
  },
  paidPriceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#16A34A',
    textAlign: 'center',
    marginBottom: 4,
  },
  comparisonSubtext: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  comparisonVs: {
    marginHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  savingsHighlight: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  savingsText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#15803D',
    textAlign: 'center',
    marginBottom: 4,
  },
  savingsPercentage: {
    fontSize: 14,
    color: '#15803D',
    textAlign: 'center',
    fontWeight: '500',
  }
});