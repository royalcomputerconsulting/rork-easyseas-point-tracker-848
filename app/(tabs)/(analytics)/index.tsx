import React from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, TextInput, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '@/constants/theme';
import { HeroHeaderCompact } from '@/components/HeroHeaderCompact';
import { ClubRoyalePoints } from '@/components/ClubRoyalePoints';
import { TrendingUp, Star, DollarSign, Ship, ArrowUpDown, Brain, Loader, Trophy, Medal, ShieldCheck, AlertTriangle, Search, X } from 'lucide-react-native';
import { CruiseUnifiedCard } from '@/components/CruiseUnifiedCard';
import { useSimpleAnalytics, calculateCruiseROI, calculateValuePerPoint, calculateCoinIn, calculateRetailValue, type SimpleCruise } from '@/state/SimpleAnalyticsProvider';
import { useRouter } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { useMergedAnalytics } from '@/lib/analytics';
import { useAppState } from '@/state/AppStateProvider';
import { generateText } from '@rork-ai/toolkit-sdk';
import { useFinancials } from '@/state/FinancialsProvider';
import OfferValueRankings from '@/components/OfferValueRankings';
import { Platform } from 'react-native';

function StatCard({ title, value, subtitle, color = COLORS.primary, icon: Icon }: { 
  title: string; 
  value: string; 
  subtitle?: string; 
  color?: string;
  icon?: React.ComponentType<any>;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        {Icon && <Icon size={16} color={color} />}
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );
}

function CruiseCard({ cruise }: { cruise: SimpleCruise }) {
  const router = useRouter();
  const analytics = useSimpleAnalytics();
  const roi = calculateCruiseROI(cruise);
  const valuePerPoint = calculateValuePerPoint(cruise);
  const roiColor = roi >= 500 ? COLORS.success : roi >= 200 ? COLORS.warning : COLORS.error;
  const [showAI, setShowAI] = React.useState<boolean>(false);
  const [aiAnalysis, setAiAnalysis] = React.useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = React.useState<boolean>(false);
  const [isEditing, setIsEditing] = React.useState<boolean>(false);
  const [editPoints, setEditPoints] = React.useState<string>(String(cruise.pointsEarned ?? 0));
  const [editWinnings, setEditWinnings] = React.useState<string>(String(cruise.winnings ?? 0));

  React.useEffect(() => {
    setEditPoints(String(cruise.pointsEarned ?? 0));
    setEditWinnings(String(cruise.winnings ?? 0));
  }, [cruise.pointsEarned, cruise.winnings]);
  
  const cruiseAIMutation = trpc.analytics.cruiseAI.useMutation({
    onSuccess: (data) => {
      console.log('[3.2] AI analysis received for cruise', cruise.id);
      setAiAnalysis(data.analysis);
      setIsLoadingAI(false);
      setShowAI(true);
    },
    onError: (error) => {
      console.error('[3.2] AI analysis failed for cruise', cruise.id, error);
      setIsLoadingAI(false);
      setAiAnalysis('AI analysis temporarily unavailable. Please try again later.');
      setShowAI(true);
    },
  });
  
  const handleAIAnalysis = React.useCallback(() => {
    if (aiAnalysis && showAI) {
      setShowAI(false);
      return;
    }
    
    if (aiAnalysis) {
      setShowAI(true);
      return;
    }
    
    console.log('[3.2] Requesting AI analysis for cruise', cruise.id);
    setIsLoadingAI(true);
    cruiseAIMutation.mutate({ cruise });
  }, [cruise, aiAnalysis, showAI, cruiseAIMutation]);

  const onSaveInline = React.useCallback(async () => {
    const pts = Math.max(0, parseInt(editPoints.replace(/[^0-9]/g, ''), 10) || 0);
    const win = parseFloat(editWinnings.replace(/[^0-9.-]/g, ''));
    const safeWin = Number.isFinite(win) ? Math.round(win) : 0;
    console.log('[InlineEdit] Saving', { id: cruise.id, pts, winnings: safeWin });
    if (analytics.updateCruise) {
      await analytics.updateCruise(cruise.id, { pointsEarned: pts, winnings: safeWin });
      setIsEditing(false);
    } else {
      console.warn('[InlineEdit] updateCruise not available');
    }
  }, [analytics.updateCruise, cruise.id, editPoints, editWinnings]);

  const onCancelInline = React.useCallback(() => {
    setEditPoints(String(cruise.pointsEarned ?? 0));
    setEditWinnings(String(cruise.winnings ?? 0));
    setIsEditing(false);
  }, [cruise.pointsEarned, cruise.winnings]);
  
  const formatDate = React.useCallback((dateInput: unknown) => {
    if (dateInput === null || dateInput === undefined) return 'TBD';
    try {
      if (typeof dateInput === 'number' && Number.isFinite(dateInput)) {
        const d = new Date(dateInput);
        if (!Number.isNaN(d.getTime())) return d.toLocaleDateString();
      }
      if (typeof dateInput === 'string' && dateInput.trim().length > 0) {
        const d = new Date(dateInput);
        if (!Number.isNaN(d.getTime())) return d.toLocaleDateString();
      }
      return 'TBD';
    } catch {
      return 'TBD';
    }
  }, []);

  const safeNights = Number.isFinite(cruise.nights as number) ? (cruise.nights as number) : 0;
  const safePoints = Number.isFinite(cruise.pointsEarned as number) ? (cruise.pointsEarned as number) : 0;
  const safePaid = Number.isFinite(cruise.amountPaid as number) ? (cruise.amountPaid as number) : 0;

  return (
    <View style={styles.cruiseCard}>
      <Pressable 
        onPress={() => {
          console.log('[3.2] Navigate to cruise', cruise.id);
          router.push(`/cruise/${cruise.id}`);
        }}
        testID={`cruise-card-${cruise.id}`}
        accessibilityRole="link"
        accessibilityLabel={`Open details for ${cruise.ship} sailing`}
      >
        <View style={styles.cruiseHeader}>
          <View style={styles.cruiseInfo}>
            <Text style={styles.cruiseShip}>{cruise.ship}</Text>
            <Text style={styles.cruiseDate}>
              {formatDate(cruise.sailDate)} • {safeNights} nights
            </Text>
          </View>
          <View style={styles.cruiseHeaderActions}>
            <View style={styles.roiBadge}>
              <Text style={[styles.roiText, { color: roiColor }]}>
                {roi.toFixed(0)}%
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.aiButton, showAI && styles.aiButtonActive]}
              onPress={handleAIAnalysis}
              testID={`ai-analysis-${cruise.id}`}
              accessibilityRole="button"
              accessibilityLabel="Get AI analysis"
            >
              {isLoadingAI ? (
                <Loader size={16} color={COLORS.white} />
              ) : (
                <Brain size={16} color={COLORS.white} />
              )}
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.cruiseMetrics}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{safePoints.toLocaleString()}</Text>
            <Text style={styles.metricLabel}>Points</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>${safePaid.toFixed(0)}</Text>
            <Text style={styles.metricLabel}>Paid</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>${calculateRetailValue(cruise).toFixed(0)}</Text>
            <Text style={styles.metricLabel}>Retail</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>${valuePerPoint.toFixed(2)}</Text>
            <Text style={styles.metricLabel}>$/Pt</Text>
          </View>
        </View>
      </Pressable>

      <View style={styles.inlineEditBar}>
        {isEditing ? (
          <View style={styles.inlineEditRow}>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Points</Text>
              <TextInput
                value={editPoints}
                onChangeText={(t: string) => setEditPoints(t.replace(/[^0-9]/g, '').slice(0, 6))}
                keyboardType="numeric"
                style={styles.editInput}
                placeholder="0"
                testID={`edit-points-${cruise.id}`}
              />
            </View>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Winnings</Text>
              <TextInput
                value={editWinnings}
                onChangeText={(t: string) => setEditWinnings(t.replace(/[^0-9.-]/g, '').slice(0, 8))}
                keyboardType="numeric"
                style={styles.editInput}
                placeholder="0"
                testID={`edit-winnings-${cruise.id}`}
              />
            </View>
            <TouchableOpacity style={[styles.smallBtn, styles.saveBtn]} onPress={onSaveInline} testID={`save-inline-${cruise.id}`}>
              <Text style={styles.smallBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smallBtn, styles.cancelBtn]} onPress={onCancelInline} testID={`cancel-inline-${cruise.id}`}>
              <Text style={styles.smallBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inlineViewRow}>
            <Text style={styles.inlineText}>Quick edit points/winnings</Text>
            <TouchableOpacity style={[styles.smallBtn, styles.editBtn]} onPress={() => setIsEditing(true)} testID={`start-inline-${cruise.id}`}>
              <Text style={styles.smallBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {showAI && aiAnalysis && (
        <View style={styles.aiAnalysisContainer}>
          <View style={styles.aiAnalysisHeader}>
            <Brain size={14} color={COLORS.primary} />
            <Text style={styles.aiAnalysisTitle}>AI Casino Analysis</Text>
          </View>
          <Text style={styles.aiAnalysisText}>{aiAnalysis}</Text>
        </View>
      )}
    </View>
  );
}

type SortKey = 'roi' | 'points' | 'amountPaid' | 'retailValue' | 'valuePerPoint' | 'coinIn' | 'date' | 'ship' | 'nights';

function SmallSelect<T extends string>({ label, value, options, onChange, testID, }: { label: string; value: T; options: readonly T[] | T[]; onChange: (v: T) => void; testID?: string; }) {
  const [open, setOpen] = React.useState<boolean>(false);
  const toggle = React.useCallback(() => setOpen((o) => !o), []);
  const handleSelect = React.useCallback((v: T) => {
    console.log('[Analytics] Select change', label, v);
    onChange(v);
    setOpen(false);
  }, [onChange, label]);
  return (
    <View style={styles.selectContainer} testID={testID ? `${testID}-container` : undefined}>
      <TouchableOpacity style={styles.selectButton} onPress={toggle} testID={testID}>
        <Text style={styles.selectLabel}>{label}</Text>
        <Text style={styles.selectValue}>{String(value)}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.selectDropdown}>
          {options.map((opt) => {
            const key = String(opt);
            const active = key === String(value);
            return (
              <TouchableOpacity
                key={key}
                style={[styles.selectOption, active ? styles.selectOptionActive : undefined]}
                onPress={() => handleSelect(opt as T)}
                testID={testID ? `${testID}-option-${key}` : undefined}
              >
                <Text style={[styles.selectOptionText, active ? styles.selectOptionTextActive : undefined]}>{key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

function TopRoiBlock() {
  const query = trpc.analytics.topRoiCruises.useQuery({ limit: 5 });
  if (query.isLoading) return null;
  if (query.error) return null;
  const items = query.data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.topRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Trophy size={16} color={COLORS.success} />
          <Text style={styles.sectionTitle}>Top ROI Cruises</Text>
        </View>
      </View>
      <View style={styles.topList}>
        {items.map((it) => (
          <View key={it.cruiseId} style={styles.topItem} testID={`top-roi-${it.cruiseId}`}>
            <View style={{ flex: 1 }}>
              <Text style={styles.topItemTitle}>{it.ship}</Text>
              <Text style={styles.topItemSub}>{new Date(it.departureDate).toLocaleDateString()} • {it.nights} nights</Text>
            </View>
            <View style={styles.topItemMetrics}>
              <Text style={[styles.topItemRoi, { color: COLORS.success }]}>{it.roi.toFixed(0)}%</Text>
              <Text style={styles.topItemMeta}>${Math.round(it.savings).toLocaleString()} saved</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function PointsLeaderboardsBlock() {
  const query = trpc.analytics.pointsLeaderboards.useQuery({ limit: 5 });
  if (query.isLoading) return null;
  if (query.error) return null;
  const data = query.data;
  if (!data) return null;
  const invariantOk = data.invariant?.ok ?? false;
  return (
    <View style={styles.section}>
      <View style={styles.topRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Medal size={16} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Points Leaderboards</Text>
        </View>
        {invariantOk ? (
          <View style={styles.invariantGood}>
            <ShieldCheck size={14} color={COLORS.success} />
            <Text style={styles.invariantText}>12149 pts • 7 master cruises</Text>
          </View>
        ) : (
          <View style={styles.invariantBad}>
            <AlertTriangle size={14} color={COLORS.error} />
            <Text style={styles.invariantText}>Check points source</Text>
          </View>
        )}
      </View>

      <View style={styles.lbGrid}>
        <View style={styles.lbCol}>
          <Text style={styles.lbTitle}>Most Points</Text>
          {(data.mostPoints ?? []).map((row) => (
            <View key={`mp-${row.cruiseId}`} style={styles.lbItem} testID={`lb-most-${row.cruiseId}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.topItemTitle}>{row.ship}</Text>
                <Text style={styles.topItemSub}>{new Date(row.departureDate).toLocaleDateString()} • {row.nights} nights</Text>
              </View>
              <View style={styles.topItemMetrics}>
                <Text style={[styles.topItemRoi, { color: COLORS.primary }]}>{row.points.toLocaleString()}</Text>
                <Text style={styles.topItemMeta}>pts</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.lbCol}>
          <Text style={styles.lbTitle}>Best $/Point</Text>
          {(data.bestValuePerPoint ?? []).map((row) => (
            <View key={`vpp-${row.cruiseId}`} style={styles.lbItem} testID={`lb-vpp-${row.cruiseId}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.topItemTitle}>{row.ship}</Text>
                <Text style={styles.topItemSub}>{new Date(row.departureDate).toLocaleDateString()} • {row.nights} nights</Text>
              </View>
              <View style={styles.topItemMetrics}>
                <Text style={[styles.topItemRoi, { color: COLORS.success }]}>
                  ${row.valuePerPoint.toFixed(2)}
                </Text>
                <Text style={styles.topItemMeta}>value/pt</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.lbCol}>
          <Text style={styles.lbTitle}>Coin-In vs Risk</Text>
          {(data.highestCoinInVsRisk ?? []).map((row) => (
            <View key={`cir-${row.cruiseId}`} style={styles.lbItem} testID={`lb-cir-${row.cruiseId}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.topItemTitle}>{row.ship}</Text>
                <Text style={styles.topItemSub}>{new Date(row.departureDate).toLocaleDateString()} • {row.nights} nights</Text>
              </View>
              <View style={styles.topItemMetrics}>
                <Text style={[styles.topItemRoi, { color: COLORS.warning }]}>
                  {row.coinInToRisk.toFixed(1)}x
                </Text>
                <Text style={styles.topItemMeta}>ratio</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function RiskRankingsBlock() {
  const query = trpc.analytics.riskRankings.useQuery({ limit: 5 });
  if (query.isLoading || query.error || !query.data) return null;
  const { lowestOutOfPocket, bestRiskMultipliers, highestTotalValue } = query.data;
  if ((lowestOutOfPocket?.length ?? 0) + (bestRiskMultipliers?.length ?? 0) + (highestTotalValue?.length ?? 0) === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.topRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={16} color={COLORS.warning} />
          <Text style={styles.sectionTitle}>Risk Rankings</Text>
        </View>
      </View>
      <View style={styles.lbGrid}>
        <View style={styles.lbCol}>
          <Text style={styles.lbTitle}>Lowest Out-of-Pocket</Text>
          {(lowestOutOfPocket ?? []).map((row) => (
            <View key={`lo-${row.cruiseId}`} style={styles.lbItem} testID={`risk-lowest-${row.cruiseId}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.topItemTitle}>{row.ship}</Text>
                <Text style={styles.topItemSub}>{new Date(row.departureDate).toLocaleDateString()} • {row.nights} nights</Text>
              </View>
              <View style={styles.topItemMetrics}>
                <Text style={[styles.topItemRoi, { color: COLORS.text }]}>${Math.round(row.outOfPocket).toLocaleString()}</Text>
                <Text style={styles.topItemMeta}>out</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.lbCol}>
          <Text style={styles.lbTitle}>Best Risk Multipliers</Text>
          {(bestRiskMultipliers ?? []).map((row) => (
            <View key={`rm-${row.cruiseId}`} style={styles.lbItem} testID={`risk-mult-${row.cruiseId}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.topItemTitle}>{row.ship}</Text>
                <Text style={styles.topItemSub}>{new Date(row.departureDate).toLocaleDateString()} • {row.nights} nights</Text>
              </View>
              <View style={styles.topItemMetrics}>
                <Text style={[styles.topItemRoi, { color: COLORS.warning }]}>{row.riskMultiplier.toFixed(1)}x</Text>
                <Text style={styles.topItemMeta}>coin-in/out</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.lbCol}>
          <Text style={styles.lbTitle}>Highest Total Value</Text>
          {(highestTotalValue ?? []).map((row) => (
            <View key={`hv-${row.cruiseId}`} style={styles.lbItem} testID={`risk-value-${row.cruiseId}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.topItemTitle}>{row.ship}</Text>
                <Text style={styles.topItemSub}>{new Date(row.departureDate).toLocaleDateString()} • {row.nights} nights</Text>
              </View>
              <View style={styles.topItemMetrics}>
                <Text style={[styles.topItemRoi, { color: COLORS.success }]}>${Math.round(row.valueReceived).toLocaleString()}</Text>
                <Text style={styles.topItemMeta}>value</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function CasinoPerformanceBlock() {
  const query = trpc.analytics.casinoPerformanceLists.useQuery({ limit: 5 });
  if (query.isLoading || query.error || !query.data) return null;
  const { biggestCasinoWins, bestCasinoCompValues, mostEfficientPointEarning } = query.data;
  if ((biggestCasinoWins?.length ?? 0) + (bestCasinoCompValues?.length ?? 0) + (mostEfficientPointEarning?.length ?? 0) === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.topRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Trophy size={16} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Casino Performance</Text>
        </View>
      </View>
      <View style={styles.lbGrid}>
        <View style={styles.lbCol}>
          <Text style={styles.lbTitle}>Biggest Wins</Text>
          {(biggestCasinoWins ?? []).map((row) => (
            <View key={`bw-${row.cruiseId}`} style={styles.lbItem} testID={`perf-wins-${row.cruiseId}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.topItemTitle}>{row.ship}</Text>
                <Text style={styles.topItemSub}>{new Date(row.departureDate).toLocaleDateString()} • {row.nights} nights</Text>
              </View>
              <View style={styles.topItemMetrics}>
                <Text style={[styles.topItemRoi, { color: COLORS.success }]}>${Math.round(row.netWin).toLocaleString()}</Text>
                <Text style={styles.topItemMeta}>net</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.lbCol}>
          <Text style={styles.lbTitle}>Best Comp Values</Text>
          {(bestCasinoCompValues ?? []).map((row) => (
            <View key={`bcv-${row.cruiseId}`} style={styles.lbItem} testID={`perf-comp-${row.cruiseId}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.topItemTitle}>{row.ship}</Text>
                <Text style={styles.topItemSub}>{new Date(row.departureDate).toLocaleDateString()} • {row.nights} nights</Text>
              </View>
              <View style={styles.topItemMetrics}>
                <Text style={[styles.topItemRoi, { color: COLORS.primary }]}>${Math.round(row.compValue).toLocaleString()}</Text>
                <Text style={styles.topItemMeta}>value</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.lbCol}>
          <Text style={styles.lbTitle}>Most Efficient Earning</Text>
          {(mostEfficientPointEarning ?? []).map((row) => (
            <View key={`mep-${row.cruiseId}`} style={styles.lbItem} testID={`perf-effi-${row.cruiseId}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.topItemTitle}>{row.ship}</Text>
                <Text style={styles.topItemSub}>{new Date(row.departureDate).toLocaleDateString()} • {row.nights} nights</Text>
              </View>
              <View style={styles.topItemMetrics}>
                <Text style={[styles.topItemRoi, { color: COLORS.success }]}>${row.valuePerPoint.toFixed(2)}</Text>
                <Text style={styles.topItemMeta}>$/pt</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function ReceiptStatementCruises({ search, shipFilter, dateRange, roiFilter }: { search: string; shipFilter: string; dateRange: 'All' | '6m' | '12m' | 'ThisYear' | 'LastYear'; roiFilter: 'All' | 'High' | 'Medium' | 'Low'; }) {
  const { merged, isLoading, isError } = useMergedAnalytics();
  const router = useRouter();

  const list = React.useMemo(() => {
    const items = merged.records ?? [];
    const q = search.trim().toLowerCase();

    const bySearch = q.length > 0 ? items.filter((r) => {
      const ship = (r.ship || '').toLowerCase();
      const id = (r.cruiseId || '').toLowerCase();
      const date = new Date(r.departureDate).toLocaleDateString().toLowerCase();
      return ship.includes(q) || id.includes(q) || date.includes(q);
    }) : items;

    const byShip = shipFilter !== 'All' ? bySearch.filter((r) => r.ship === shipFilter) : bySearch;

    const now = new Date();
    const startForRange = (() => {
      const d = new Date(now);
      if (dateRange === '6m') { d.setMonth(d.getMonth() - 6); return d; }
      if (dateRange === '12m') { d.setMonth(d.getMonth() - 12); return d; }
      if (dateRange === 'ThisYear') { return new Date(now.getFullYear(), 0, 1); }
      if (dateRange === 'LastYear') { return new Date(now.getFullYear() - 1, 0, 1); }
      return null;
    })();
    const endForRange = dateRange === 'LastYear' ? new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999) : null;

    const byDate = startForRange ? byShip.filter((r) => {
      const t = new Date(r.departureDate).getTime();
      return t >= (startForRange as Date).getTime() && (endForRange ? t <= endForRange.getTime() : true);
    }) : byShip;

    const byRoi = byDate.filter((r) => {
      const roi = r.roi ?? 0;
      if (roiFilter === 'High') return roi >= 300;
      if (roiFilter === 'Medium') return roi >= 150 && roi < 300;
      if (roiFilter === 'Low') return roi < 150;
      return true;
    });

    return byRoi.sort((a, b) => new Date(b.departureDate).getTime() - new Date(a.departureDate).getTime());
  }, [merged.records, search, shipFilter, dateRange, roiFilter]);

  if (isLoading) return null;
  if (isError) return null;
  if (!list || list.length === 0) return null;

  return (
    <View style={{ gap: 12 }}>
      {list.map((r) => {
        const display = { id: r.cruiseId, ship: r.ship, departureDate: r.departureDate, returnDate: r.returnDate ?? r.departureDate, nights: r.nights ?? undefined, status: 'completed' } as any;
        return (
          <CruiseUnifiedCard
            key={r.cruiseId}
            cruise={display}
            onPress={() => {
              console.log('[Analytics] Open unified cruise', r.cruiseId);
              router.push(`/cruise/${r.cruiseId}`);
            }}
          />
        );
      })}
    </View>
  );
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const analytics = useSimpleAnalytics();
  const { userPoints } = useAppState();
  const insets = useSafeAreaInsets();
  const [sortKey, setSortKey] = React.useState<SortKey>('roi');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = React.useState<string>('');
  const [shipFilter, setShipFilter] = React.useState<string>('All');
  const [dateRange, setDateRange] = React.useState<'All' | '6m' | '12m' | 'ThisYear' | 'LastYear'>('All');
  const [roiFilter, setRoiFilter] = React.useState<'All' | 'High' | 'Medium' | 'Low'>('All');

  React.useEffect(() => {
    const loadSort = async () => {
      try {
        const [key, dir, q, ship, range, roi] = await Promise.all([
          AsyncStorage.getItem('@analytics_sort_key'),
          AsyncStorage.getItem('@analytics_sort_dir'),
          AsyncStorage.getItem('@analytics_search_q'),
          AsyncStorage.getItem('@analytics_filter_ship'),
          AsyncStorage.getItem('@analytics_filter_date_range'),
          AsyncStorage.getItem('@analytics_filter_roi'),
        ]);
        if (key && (['roi','points','amountPaid','retailValue','valuePerPoint','coinIn','date','ship','nights'] as SortKey[]).includes(key as SortKey)) {
          setSortKey(key as SortKey);
        }
        if (dir === 'asc' || dir === 'desc') setSortDir(dir);
        if (typeof q === 'string') setSearch(q);
        if (typeof ship === 'string' && ship.length > 0) setShipFilter(ship);
        if (range === 'All' || range === '6m' || range === '12m' || range === 'ThisYear' || range === 'LastYear') setDateRange(range);
        if (roi === 'All' || roi === 'High' || roi === 'Medium' || roi === 'Low') setRoiFilter(roi);
        console.log('[3.1a] Loaded sort prefs', { key, dir, q, ship, range, roi });
      } catch (e) {
        console.error('[3.1a] Failed to load sort prefs', e);
      }
    };
    loadSort();
  }, []);

  React.useEffect(() => {
    const save = async () => {
      try {
        await Promise.all([
          AsyncStorage.setItem('@analytics_sort_key', sortKey),
          AsyncStorage.setItem('@analytics_sort_dir', sortDir),
          AsyncStorage.setItem('@analytics_search_q', search),
          AsyncStorage.setItem('@analytics_filter_ship', shipFilter),
          AsyncStorage.setItem('@analytics_filter_date_range', dateRange),
          AsyncStorage.setItem('@analytics_filter_roi', roiFilter),
        ]);
        console.log('[3.1a] Saved sort prefs', { sortKey, sortDir, shipFilter, dateRange, roiFilter });
      } catch (e) {
        console.error('[3.1a] Failed to save sort prefs', e);
      }
    };
    save();
  }, [sortKey, sortDir, search, shipFilter, dateRange, roiFilter]);

  const shipOptions = React.useMemo(() => {
    const s = Array.from(new Set(analytics.cruises.map((c) => c.ship))).sort((a, b) => a.localeCompare(b));
    return ['All', ...s];
  }, [analytics.cruises]);

  const sortedCruises = React.useMemo(() => {
    const listAll = [...analytics.cruises];
    const q = search.trim().toLowerCase();
    const searched = q.length > 0 ? listAll.filter((c) => {
      const ship = c.ship?.toLowerCase() ?? '';
      const id = String(c.id ?? '').toLowerCase();
      const date = new Date(c.sailDate).toLocaleDateString().toLowerCase();
      return ship.includes(q) || id.includes(q) || date.includes(q);
    }) : listAll;

    const shipFiltered = shipFilter !== 'All' ? searched.filter((c) => c.ship === shipFilter) : searched;

    const now = new Date();
    const startForRange = (() => {
      const d = new Date(now);
      if (dateRange === '6m') { d.setMonth(d.getMonth() - 6); return d; }
      if (dateRange === '12m') { d.setMonth(d.getMonth() - 12); return d; }
      if (dateRange === 'ThisYear') { const y = new Date(now.getFullYear(), 0, 1); return y; }
      if (dateRange === 'LastYear') { const y = new Date(now.getFullYear() - 1, 0, 1); return y; }
      return null;
    })();
    const endForRange = dateRange === 'LastYear' ? new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999) : null;

    const roiMatches = (c: SimpleCruise) => {
      const r = calculateCruiseROI(c);
      if (roiFilter === 'High') return r >= 300;
      if (roiFilter === 'Medium') return r >= 150 && r < 300;
      if (roiFilter === 'Low') return r < 150;
      return true;
    };

    const dateFiltered = startForRange
      ? shipFiltered.filter((c) => {
          const d = new Date(c.sailDate);
          const afterStart = d.getTime() >= startForRange.getTime();
          const beforeEnd = endForRange ? d.getTime() <= endForRange.getTime() : true;
          return afterStart && beforeEnd;
        })
      : shipFiltered;

    const roiFiltered = dateFiltered.filter(roiMatches);

    const dir = sortDir === 'asc' ? 1 : -1;
    const retailValue = (c: SimpleCruise) => calculateRetailValue(c);
    const comparator = (a: SimpleCruise, b: SimpleCruise) => {
      if (!a || !b) return 0;
      switch (sortKey) {
        case 'roi':
          return (calculateCruiseROI(a) - calculateCruiseROI(b)) * dir;
        case 'points':
          return ((a.pointsEarned || 0) - (b.pointsEarned || 0)) * dir;
        case 'amountPaid':
          return ((a.amountPaid || 0) - ((b.amountPaid || 0))) * dir;
        case 'retailValue':
          return (retailValue(a) - retailValue(b)) * dir;
        case 'valuePerPoint':
          return (calculateValuePerPoint(a) - calculateValuePerPoint(b)) * dir;
        case 'coinIn':
          return (calculateCoinIn(a) - calculateCoinIn(b)) * dir;
        case 'date':
          return (new Date(a.sailDate).getTime() - new Date(b.sailDate).getTime()) * dir;
        case 'ship':
          return a.ship.localeCompare(b.ship) * dir;
        case 'nights':
          return ((a.nights || 0) - (b.nights || 0)) * dir;
        default:
          return 0;
      }
    };
    return roiFiltered.sort(comparator);
  }, [analytics.cruises, sortKey, sortDir, search, shipFilter, dateRange, roiFilter]);

  const toggleDir = React.useCallback(() => {
    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
  }, []);

  const SortButton = React.useMemo(() => (
    <TouchableOpacity
      style={styles.sortToggle}
      onPress={toggleDir}
      testID="sort-direction-toggle"
      accessibilityRole="button"
      accessibilityLabel="Toggle sort direction"
    >
      <ArrowUpDown size={16} color={COLORS.text} />
      <Text style={styles.sortToggleText}>{sortDir.toUpperCase()}</Text>
    </TouchableOpacity>
  ), [toggleDir, sortDir]);

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 120 }]}
      >

      <HeroHeaderCompact totalCruises={analytics.totals.totalCruises} />

      <View style={styles.statsGrid}>
        <StatCard 
          title="Total Cruises" 
          value={analytics.totals.totalCruises.toString()} 
          subtitle="Completed"
          color={COLORS.primary}
          icon={Ship}
        />
        <StatCard 
          title="Total Points" 
          value={userPoints.toLocaleString()}
          subtitle="Club Royale Points"
          color={COLORS.primary}
          icon={Star}
        />
        <StatCard 
          title="Portfolio ROI" 
          value={`${analytics.totals.averageROI.toFixed(0)}%`} 
          subtitle="Cruise Portfolio"
          color={COLORS.success}
          icon={TrendingUp}
        />
        <StatCard 
          title="Total Savings" 
          value={`${Math.round(analytics.totals.totalSavings).toLocaleString()}`} 
          subtitle="vs Retail"
          color={COLORS.success}
          icon={DollarSign}
        />
        <StatCard 
          title="Total $ Spent on Cruises" 
          value={`${Math.round(analytics.totals.totalAmountPaid).toLocaleString()}`} 
          subtitle={`${analytics.totals.totalCruises} cruises`}
          color={COLORS.text}
          icon={DollarSign}
        />
        <StatCard 
          title="Total $ Spent in Port Taxes" 
          value={`${Math.round(analytics.cruises.reduce((sum, c) => sum + (c.taxesFees || 0), 0)).toLocaleString()}`} 
          subtitle={`${analytics.totals.totalCruises} cruises`}
          color={COLORS.text}
          icon={DollarSign}
        />
      </View>
      {/* Loyalty Card at top of Analytics */}
      <View style={{ marginBottom: 16 }}>
        <ClubRoyalePoints />
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsSection}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            console.log('[Analytics] Agent X button tapped');
            router.push('/agent-x');
          }}
          testID="open-agent-x-btn"
          accessibilityRole="button"
          accessibilityLabel="Open Agent X"
        >
          <Brain size={18} color={COLORS.white} />
          <Text style={styles.actionButtonText}>Agent X</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            console.log('[Analytics] Open Intelligence button tapped');
            router.push('/(tabs)/(analytics)/intelligence');
          }}
          testID="open-intelligence-btn"
          accessibilityRole="button"
          accessibilityLabel="Open Intelligence analytics"
        >
          <Brain size={18} color={COLORS.white} />
          <Text style={styles.actionButtonText}>Intelligence</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            console.log('[Analytics] Open Charts button tapped');
            router.push('/(tabs)/(analytics)/charts');
          }}
          testID="open-charts-btn"
          accessibilityRole="button"
          accessibilityLabel="Open Charts & Trends"
        >
          <TrendingUp size={18} color={COLORS.white} />
          <Text style={styles.actionButtonText}>Charts</Text>
        </TouchableOpacity>
      </View>

      {/* Agent X Last Cruise Critique */}
      <AgentXCritiqueSection />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Portfolio Performance</Text>
        <View style={styles.performanceGrid}>
          <View style={styles.performanceCard}>
            <Text style={styles.performanceLabel}>Coin-In</Text>
            <Text style={styles.performanceValue}>
              ${analytics.totals.totalCoinIn.toLocaleString()}
            </Text>
            <Text style={styles.performanceSubtext}>Casino's View</Text>
          </View>
          <View style={styles.performanceCard}>
            <Text style={styles.performanceLabel}>Actual Risk</Text>
            <Text style={styles.performanceValue}>
              ${analytics.totals.totalActualRisk.toLocaleString()}
            </Text>
            <Text style={styles.performanceSubtext}>Your Reality</Text>
          </View>
          <View style={styles.performanceCard}>
            <Text style={styles.performanceLabel}>Risk Multiplier</Text>
            <Text style={styles.performanceValue}>
              {(analytics.totals.totalCoinIn / analytics.totals.totalActualRisk).toFixed(1)}x
            </Text>
            <Text style={styles.performanceSubtext}>Inflation Ratio</Text>
          </View>
        </View>
      </View>

      <TopRoiBlock />

      <RiskRankingsBlock />

      <CasinoPerformanceBlock />

      <OfferValueRankingsBlock />

      <View style={styles.section}>
        <View style={styles.portfolioHeader}>
          <Text style={styles.sectionTitle}>Cruise Portfolio</Text>
          
          {/* Tabs like Scheduling */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, roiFilter === 'All' && styles.tabActive]}
              onPress={() => setRoiFilter('All')}
              testID="tab-all"
            >
              <Text style={[styles.tabText, roiFilter === 'All' && styles.tabTextActive]}>
                All ({sortedCruises.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, roiFilter === 'High' && styles.tabActive]}
              onPress={() => setRoiFilter('High')}
              testID="tab-high"
            >
              <Text style={[styles.tabText, roiFilter === 'High' && styles.tabTextActive]}>
                High ROI
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, roiFilter === 'Medium' && styles.tabActive]}
              onPress={() => setRoiFilter('Medium')}
              testID="tab-medium"
            >
              <Text style={[styles.tabText, roiFilter === 'Medium' && styles.tabTextActive]}>
                Medium ROI
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, roiFilter === 'Low' && styles.tabActive]}
              onPress={() => setRoiFilter('Low')}
              testID="tab-low"
            >
              <Text style={[styles.tabText, roiFilter === 'Low' && styles.tabTextActive]}>
                Low ROI
              </Text>
            </TouchableOpacity>
          </View>

          {/* Filters Row */}
          <View style={styles.filtersRow}>
            <SmallSelect
              label="Ship"
              value={shipFilter as string}
              options={shipOptions as string[]}
              onChange={(v) => setShipFilter(v)}
              testID="select-ship"
            />
            <SmallSelect
              label="Date"
              value={dateRange}
              options={["All","6m","12m","ThisYear","LastYear"]}
              onChange={(v) => setDateRange(v as typeof dateRange)}
              testID="select-date"
            />
            <SmallSelect
              label="Sort"
              value={sortKey}
              options={['roi', 'points', 'amountPaid', 'retailValue', 'valuePerPoint', 'coinIn', 'date', 'ship', 'nights'] as SortKey[]}
              onChange={(v) => setSortKey(v as SortKey)}
              testID="select-sort"
            />
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Search size={18} color="#6B7280" />
            <TextInput
              value={search}
              onChangeText={(t: string) => {
                const clean = t.length > 100 ? t.slice(0, 100) : t;
                setSearch(clean);
              }}
              placeholder="Search ship, ID, date"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInputNew}
              testID="analytics-search-input"
              accessibilityLabel="Search cruises"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={18} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>

          {/* Mini Stats */}
          <View style={styles.miniStats}>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatNumber}>{sortedCruises.length}</Text>
              <Text style={styles.miniStatLabel}>showing</Text>
            </View>
            <Text style={styles.miniStatDivider}>•</Text>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatNumber}>{analytics.cruises.length}</Text>
              <Text style={styles.miniStatLabel}>total</Text>
            </View>
            <Text style={styles.miniStatDivider}>•</Text>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatNumber}>{sortDir}</Text>
              <Text style={styles.miniStatLabel}>order</Text>
            </View>
            <TouchableOpacity onPress={toggleDir} style={styles.miniStatAction}>
              <ArrowUpDown size={14} color={"#003B6F"} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cruiseList}>
          {sortedCruises.map((cruise) => (
            <CruiseCard key={cruise.id} cruise={cruise} />
          ))}
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

function OfferValueRankingsBlock() {
  const [dateFilter, setDateFilter] = React.useState<'All' | '3m' | '6m' | '12m'>('All');
  const [cabinFilter, setCabinFilter] = React.useState<'All' | 'Interior' | 'Oceanview' | 'Balcony' | 'Suite'>('All');
  const [shipFilter, setShipFilter] = React.useState<string>('All');
  const [sortBy, setSortBy] = React.useState<'value' | 'sailings' | 'average'>('value');
  const [offerTab, setOfferTab] = React.useState<'overall' | 'jackpot'>('overall');
  const router = useRouter();

  const rankingsQuery = trpc.casinoOffers.getOfferRankings.useQuery();
  const offersQuery = trpc.casinoOffers.list.useQuery();

  const shipOptions = React.useMemo(() => {
    if (!offersQuery.data) return ['All'];
    const ships = Array.from(new Set(offersQuery.data
      .map(o => o.shipName)
      .filter((s): s is string => !!s)
    )).sort();
    return ['All', ...ships];
  }, [offersQuery.data]);

  const filteredRankings = React.useMemo(() => {
    if (!rankingsQuery.data || !offersQuery.data) {
      return { overallStrength: [], singleSailingJackpot: [] };
    }

    const now = new Date();
    const filterDate = (() => {
      if (dateFilter === 'All') return null;
      const d = new Date(now);
      if (dateFilter === '3m') d.setMonth(d.getMonth() - 3);
      if (dateFilter === '6m') d.setMonth(d.getMonth() - 6);
      if (dateFilter === '12m') d.setMonth(d.getMonth() - 12);
      return d;
    })();

    const filterOffers = (offerCode: string) => {
      const offers = offersQuery.data.filter(o => o.offerCode === offerCode);
      if (offers.length === 0) return true;

      return offers.some(offer => {
        if (dateFilter !== 'All' && filterDate && offer.sailingDate) {
          const sailDate = new Date(offer.sailingDate);
          if (sailDate < filterDate) return false;
        }

        if (cabinFilter !== 'All' && offer.normalizedCabinType !== cabinFilter.toUpperCase()) {
          return false;
        }

        if (shipFilter !== 'All' && offer.shipName !== shipFilter) {
          return false;
        }

        return true;
      });
    };

    const filterList = (list: typeof rankingsQuery.data.overallStrength) => {
      if (!list) return [];
      return list.filter(offer => filterOffers(offer.offerCode));
    };

    let overall = filterList(rankingsQuery.data.overallStrength);
    let jackpot = filterList(rankingsQuery.data.singleSailingJackpot);

    if (sortBy === 'sailings') {
      overall = [...overall].sort((a, b) => b.numSailings - a.numSailings);
      jackpot = [...jackpot].sort((a, b) => b.numSailings - a.numSailings);
    } else if (sortBy === 'average') {
      overall = [...overall].sort((a, b) => b.avgCompValue - a.avgCompValue);
      jackpot = [...jackpot].sort((a, b) => b.avgCompValue - a.avgCompValue);
    }

    return { overallStrength: overall, singleSailingJackpot: jackpot };
  }, [rankingsQuery.data, offersQuery.data, dateFilter, cabinFilter, shipFilter, sortBy]);

  const exportToCSV = React.useCallback(async () => {
    if (!filteredRankings) return;
    
    setIsExporting(true);
    try {
      const { overallStrength } = filteredRankings;
      
      const csvHeader = 'Rank,Offer Code,Offer Name,Total Comp Value,Num Sailings,Avg Value Per Sailing,Max Sailing Value\n';
      const csvRows = overallStrength.map((offer, idx) => 
        `${idx + 1},"${offer.offerCode}","${offer.offerName}",${offer.totalCompValue},${offer.numSailings},${offer.avgCompValue},${offer.maxSailingValue}`
      ).join('\n');
      
      const csv = csvHeader + csvRows;
      const fileName = `offer-rankings-${new Date().toISOString().slice(0, 10)}.csv`;
      
      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        console.log('[Analytics] Exported offer rankings to', fileName);
      } else {
        console.log('[Analytics] Export CSV on mobile - feature needs implementation');
        alert('Export feature is available on web. Please use the web version to export rankings.');
      }
    } catch (error) {
      console.error('[Analytics] Failed to export rankings:', error);
    } finally {
      setIsExporting(false);
    }
  }, [filteredRankings]);

  if (rankingsQuery.isLoading) return null;
  if (rankingsQuery.error) return null;
  if (!rankingsQuery.data) return null;

  return (
    <View style={styles.section}>
      <View style={styles.offerRankingsHeader}>
        <Text style={styles.sectionTitle}>Casino Offer Value Rankings</Text>
        
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, offerTab === 'overall' && styles.tabActive]}
            onPress={() => setOfferTab('overall')}
            testID="offer-tab-overall"
          >
            <Text style={[styles.tabText, offerTab === 'overall' && styles.tabTextActive]}>
              Overall
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, offerTab === 'jackpot' && styles.tabActive]}
            onPress={() => setOfferTab('jackpot')}
            testID="offer-tab-jackpot"
          >
            <Text style={[styles.tabText, offerTab === 'jackpot' && styles.tabTextActive]}>
              Jackpot
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filters Row - Same as Scheduling */}
        <View style={styles.offerFiltersRow}>
          {/* Date Range */}
          <View style={styles.offerFilterSection}>
            <Text style={styles.offerFilterLabel}>Date</Text>
            <View style={styles.offerFilterChips}>
              {(['All', '3m', '6m', '12m'] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.offerFilterChip,
                    dateFilter === option && styles.offerFilterChipActive
                  ]}
                  onPress={() => setDateFilter(option)}
                  testID={`date-filter-${option}`}
                >
                  <Text style={[
                    styles.offerFilterText,
                    dateFilter === option && styles.offerFilterTextActive
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Cabin Type */}
          <View style={styles.offerFilterSection}>
            <Text style={styles.offerFilterLabel}>Cabin</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.offerFilterChips}>
                {(['All', 'Interior', 'Oceanview', 'Balcony', 'Suite'] as const).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.offerFilterChip,
                      cabinFilter === option && styles.offerFilterChipActive
                    ]}
                    onPress={() => setCabinFilter(option)}
                    testID={`cabin-filter-${option}`}
                  >
                    <Text style={[
                      styles.offerFilterText,
                      cabinFilter === option && styles.offerFilterTextActive
                    ]}>
                      {option === 'All' ? 'All' : option.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Ship */}
          <View style={styles.offerFilterSection}>
            <Text style={styles.offerFilterLabel}>Ship</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.offerFilterChips}>
                {shipOptions.slice(0, 5).map((ship) => (
                  <TouchableOpacity
                    key={ship}
                    style={[
                      styles.offerFilterChip,
                      shipFilter === ship && styles.offerFilterChipActive
                    ]}
                    onPress={() => setShipFilter(ship)}
                    testID={`ship-filter-${ship}`}
                  >
                    <Text style={[
                      styles.offerFilterText,
                      shipFilter === ship && styles.offerFilterTextActive
                    ]}>
                      {ship}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Sort */}
          <View style={styles.offerFilterSection}>
            <Text style={styles.offerFilterLabel}>Sort</Text>
            <View style={styles.offerFilterChips}>
              {([['value', 'Value'], ['sailings', 'Count'], ['average', 'Avg']] as const).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.offerFilterChip,
                    sortBy === key && styles.offerFilterChipActive
                  ]}
                  onPress={() => setSortBy(key)}
                  testID={`sort-${key}`}
                >
                  <Text style={[
                    styles.offerFilterText,
                    sortBy === key && styles.offerFilterTextActive
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Clear Filters Button */}
        {(dateFilter !== 'All' || cabinFilter !== 'All' || shipFilter !== 'All' || sortBy !== 'value') && (
          <TouchableOpacity
            style={styles.clearAllFiltersButton}
            onPress={() => {
              setDateFilter('All');
              setCabinFilter('All');
              setShipFilter('All');
              setSortBy('value');
            }}
            testID="clear-offer-filters"
          >
            <X size={14} color="#6B7280" />
            <Text style={styles.clearAllFiltersText}>Clear All Filters</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.offerRankingsContainer}>
        <OfferValueRankings 
          dateFilter={dateFilter}
          cabinFilter={cabinFilter}
          shipFilter={shipFilter}
          sortBy={sortBy}
          activeTab={offerTab}
        />
      </View>
    </View>
  );
}

function AgentXCritiqueSection() {
  const router = useRouter();
  const analytics = useSimpleAnalytics();
  const { getAllSummaries } = useFinancials();
  const [critique, setCritique] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const lastCruise = React.useMemo(() => {
    if (analytics.cruises.length === 0) return null;
    const sorted = [...analytics.cruises].sort((a, b) => 
      new Date(b.sailDate).getTime() - new Date(a.sailDate).getTime()
    );
    return sorted[0];
  }, [analytics.cruises]);

  const generateCritique = React.useCallback(async () => {
    if (!lastCruise) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const summaries = getAllSummaries();
      const lastCruiseSummary = summaries.find(s => 
        s.ship.toLowerCase().includes(lastCruise.ship.toLowerCase()) &&
        new Date(s.date).toISOString().slice(0, 10) === new Date(lastCruise.sailDate).toISOString().slice(0, 10)
      );

      const roi = calculateCruiseROI(lastCruise);
      const coinIn = calculateCoinIn(lastCruise);
      const valuePerPoint = calculateValuePerPoint(lastCruise);
      const pointsPerDay = (lastCruise.pointsEarned || 0) / (lastCruise.nights || 1);

      const prompt = `You are Agent-X, an elite gambling advisor and Royal Caribbean casino expert. Analyze this cruise performance and provide a detailed critique with recommendations.

LAST CRUISE:
Ship: ${lastCruise.ship}
Date: ${new Date(lastCruise.sailDate).toLocaleDateString()}
Nights: ${lastCruise.nights || 'Unknown'}

PERFORMANCE METRICS:
• Points Earned: ${(lastCruise.pointsEarned || 0).toLocaleString()}
• Points per Day: ${pointsPerDay.toFixed(1)}
• Coin-In: ${coinIn.toLocaleString()}
• Amount Paid: ${(lastCruise.amountPaid || 0).toFixed(0)}
• Value Received: ${calculateRetailValue(lastCruise).toFixed(0)}
• ROI: ${roi.toFixed(1)}%
• Value per Point: ${valuePerPoint.toFixed(2)}
• Winnings: ${(lastCruise.winnings || 0).toFixed(0)}
${lastCruiseSummary ? `• Out of Pocket: ${lastCruiseSummary.outOfPocket.toFixed(0)}\n• Retail Value: ${lastCruiseSummary.retailCabinValue.toFixed(0)}` : ''}

Provide a critique covering:
1. Overall performance assessment (1-2 sentences)
2. Key strengths (2 bullet points)
3. Areas for improvement (2 bullet points)
4. Specific recommendations for next cruise (2-3 actionable tips)

Keep it concise, direct, and actionable. Use gambling professional language.`;

      const result = await generateText({
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      setCritique(result);
    } catch (err) {
      console.error('[AgentX] Failed to generate critique:', err);
      setError('Failed to generate analysis. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [lastCruise, getAllSummaries]);

  React.useEffect(() => {
    if (lastCruise && !critique && !isLoading && !error) {
      generateCritique();
    }
  }, [lastCruise, critique, isLoading, error, generateCritique]);

  if (!lastCruise) return null;

  return (
    <View style={styles.agentXSection}>
      <View style={styles.agentXHeader}>
        <View style={styles.agentXTitleRow}>
          <Brain size={20} color="#003B6F" />
          <Text style={styles.agentXTitle}>Agent X Analysis</Text>
        </View>
        <TouchableOpacity
          style={styles.agentXFullButton}
          onPress={() => router.push('/agent-x')}
          testID="agent-x-full-btn"
        >
          <Text style={styles.agentXFullButtonText}>Full Chat</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.agentXSubheader}>
        <Text style={styles.agentXSubtitle}>
          {lastCruise.ship} • {new Date(lastCruise.sailDate).toLocaleDateString()}
        </Text>
      </View>

      {isLoading && (
        <View style={styles.agentXLoading}>
          <Loader size={20} color="#003B6F" />
          <Text style={styles.agentXLoadingText}>Analyzing your last cruise...</Text>
        </View>
      )}

      {error && (
        <View style={styles.agentXError}>
          <AlertTriangle size={16} color="#DC2626" />
          <Text style={styles.agentXErrorText}>{error}</Text>
          <TouchableOpacity onPress={generateCritique} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {critique && !isLoading && (
        <View style={styles.agentXContent}>
          <Text style={styles.agentXText}>{critique}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E6F2FF',
  },
  content: {
    padding: 16,
    paddingBottom: 16,
  },
  progressNote: {
    backgroundColor: '#E6F0FF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  progressText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  header: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#F0F8FF',
    borderRadius: 16,
    padding: 16,
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderColor: '#B3D9FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  statTitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#003B6F',
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#003B6F',
    marginBottom: 16,
  },
  performanceGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  performanceCard: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#B3D9FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  performanceLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  performanceValue: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  performanceSubtext: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  topList: {
    gap: 8,
  },
  topItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  topItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  topItemSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  topItemMetrics: {
    alignItems: 'flex-end',
  },
  lbGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  lbCol: {
    flex: 1,
    gap: 8,
  },
  lbTitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
    fontWeight: '700',
  },
  lbItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  invariantGood: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34,197,94,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  invariantBad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  invariantText: {
    fontSize: 10,
    color: COLORS.text,
    fontWeight: '600',
  },
  topItemRoi: {
    fontSize: 16,
    fontWeight: '800',
  },
  topItemMeta: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sortToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sortToggleText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  filtersCompactRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  selectContainer: {
    flex: 1,
    position: 'relative',
  },
  selectButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  selectLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  selectValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  selectDropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  selectOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  selectOptionActive: {
    backgroundColor: '#F1F5F9',
  },
  selectOptionText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  selectOptionTextActive: {
    color: COLORS.primary,
  },
  sortChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterRow: {
    marginTop: 8,
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
    fontWeight: '600',
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  searchBar: {
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
  },
  chip: {
    backgroundColor: '#F2F4F7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  clearChip: {
    backgroundColor: '#FFE4E6',
  },
  chipActive: {
    backgroundColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  chipTextActive: {
    color: COLORS.white,
  },
  cruiseList: {
    gap: 12,
  },
  cruiseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cruiseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cruiseHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cruiseInfo: {
    flex: 1,
  },
  cruiseShip: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  cruiseDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  roiBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roiText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cruiseMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  aiButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiButtonActive: {
    backgroundColor: COLORS.success,
  },
  aiAnalysisContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8F9FF',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  aiAnalysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  aiAnalysisTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  aiAnalysisText: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.text,
  },
  inlineEditBar: {
    marginTop: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
  },
  inlineEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineViewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editField: {
    flex: 1,
  },
  editLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  editBtn: {
    backgroundColor: COLORS.primary,
  },
  saveBtn: {
    backgroundColor: '#16A34A',
  },
  cancelBtn: {
    backgroundColor: '#6B7280',
  },
  smallBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  inlineText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  actionButtonsSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#003B6F',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  portfolioHeader: {
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#B3D9FF',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#003B6F',
    fontWeight: '700',
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  searchInputNew: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  miniStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginBottom: 4,
  },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  miniStatNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#003B6F',
  },
  miniStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  miniStatDivider: {
    fontSize: 16,
    color: '#D1D5DB',
    marginHorizontal: 12,
  },
  miniStatAction: {
    marginLeft: 12,
    padding: 4,
  },
  agentXSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#B3D9FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  agentXHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  agentXTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agentXTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#003B6F',
  },
  agentXFullButton: {
    backgroundColor: '#003B6F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  agentXFullButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  agentXSubheader: {
    marginBottom: 12,
  },
  agentXSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  agentXLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
  },
  agentXLoadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  agentXError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
  },
  agentXErrorText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  agentXContent: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#003B6F',
  },
  agentXText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#1E293B',
  },
  offerRankingsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 400,
  },
  exportButton: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  filterToggleButton: {
    backgroundColor: '#003B6F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterToggleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  filtersSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterRow: {
    marginBottom: 16,
  },
  filterItem: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#003B6F',
    borderColor: '#003B6F',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: COLORS.text,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  filterSummaryText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600' as const,
  },
  clearFiltersText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700' as const,
  },
  offerRankingsHeader: {
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#B3D9FF',
  },
  offerFiltersRow: {
    gap: 12,
    marginBottom: 12,
  },
  offerFilterSection: {
    marginBottom: 12,
  },
  offerFilterLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginBottom: 8,
    textTransform: 'uppercase' as const,
  },
  offerFilterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  offerFilterChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  offerFilterChipActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  offerFilterText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#374151',
  },
  offerFilterTextActive: {
    color: '#FFFFFF',
  },
  clearAllFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  clearAllFiltersText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
});