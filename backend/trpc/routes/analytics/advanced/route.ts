import { publicProcedure } from '../../../create-context';
import { z } from 'zod';
import { memoryStore } from '../../_stores/memory';
import { Cruise, CasinoOffer } from '../../../../../types/models';

interface AnalyticsInsight {
  id: string;
  type: 'trend' | 'opportunity' | 'warning' | 'achievement';
  title: string;
  description: string;
  value?: number;
  change?: number;
  severity: 'low' | 'medium' | 'high';
  actionable: boolean;
  recommendations?: string[];
  createdAt: string;
}

interface TrendData {
  period: string;
  value: number;
  change?: number;
  metadata?: any;
}

interface AdvancedAnalytics {
  // Performance Metrics
  totalROI: number;
  averageROI: number;
  totalSavings: number;
  totalSpent: number;
  profitMargin: number;
  
  // Cruise Metrics
  totalCruises: number;
  completedCruises: number;
  bookedCruises: number;
  averageNights: number;
  preferredCabinTypes: { [key: string]: number };
  preferredPorts: { [key: string]: number };
  
  // Casino Metrics
  totalCoinIn: number;
  totalFreePlay: number;
  averagePointsPerCruise: number;
  casinoEfficiency: number;
  
  // Trends
  roiTrend: TrendData[];
  spendingTrend: TrendData[];
  cruiseFrequencyTrend: TrendData[];
  
  // Insights
  insights: AnalyticsInsight[];
  
  // Forecasting
  projectedAnnualSavings: number;
  projectedCruisesPerYear: number;
  recommendedBudget: number;
}

export const advancedAnalyticsProcedure = publicProcedure
  .input(z.object({
    timeframe: z.enum(['30d', '90d', '6m', '1y', 'all']).default('1y'),
    includeProjections: z.boolean().default(true),
    includeInsights: z.boolean().default(true)
  }))
  .query(async ({ input }) => {
    console.log('[AdvancedAnalytics] Generating advanced analytics with input:', input);
    
    try {
      const now = new Date();
      const timeframeDays = getTimeframeDays(input.timeframe);
      const startDate = timeframeDays === -1 ? new Date(0) : new Date(now.getTime() - (timeframeDays * 24 * 60 * 60 * 1000));
      
      // Get data within timeframe
      const allCruises = memoryStore.getCruises();
      const bookedCruises = memoryStore.getBookedCruises();
      const casinoOffers = memoryStore.getCasinoOffers();
      
      const filteredCruises = allCruises.filter(cruise => {
        const cruiseDate = new Date(cruise.departureDate);
        return cruiseDate >= startDate;
      });
      
      const filteredBookedCruises = bookedCruises.filter((cruise: any) => {
        const cruiseDate = new Date(cruise.departureDate || cruise.sailDate);
        return cruiseDate >= startDate;
      });
      
      console.log(`[AdvancedAnalytics] Analyzing ${filteredCruises.length} cruises and ${filteredBookedCruises.length} booked cruises`);
      
      // Calculate performance metrics
      const performanceMetrics = calculatePerformanceMetrics(filteredCruises, filteredBookedCruises, casinoOffers);
      
      // Calculate cruise metrics
      const cruiseMetrics = calculateCruiseMetrics(filteredCruises, filteredBookedCruises);
      
      // Calculate casino metrics
      const casinoMetrics = calculateCasinoMetrics(filteredBookedCruises, casinoOffers);
      
      // Generate trends
      const trends = generateTrends(filteredCruises, filteredBookedCruises, input.timeframe);
      
      // Generate insights
      const insights = input.includeInsights ? 
        generateInsights(performanceMetrics, cruiseMetrics, casinoMetrics, trends) : [];
      
      // Generate projections
      const projections = input.includeProjections ? 
        generateProjections(performanceMetrics, cruiseMetrics, trends) : 
        { projectedAnnualSavings: 0, projectedCruisesPerYear: 0, recommendedBudget: 0 };
      
      const analytics: AdvancedAnalytics = {
        ...performanceMetrics,
        ...cruiseMetrics,
        ...casinoMetrics,
        ...trends,
        insights,
        ...projections
      };
      
      console.log('[AdvancedAnalytics] Generated analytics summary:', {
        totalROI: analytics.totalROI.toFixed(1) + '%',
        totalSavings: analytics.totalSavings.toLocaleString(),
        totalCruises: analytics.totalCruises,
        insightsCount: analytics.insights.length
      });
      
      return {
        analytics,
        timeframe: input.timeframe,
        dateRange: {
          start: startDate.toISOString(),
          end: now.toISOString()
        },
        generatedAt: now.toISOString()
      };
      
    } catch (error) {
      console.error('[AdvancedAnalytics] Error generating analytics:', error);
      throw new Error(`Advanced analytics failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

function getTimeframeDays(timeframe: string): number {
  switch (timeframe) {
    case '30d': return 30;
    case '90d': return 90;
    case '6m': return 180;
    case '1y': return 365;
    case 'all': return -1;
    default: return 365;
  }
}

function calculatePerformanceMetrics(cruises: Cruise[], bookedCruises: any[], casinoOffers: CasinoOffer[]) {
  console.log('[AdvancedAnalytics] Calculating performance metrics from financial data');
  
  // Get financial data from memory store
  const financials = memoryStore.getFinancials();
  console.log('[AdvancedAnalytics] Found', financials.length, 'financial records');
  
  let totalSavings = 0;
  let totalSpent = 0;
  let totalValue = 0;
  
  // Calculate from financial records
  const cruiseFinancials = new Map<string, { spent: number; revenue: number; expenses: number }>();
  
  financials.forEach(record => {
    if (!record.cruiseId) return;
    
    const amount = record.amount || record.lineTotal || 0;
    if (!cruiseFinancials.has(record.cruiseId)) {
      cruiseFinancials.set(record.cruiseId, { spent: 0, revenue: 0, expenses: 0 });
    }
    
    const cruiseData = cruiseFinancials.get(record.cruiseId)!;
    
    // Categorize spending
    if (record.sourceType === 'receipt') {
      // Receipts are typically expenses/spending
      cruiseData.expenses += Math.abs(amount);
    } else if (record.sourceType === 'statement') {
      // Statements can be charges or credits
      if (amount > 0) {
        cruiseData.expenses += amount;
      } else {
        cruiseData.revenue += Math.abs(amount);
      }
    }
    
    cruiseData.spent += Math.abs(amount);
    totalSpent += Math.abs(amount);
  });
  
  // Calculate savings from onboard credits and comps
  financials.forEach(record => {
    if (record.onboardCreditApplied && record.onboardCreditApplied > 0) {
      totalSavings += record.onboardCreditApplied;
    }
    
    // Look for comp indicators in descriptions
    const description = (record.description || record.itemDescription || '').toLowerCase();
    if (description.includes('comp') || description.includes('free') || description.includes('complimentary')) {
      const amount = Math.abs(record.amount || record.lineTotal || 0);
      totalSavings += amount;
    }
  });
  
  // Estimate total value (what would have been paid without casino benefits)
  const estimatedRetailMultiplier = 1.5; // Conservative estimate
  totalValue = totalSpent * estimatedRetailMultiplier + totalSavings;
  
  const totalROI = totalSpent > 0 ? ((totalSavings / totalSpent) * 100) : 0;
  const averageROI = cruiseFinancials.size > 0 ? totalROI / cruiseFinancials.size : 0;
  const profitMargin = totalValue > 0 ? ((totalSavings / totalValue) * 100) : 0;
  
  console.log('[AdvancedAnalytics] Performance metrics calculated:', {
    totalSpent: totalSpent.toFixed(2),
    totalSavings: totalSavings.toFixed(2),
    totalROI: totalROI.toFixed(1) + '%',
    cruisesWithFinancials: cruiseFinancials.size
  });
  
  return {
    totalROI,
    averageROI,
    totalSavings,
    totalSpent,
    profitMargin
  };
}

function calculateCruiseMetrics(cruises: Cruise[], bookedCruises: any[]) {
  console.log('[AdvancedAnalytics] Calculating cruise metrics from financial data');
  
  // Get financial data to determine actual cruises taken
  const financials = memoryStore.getFinancials();
  const cruisesWithFinancials = new Set(financials.map(f => f.cruiseId).filter(Boolean));
  
  const totalCruises = cruises.length;
  const completedCruises = Array.from(cruisesWithFinancials).filter(cruiseId => {
    // Find the cruise and check if it's in the past
    const cruise = cruises.find(c => c.id === cruiseId);
    if (!cruise) return false;
    const cruiseDate = new Date(cruise.departureDate);
    return cruiseDate < new Date();
  }).length;
  
  const bookedCruisesCount = cruisesWithFinancials.size;
  
  // Calculate average nights from financial records
  const cruiseNights = new Map<string, number>();
  financials.forEach(record => {
    if (record.cruiseId && record.shipName) {
      // Try to extract nights from itinerary or estimate from sail dates
      if (record.sailDateStart && record.sailDateEnd) {
        const start = new Date(record.sailDateStart);
        const end = new Date(record.sailDateEnd);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          if (nights > 0 && nights <= 21) {
            cruiseNights.set(record.cruiseId, nights);
          }
        }
      }
    }
  });
  
  const totalNights = Array.from(cruiseNights.values()).reduce((sum, nights) => sum + nights, 0);
  const averageNights = cruiseNights.size > 0 ? totalNights / cruiseNights.size : 7;
  
  // Preferred cabin types from financial records
  const preferredCabinTypes: { [key: string]: number } = {};
  const cruiseCabins = new Map<string, string>();
  
  financials.forEach(record => {
    if (record.cruiseId && record.cabinNumber) {
      // Determine cabin type from cabin number patterns
      const cabinNum = record.cabinNumber.toString();
      let cabinType = 'Interior';
      
      if (cabinNum.includes('Suite') || cabinNum.includes('SU') || parseInt(cabinNum) < 1000) {
        cabinType = 'Suite';
      } else if (cabinNum.startsWith('1') || cabinNum.startsWith('2')) {
        cabinType = 'Balcony';
      } else if (cabinNum.startsWith('3') || cabinNum.startsWith('4')) {
        cabinType = 'Oceanview';
      }
      
      cruiseCabins.set(record.cruiseId, cabinType);
    }
  });
  
  cruiseCabins.forEach(cabinType => {
    preferredCabinTypes[cabinType] = (preferredCabinTypes[cabinType] || 0) + 1;
  });
  
  // If no cabin types found, use default
  if (Object.keys(preferredCabinTypes).length === 0) {
    preferredCabinTypes['Interior'] = bookedCruisesCount;
  }
  
  // Preferred ports from ship names (approximate)
  const preferredPorts: { [key: string]: number } = {};
  const shipPorts = new Map<string, string>();
  
  financials.forEach(record => {
    if (record.cruiseId && record.shipName) {
      // Map common ships to their typical ports
      const ship = record.shipName.toLowerCase();
      let port = 'Unknown';
      
      if (ship.includes('navigator') || ship.includes('mariner')) {
        port = 'Los Angeles (San Pedro), California';
      } else if (ship.includes('harmony') || ship.includes('symphony')) {
        port = 'Miami, Florida';
      } else if (ship.includes('wonder') || ship.includes('oasis')) {
        port = 'Fort Lauderdale, Florida';
      } else if (ship.includes('quantum') || ship.includes('ovation')) {
        port = 'Seattle, Washington';
      }
      
      shipPorts.set(record.cruiseId, port);
    }
  });
  
  shipPorts.forEach(port => {
    preferredPorts[port] = (preferredPorts[port] || 0) + 1;
  });
  
  // If no ports found, use default
  if (Object.keys(preferredPorts).length === 0) {
    preferredPorts['Miami, Florida'] = bookedCruisesCount;
  }
  
  console.log('[AdvancedAnalytics] Cruise metrics calculated:', {
    totalCruises,
    completedCruises,
    bookedCruises: bookedCruisesCount,
    averageNights: averageNights.toFixed(1),
    cabinTypes: Object.keys(preferredCabinTypes).length,
    ports: Object.keys(preferredPorts).length
  });
  
  return {
    totalCruises,
    completedCruises,
    bookedCruises: bookedCruisesCount,
    averageNights,
    preferredCabinTypes,
    preferredPorts
  };
}

function calculateCasinoMetrics(bookedCruises: any[], casinoOffers: CasinoOffer[]) {
  console.log('[AdvancedAnalytics] Calculating casino metrics from financial data');
  
  // Get financial data to calculate actual casino metrics
  const financials = memoryStore.getFinancials();
  
  let totalCoinIn = 0;
  let totalFreePlay = 0;
  let totalPoints = 0;
  let casinoSpending = 0;
  let casinoComps = 0;
  
  // Calculate from financial records
  financials.forEach(record => {
    const amount = Math.abs(record.amount || record.lineTotal || 0);
    const description = (record.description || record.itemDescription || '').toLowerCase();
    const department = (record.department || '').toLowerCase();
    const category = (record.category || '').toLowerCase();
    
    // Identify casino-related transactions
    if (department === 'casino' || category === 'casino' || 
        description.includes('casino') || description.includes('slot') || 
        description.includes('table game') || description.includes('poker')) {
      
      casinoSpending += amount;
      
      // Estimate coin-in (typically 10-20x the net loss)
      totalCoinIn += amount * 15;
      
      // Estimate points (1 point per $5 coin-in for most cruise lines)
      totalPoints += (amount * 15) / 5;
    }
    
    // Identify free play and comps
    if (description.includes('free play') || description.includes('freeplay')) {
      const freePlayMatch = description.match(/\$(\d+(?:,\d+)?)/);  
      if (freePlayMatch) {
        totalFreePlay += parseInt(freePlayMatch[1].replace(',', ''));
      } else {
        totalFreePlay += amount; // Assume the amount is free play
      }
    }
    
    // Identify comps
    if (description.includes('comp') || description.includes('complimentary') || 
        (record.onboardCreditApplied && record.onboardCreditApplied > 0)) {
      casinoComps += record.onboardCreditApplied || amount;
    }
  });
  
  // If no direct casino spending found, estimate from total spending
  if (casinoSpending === 0) {
    const totalSpending = financials.reduce((sum, record) => {
      return sum + Math.abs(record.amount || record.lineTotal || 0);
    }, 0);
    
    // Assume 10-15% of total spending is casino-related for active players
    casinoSpending = totalSpending * 0.12;
    totalCoinIn = casinoSpending * 15;
    totalPoints = totalCoinIn / 5;
  }
  
  // Add free play from casino offers
  casinoOffers.forEach(offer => {
    const freePlayMatch = offer.offerName.match(/\$(\d+(?:,\d+)?)/);  
    if (freePlayMatch) {
      totalFreePlay += parseInt(freePlayMatch[1].replace(',', ''));
    }
  });
  
  const cruisesWithFinancials = new Set(financials.map(f => f.cruiseId).filter(Boolean)).size;
  const averagePointsPerCruise = cruisesWithFinancials > 0 ? totalPoints / cruisesWithFinancials : 0;
  
  // Casino efficiency: (Free Play + Comps) / Coin-In * 100
  const totalBenefits = totalFreePlay + casinoComps;
  const casinoEfficiency = totalCoinIn > 0 ? (totalBenefits / totalCoinIn) * 100 : 0;
  
  console.log('[AdvancedAnalytics] Casino metrics calculated:', {
    casinoSpending: casinoSpending.toFixed(2),
    totalCoinIn: totalCoinIn.toFixed(2),
    totalFreePlay: totalFreePlay.toFixed(2),
    casinoComps: casinoComps.toFixed(2),
    averagePointsPerCruise: averagePointsPerCruise.toFixed(0),
    casinoEfficiency: casinoEfficiency.toFixed(1) + '%'
  });
  
  return {
    totalCoinIn,
    totalFreePlay,
    averagePointsPerCruise,
    casinoEfficiency
  };
}

function generateTrends(cruises: Cruise[], bookedCruises: any[], timeframe: string) {
  console.log('[AdvancedAnalytics] Generating trends from financial data');
  
  const periods = generatePeriods(timeframe);
  const financials = memoryStore.getFinancials();
  
  const roiTrend: TrendData[] = [];
  const spendingTrend: TrendData[] = [];
  const cruiseFrequencyTrend: TrendData[] = [];
  
  periods.forEach(period => {
    // Filter financial records by period
    const periodFinancials = financials.filter(record => {
      if (!record.sailDateStart) return false;
      const sailDate = new Date(record.sailDateStart);
      return sailDate >= period.start && sailDate <= period.end;
    });
    
    // Calculate spending for the period
    const periodSpent = periodFinancials.reduce((sum, record) => {
      return sum + Math.abs(record.amount || record.lineTotal || 0);
    }, 0);
    
    // Calculate savings for the period
    const periodSavings = periodFinancials.reduce((sum, record) => {
      let savings = 0;
      if (record.onboardCreditApplied && record.onboardCreditApplied > 0) {
        savings += record.onboardCreditApplied;
      }
      const description = (record.description || record.itemDescription || '').toLowerCase();
      if (description.includes('comp') || description.includes('free') || description.includes('complimentary')) {
        savings += Math.abs(record.amount || record.lineTotal || 0);
      }
      return sum + savings;
    }, 0);
    
    // Calculate ROI for the period
    const periodROI = periodSpent > 0 ? ((periodSavings / periodSpent) * 100) : 0;
    
    // Count unique cruises in the period
    const periodCruiseIds = new Set(periodFinancials.map(r => r.cruiseId).filter(Boolean));
    const periodCruiseCount = periodCruiseIds.size;
    
    roiTrend.push({
      period: period.label,
      value: periodROI,
      metadata: { cruises: periodCruiseCount, spent: periodSpent, savings: periodSavings }
    });
    
    spendingTrend.push({
      period: period.label,
      value: periodSpent,
      metadata: { cruises: periodCruiseCount, savings: periodSavings }
    });
    
    cruiseFrequencyTrend.push({
      period: period.label,
      value: periodCruiseCount,
      metadata: { spent: periodSpent, savings: periodSavings }
    });
  });
  
  // Calculate changes
  [roiTrend, spendingTrend, cruiseFrequencyTrend].forEach(trend => {
    for (let i = 1; i < trend.length; i++) {
      const current = trend[i].value;
      const previous = trend[i - 1].value;
      trend[i].change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    }
  });
  
  console.log('[AdvancedAnalytics] Trends generated:', {
    periods: periods.length,
    totalFinancialRecords: financials.length,
    roiTrendPoints: roiTrend.length,
    spendingTrendPoints: spendingTrend.length
  });
  
  return {
    roiTrend,
    spendingTrend,
    cruiseFrequencyTrend
  };
}

function generatePeriods(timeframe: string) {
  const now = new Date();
  const periods = [];
  
  if (timeframe === '30d') {
    // Weekly periods for 30 days
    for (let i = 4; i >= 0; i--) {
      const end = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
      const start = new Date(end.getTime() - (7 * 24 * 60 * 60 * 1000));
      periods.push({
        start,
        end,
        label: `Week ${5 - i}`
      });
    }
  } else if (timeframe === '90d') {
    // Monthly periods for 90 days
    for (let i = 2; i >= 0; i--) {
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periods.push({
        start,
        end,
        label: start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      });
    }
  } else {
    // Quarterly periods for longer timeframes
    for (let i = 3; i >= 0; i--) {
      const quarterStart = new Date(now.getFullYear(), now.getMonth() - (i * 3), 1);
      const quarterEnd = new Date(now.getFullYear(), now.getMonth() - (i * 3) + 3, 0);
      periods.push({
        start: quarterStart,
        end: quarterEnd,
        label: `Q${Math.floor((quarterStart.getMonth() / 3)) + 1} ${quarterStart.getFullYear()}`
      });
    }
  }
  
  return periods;
}

function generateInsights(
  performance: any, 
  cruise: any, 
  casino: any, 
  trends: any
): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [];
  
  // ROI Performance Insights
  if (performance.totalROI > 50) {
    insights.push({
      id: 'high-roi',
      type: 'achievement',
      title: 'Excellent ROI Performance',
      description: `Your ${performance.totalROI.toFixed(1)}% ROI is exceptional. You're maximizing value from casino offers.`,
      value: performance.totalROI,
      severity: 'high',
      actionable: false,
      createdAt: new Date().toISOString()
    });
  } else if (performance.totalROI < 15) {
    insights.push({
      id: 'low-roi',
      type: 'warning',
      title: 'ROI Below Target',
      description: `Your ${performance.totalROI.toFixed(1)}% ROI is below the recommended 15% minimum.`,
      value: performance.totalROI,
      severity: 'high',
      actionable: true,
      recommendations: [
        'Focus on higher-value casino offers',
        'Consider longer cruises for better point accumulation',
        'Look for suite offers with better perks'
      ],
      createdAt: new Date().toISOString()
    });
  }
  
  // Cruise Frequency Insights
  const cruiseFrequency = cruise.bookedCruises / 12; // Per month
  if (cruiseFrequency > 1) {
    insights.push({
      id: 'high-frequency',
      type: 'opportunity',
      title: 'High Cruise Frequency',
      description: `You're cruising ${cruiseFrequency.toFixed(1)} times per month. Consider VIP status benefits.`,
      value: cruiseFrequency,
      severity: 'medium',
      actionable: true,
      recommendations: [
        'Apply for casino host relationship',
        'Negotiate better offers based on frequency',
        'Consider annual cruise packages'
      ],
      createdAt: new Date().toISOString()
    });
  }
  
  // Casino Efficiency Insights
  if (casino.casinoEfficiency < 5) {
    insights.push({
      id: 'low-casino-efficiency',
      type: 'warning',
      title: 'Low Casino Efficiency',
      description: `Your casino efficiency is ${casino.casinoEfficiency.toFixed(1)}%. You may be over-gambling.`,
      value: casino.casinoEfficiency,
      severity: 'medium',
      actionable: true,
      recommendations: [
        'Set stricter gambling budgets',
        'Focus on minimum play requirements only',
        'Track coin-in more carefully'
      ],
      createdAt: new Date().toISOString()
    });
  }
  
  // Trend Insights
  const latestROITrend = trends.roiTrend[trends.roiTrend.length - 1];
  if (latestROITrend && latestROITrend.change && latestROITrend.change < -20) {
    insights.push({
      id: 'declining-roi',
      type: 'warning',
      title: 'Declining ROI Trend',
      description: `Your ROI has declined by ${Math.abs(latestROITrend.change).toFixed(1)}% in the latest period.`,
      value: latestROITrend.change,
      severity: 'high',
      actionable: true,
      recommendations: [
        'Review recent cruise selections',
        'Analyze what changed in your strategy',
        'Consider returning to previously successful patterns'
      ],
      createdAt: new Date().toISOString()
    });
  }
  
  // Cabin Type Optimization
  const topCabinType = Object.entries(cruise.preferredCabinTypes)
    .sort(([,a], [,b]) => (b as number) - (a as number))[0];
  
  if (topCabinType && topCabinType[0].toLowerCase().includes('interior')) {
    insights.push({
      id: 'cabin-upgrade-opportunity',
      type: 'opportunity',
      title: 'Cabin Upgrade Opportunity',
      description: `You primarily book ${topCabinType[0]} cabins. Consider upgrading for better offers.`,
      severity: 'low',
      actionable: true,
      recommendations: [
        'Look for balcony upgrade offers',
        'Suite offers often have better perks',
        'Higher cabin categories get priority treatment'
      ],
      createdAt: new Date().toISOString()
    });
  }
  
  return insights;
}

function generateProjections(performance: any, cruise: any, trends: any) {
  // Calculate annual projections based on current trends
  const monthlySavings = performance.totalSavings / 12;
  const monthlyCruises = cruise.bookedCruises / 12;
  
  const projectedAnnualSavings = monthlySavings * 12;
  const projectedCruisesPerYear = monthlyCruises * 12;
  
  // Recommended budget based on ROI targets
  const targetROI = 25; // 25% target ROI
  const recommendedBudget = projectedAnnualSavings / (targetROI / 100);
  
  return {
    projectedAnnualSavings,
    projectedCruisesPerYear,
    recommendedBudget
  };
}

export const getInsightsProcedure = publicProcedure
  .input(z.object({
    type: z.enum(['all', 'trend', 'opportunity', 'warning', 'achievement']).optional(),
    severity: z.enum(['low', 'medium', 'high']).optional(),
    actionableOnly: z.boolean().default(false),
    limit: z.number().default(20)
  }))
  .query(async ({ input }) => {
    console.log('[AdvancedAnalytics] Getting insights with input:', input);
    
    try {
      // Generate analytics directly to get insights
      const now = new Date();
      const startDate = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
      
      const allCruises = memoryStore.getCruises();
      const bookedCruises = memoryStore.getBookedCruises();
      const casinoOffers = memoryStore.getCasinoOffers();
      
      const filteredCruises = allCruises.filter(cruise => {
        const cruiseDate = new Date(cruise.departureDate);
        return cruiseDate >= startDate;
      });
      
      const filteredBookedCruises = bookedCruises.filter((cruise: any) => {
        const cruiseDate = new Date(cruise.departureDate || cruise.sailDate);
        return cruiseDate >= startDate;
      });
      
      const performanceMetrics = calculatePerformanceMetrics(filteredCruises, filteredBookedCruises, casinoOffers);
      const cruiseMetrics = calculateCruiseMetrics(filteredCruises, filteredBookedCruises);
      const casinoMetrics = calculateCasinoMetrics(filteredBookedCruises, casinoOffers);
      const trends = generateTrends(filteredCruises, filteredBookedCruises, '1y');
      
      const analyticsInsights = generateInsights(performanceMetrics, cruiseMetrics, casinoMetrics, trends);
      
      let insights = analyticsInsights;
      
      // Apply filters
      if (input.type && input.type !== 'all') {
        insights = insights.filter(insight => insight.type === input.type);
      }
      
      if (input.severity) {
        insights = insights.filter(insight => insight.severity === input.severity);
      }
      
      if (input.actionableOnly) {
        insights = insights.filter(insight => insight.actionable);
      }
      
      // Sort by severity and creation date
      insights.sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      // Apply limit
      insights = insights.slice(0, input.limit);
      
      console.log('[AdvancedAnalytics] Returning', insights.length, 'insights');
      
      return {
        insights,
        summary: {
          total: analyticsInsights.length,
          byType: {
            trend: analyticsInsights.filter(i => i.type === 'trend').length,
            opportunity: analyticsInsights.filter(i => i.type === 'opportunity').length,
            warning: analyticsInsights.filter(i => i.type === 'warning').length,
            achievement: analyticsInsights.filter(i => i.type === 'achievement').length
          },
          bySeverity: {
            high: analyticsInsights.filter(i => i.severity === 'high').length,
            medium: analyticsInsights.filter(i => i.severity === 'medium').length,
            low: analyticsInsights.filter(i => i.severity === 'low').length
          },
          actionable: analyticsInsights.filter(i => i.actionable).length
        }
      };
      
    } catch (error) {
      console.error('[AdvancedAnalytics] Error getting insights:', error);
      throw new Error(`Failed to get insights: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });