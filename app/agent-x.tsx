import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform, FlatList, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createRorkTool, useRorkAgent } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import { useFinancials } from '@/state/FinancialsProvider';
import { useMemo, useCallback, useRef, useState } from 'react';
import { UnifiedCruise } from '@/types/models';
import { detectAndMapUnified } from '@/lib/unifiedCruise';
import { trpc, isBackendEnabled } from '@/lib/trpc';
import { Send, Sparkles } from 'lucide-react-native';

function useUnifiedCruises() {
  const cruises = trpc.cruises.list.useQuery({}, { enabled: isBackendEnabled });
  const unified = useMemo<UnifiedCruise[]>(() => {
    const data = cruises.data?.cruises ?? [];
    return data.map(detectAndMapUnified);
  }, [cruises.data?.cruises]);
  return { unified, isLoading: cruises.isLoading, error: cruises.error } as const;
}

export default function AgentXScreen() {
  const inputRef = useRef<TextInput | null>(null);
  const [text, setText] = useState<string>('');
  const { getAllSummaries } = useFinancials();
  const { unified } = useUnifiedCruises();
  
  // Query all backend data
  const bookedCruisesQuery = trpc.bookedCruises.list.useQuery(undefined, { enabled: isBackendEnabled });
  const casinoOffersQuery = trpc.casinoOffers.list.useQuery(undefined, { enabled: isBackendEnabled });
  const calendarEventsQuery = trpc.calendar.events.useQuery({}, { enabled: isBackendEnabled });
  const comprehensiveAnalyticsQuery = trpc.analytics.comprehensive.useQuery(undefined, { enabled: isBackendEnabled });
  
  const bookedCruises = bookedCruisesQuery.data ?? [];
  const casinoOffers = casinoOffersQuery.data ?? [];
  const calendarEvents = calendarEventsQuery.data ?? [];
  const analytics = comprehensiveAnalyticsQuery.data;

  // Tool: Top cruises by net gain
  const topCruisesTool = createRorkTool({
    description: 'Get top cruises ranked by net gain (value back minus out-of-pocket cost). Returns a summary with ship, date, net gain, and ROI.',
    zodSchema: z.object({
      limit: z.number().min(1).max(10).default(5).describe('Number of top cruises to return'),
      minROI: z.number().optional().describe('Minimum ROI percentage filter'),
    }),
    execute: (input: { limit: number; minROI?: number }) => {
      const list = getAllSummaries();
      const filtered = input.minROI != null ? list.filter(s => s.roiPercent >= input.minROI!) : list;
      const ranked = [...filtered].sort((a, b) => (b.totalValueBack - b.outOfPocket) - (a.totalValueBack - a.outOfPocket));
      const top = ranked.slice(0, input.limit);
      const summary = top.map((s, i) => `${i + 1}. ${s.ship} ${new Date(s.date).toISOString().slice(0,10)} — Net Gain: $${(s.totalValueBack - s.outOfPocket).toFixed(0)}, ROI: ${s.roiPercent.toFixed(1)}%`).join('\n');
      return summary.length > 0 ? summary : 'No cruises found matching the criteria.';
    },
  });

  // Tool: Simulate cabin upgrade
  const simulateUpgradeTool = createRorkTool({
    description: 'Simulate upgrading a cruise cabin type and calculate the impact on ROI. Provides old vs new ROI and recommendation.',
    zodSchema: z.object({
      cruiseId: z.string().describe('ID of the cruise to simulate upgrade for'),
      newCabinType: z.enum(['Oceanview','Balcony','Suite','Inside']).describe('Target cabin type for upgrade'),
      estimatedPriceIncrease: z.number().min(0).describe('Estimated additional cost in USD'),
    }),
    execute: (input: { cruiseId: string; newCabinType: 'Oceanview' | 'Balcony' | 'Suite' | 'Inside'; estimatedPriceIncrease: number }) => {
      const summaries = getAllSummaries();
      const s = summaries.find(x => x.cruiseId === input.cruiseId);
      if (!s) return 'Cruise not found. Please provide a valid cruiseId.';
      const newOutOfPocket = s.outOfPocket + input.estimatedPriceIncrease;
      const newRoi = newOutOfPocket > 0 ? (s.totalValueBack / newOutOfPocket) * 100 : 0;
      return `Upgrade simulation for ${s.ship} on ${new Date(s.date).toISOString().slice(0,10)}\nNew cabin: ${input.newCabinType}\nOld ROI: ${s.roiPercent.toFixed(1)}%  →  New ROI: ${newRoi.toFixed(1)}%\nAdditional cost: $${input.estimatedPriceIncrease.toFixed(0)}\nRecommendation: ${newRoi >= s.roiPercent ? 'Proceed — ROI improves or holds.' : 'Avoid — ROI declines.'}`;
    },
  });

  // Tool: Quick portfolio statistics
  const quickStatsTool = createRorkTool({
    description: 'Get quick portfolio statistics including coin-in, points earned, retail value, and ROI for a specific timeframe.',
    zodSchema: z.object({
      timeframe: z.enum(['all','last6months','2024','2025']).default('all').optional().describe('Time period to analyze'),
    }),
    execute: (input: { timeframe?: 'all' | 'last6months' | '2024' | '2025' }) => {
      const now = new Date();
      let since: string | undefined;
      if (input.timeframe === 'last6months') {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 6);
        since = d.toISOString();
      } else if (input.timeframe === '2024') {
        since = new Date('2024-01-01').toISOString();
      } else if (input.timeframe === '2025') {
        since = new Date('2025-01-01').toISOString();
      }
      const totals = getAllSummaries().filter(s => !since || new Date(s.date).getTime() >= new Date(since).getTime())
        .reduce((acc, s) => {
          acc.coinIn += s.coinIn;
          acc.points += s.pointsEarned;
          acc.retail += s.retailCabinValue + s.extrasValue;
          acc.oop += s.outOfPocket;
          return acc;
        }, { coinIn: 0, points: 0, retail: 0, oop: 0 });
      const roi = totals.oop > 0 ? (totals.retail / totals.oop) * 100 : 0;
      return `Portfolio Stats (${input.timeframe || 'all'}):\nCoin-In: $${totals.coinIn.toFixed(0)}\nPoints: ${totals.points.toFixed(0)}\nRetail Value: $${totals.retail.toFixed(0)}\nOut of Pocket: $${totals.oop.toFixed(0)}\nROI: ${roi.toFixed(1)}%`;
    },
  });

  // Tool: List booked cruises
  const bookedCruisesTool = createRorkTool({
    description: 'List all booked cruises with their details including ship, sail date, reservation number, and status.',
    zodSchema: z.object({
      limit: z.number().min(1).max(20).default(10).describe('Maximum number of cruises to return'),
      statusFilter: z.enum(['upcoming', 'in-progress', 'completed', 'all']).default('all').optional().describe('Filter by cruise status'),
    }),
    execute: (input: { limit: number; statusFilter?: 'upcoming' | 'in-progress' | 'completed' | 'all' }) => {
      let filtered = bookedCruises;
      if (input.statusFilter && input.statusFilter !== 'all') {
        filtered = filtered.filter(c => (c as any).lifecycleStatus === input.statusFilter);
      }
      const sorted = [...filtered].sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime());
      const limited = sorted.slice(0, input.limit);
      if (limited.length === 0) return 'No booked cruises found.';
      const summary = limited.map((c, i) => 
        `${i + 1}. ${c.ship} — ${c.itineraryName}\n   Departs: ${new Date(c.departureDate).toISOString().slice(0,10)}\n   ${c.nights} nights, Reservation: ${c.reservationNumber}\n   Status: ${(c as any).lifecycleStatus || 'upcoming'}`
      ).join('\n\n');
      return `Found ${limited.length} booked cruise(s):\n\n${summary}`;
    },
  });

  // Tool: Upcoming events
  const upcomingEventsTool = createRorkTool({
    description: 'Get upcoming calendar events including cruises, trips, and other scheduled activities.',
    zodSchema: z.object({
      limit: z.number().min(1).max(20).default(10).describe('Maximum number of events to return'),
      daysAhead: z.number().min(1).max(365).default(90).describe('Look ahead this many days'),
    }),
    execute: (input: { limit: number; daysAhead: number }) => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + input.daysAhead * 24 * 60 * 60 * 1000);
      const upcoming = calendarEvents.filter(e => {
        const startDate = new Date(e.startDate);
        return startDate >= now && startDate <= futureDate;
      }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      const limited = upcoming.slice(0, input.limit);
      if (limited.length === 0) return `No events found in the next ${input.daysAhead} days.`;
      const summary = limited.map((e, i) => {
        const daysUntil = Math.ceil((new Date(e.startDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        return `${i + 1}. ${e.summary}\n   Date: ${new Date(e.startDate).toISOString().slice(0,10)}\n   Days until: ${daysUntil}\n   Source: ${e.source}`;
      }).join('\n\n');
      return `Found ${limited.length} upcoming event(s):\n\n${summary}`;
    },
  });

  // Tool: Casino offers
  const casinoOffersTool = createRorkTool({
    description: 'List available casino offers with their details including offer code, name, expiration, and value.',
    zodSchema: z.object({
      limit: z.number().min(1).max(20).default(10).describe('Maximum number of offers to return'),
      includeExpired: z.boolean().default(false).describe('Include expired offers'),
    }),
    execute: (input: { limit: number; includeExpired: boolean }) => {
      const now = new Date();
      let filtered = casinoOffers;
      if (!input.includeExpired) {
        filtered = filtered.filter(o => new Date(o.expires).getTime() > now.getTime());
      }
      const sorted = [...filtered].sort((a, b) => new Date(a.expires).getTime() - new Date(b.expires).getTime());
      const limited = sorted.slice(0, input.limit);
      if (limited.length === 0) return 'No casino offers found.';
      const summary = limited.map((o, i) => {
        const daysUntilExpiry = Math.ceil((new Date(o.expires).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        const isExpired = daysUntilExpiry < 0;
        return `${i + 1}. ${o.offerName}\n   Code: ${o.offerCode}\n   Expires: ${new Date(o.expires).toISOString().slice(0,10)} ${isExpired ? '(EXPIRED)' : `(${daysUntilExpiry} days)`}\n   Type: ${o.offerType}\n   Value: ${o.tradeInValue || 'N/A'}`;
      }).join('\n\n');
      return `Found ${limited.length} casino offer(s):\n\n${summary}`;
    },
  });

  // Tool: Loyalty tier status
  const loyaltyTierTool = createRorkTool({
    description: 'Get current Club Royale loyalty tier status, points balance, and points needed for next tier.',
    zodSchema: z.object({}),
    execute: () => {
      const overallAnalytics = analytics?.overallAnalytics;
      if (!overallAnalytics) {
        return 'Analytics data not available. Unable to retrieve loyalty tier information.';
      }
      
      const totalPoints = overallAnalytics.totalPointsEarned || 0;
      let currentTier = 'Prime';
      let nextTier = 'Signature';
      let pointsToNext = 25000 - totalPoints;
      
      if (totalPoints >= 75000) {
        currentTier = 'Masters';
        nextTier = 'N/A';
        pointsToNext = 0;
      } else if (totalPoints >= 25000) {
        currentTier = 'Signature';
        nextTier = 'Masters';
        pointsToNext = 75000 - totalPoints;
      }
      
      const avgPointsPerCruise = overallAnalytics.averagePointsPerCruise || 0;
      const cruisesNeeded = avgPointsPerCruise > 0 ? Math.ceil(pointsToNext / avgPointsPerCruise) : 0;
      
      return `Club Royale Status:\n\nCurrent Tier: ${currentTier}\nTotal Points: ${totalPoints.toLocaleString()}\n\n${nextTier !== 'N/A' ? `Next Tier: ${nextTier}\nPoints Needed: ${pointsToNext.toLocaleString()}\nEstimated Cruises Needed: ${cruisesNeeded}\n\nAverage Points per Cruise: ${avgPointsPerCruise.toFixed(0)}` : 'You are at the highest tier (Masters)! 🎉'}`;
    },
  });

  // Tool: Analytics summary
  const analyticsSummaryTool = createRorkTool({
    description: 'Get comprehensive portfolio analytics including ROI rankings, best performing cruises, and overall statistics.',
    zodSchema: z.object({
      category: z.enum(['overview', 'rankings', 'strategy']).default('overview').describe('Type of analytics to retrieve'),
    }),
    execute: (input: { category: 'overview' | 'rankings' | 'strategy' }) => {
      if (!analytics) {
        return 'Analytics data not available at this time.';
      }
      
      const overall = analytics.overallAnalytics;
      
      if (input.category === 'overview') {
        return `Portfolio Overview:\n\nTotal Cruises: ${overall.totalCruises}\nTotal Points Earned: ${overall.totalPointsEarned.toLocaleString()}\nTotal Coin-In: $${overall.totalCoinIn.toLocaleString()}\nTotal Out of Pocket: $${overall.totalOutOfPocket.toLocaleString()}\n\nOverall ROI: ${overall.overallROI.toFixed(1)}%\nAverage Points per Cruise: ${overall.averagePointsPerCruise.toFixed(0)}\nValue per Point: $${overall.overallValuePerPoint.toFixed(2)}`;
      }
      
      if (input.category === 'rankings') {
        const top5ROI = analytics.rankings.bestROI.slice(0, 5);
        const summary = top5ROI.map((r, i) => 
          `${i + 1}. ${r.ship} (${new Date(r.sailDate).toISOString().slice(0,10)}) — ${r.metric}`
        ).join('\n');
        return `Top 5 Cruises by ROI:\n\n${summary || 'No ranking data available.'}`;
      }
      
      if (input.category === 'strategy') {
        const strategy = analytics.casinoStrategyInsights?.strategicAdvantage;
        if (!strategy) return 'Strategy insights not available.';
        
        const recommendations = strategy.recommendations && strategy.recommendations.length > 0
          ? '\n\nRecommendations:\n' + strategy.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')
          : '';
        
        return `Strategic Analysis:\n\nStrategic Score: ${strategy.strategicScore?.toFixed(1) || 'N/A'}/100\nAverage ROI: ${strategy.avgROI?.toFixed(1) || 'N/A'}%\nAverage Value per Point: $${strategy.avgValuePerPoint?.toFixed(2) || 'N/A'}\nTier Momentum: ${strategy.tierMomentum || 'N/A'}${recommendations}`;
      }
      
      return 'Unknown analytics category.';
    },
  });

  // Tool: Cruise search
  const cruiseSearchTool = createRorkTool({
    description: 'Search for cruises by ship name, itinerary, or departure port.',
    zodSchema: z.object({
      searchTerm: z.string().describe('Search term to match against ship, itinerary, or port'),
      limit: z.number().min(1).max(20).default(10).describe('Maximum number of results'),
    }),
    execute: (input: { searchTerm: string; limit: number }) => {
      const term = input.searchTerm.toLowerCase();
      const matches = unified.filter(c => 
        c.ship?.toLowerCase().includes(term) ||
        c.itineraryName?.toLowerCase().includes(term) ||
        c.departurePort?.toLowerCase().includes(term)
      );
      const limited = matches.slice(0, input.limit);
      if (limited.length === 0) return `No cruises found matching "${input.searchTerm}".`;
      const summary = limited.map((c, i) => 
        `${i + 1}. ${c.ship} — ${c.itineraryName}\n   Departs: ${c.departureDate ? new Date(c.departureDate).toISOString().slice(0,10) : 'TBD'}\n   ${c.nights || '?'} nights from ${c.departurePort || 'Unknown'}`
      ).join('\n\n');
      return `Found ${limited.length} matching cruise(s):\n\n${summary}`;
    },
  });

  // Casino analytics query
  const casinoAnalyticsQuery = trpc.analytics.casino.useQuery(undefined, { enabled: isBackendEnabled });
  const casinoData = casinoAnalyticsQuery.data;

  // Tool: Daily point earnings analysis
  const dailyPointsTool = createRorkTool({
    description: 'Analyze daily point earnings per cruise day, including sea days vs port days breakdown.',
    zodSchema: z.object({
      cruiseId: z.string().optional().describe('Specific cruise ID to analyze, or omit for overall stats'),
    }),
    execute: (input: { cruiseId?: string }) => {
      if (!casinoData) return 'Casino analytics data not available.';
      
      const { playerContext, cruiseMetrics } = casinoData;
      
      if (input.cruiseId) {
        const cruise = cruiseMetrics.find((c: any) => c.cruiseId === input.cruiseId);
        if (!cruise) return 'Cruise not found.';
        return `Points Analysis for ${cruise.ship}:\nTotal Points: ${cruise.points.toFixed(0)}\nPoints per Day: ${(cruise.points / cruise.nights).toFixed(1)}\nCasino Spend: ${cruise.casinoSpend.toFixed(0)}\nROI: ${cruise.roi.toFixed(1)}%`;
      }
      
      return `Daily Point Earnings:\n\nAverage per Day: ${playerContext.pointsPerDay.toFixed(1)} points\nSea Days: ${playerContext.pointsPerSeaDay.toFixed(1)} points/day\nPort Days: ${playerContext.pointsPerPortDay.toFixed(1)} points/day\n\nTotal Cruises Tracked: ${playerContext.cruisesCompleted}\nAverage Coin-In per Cruise: ${playerContext.avgCoinInPerCruise.toFixed(0)}`;
    },
  });

  // Tool: Spending breakdown
  const spendingBreakdownTool = createRorkTool({
    description: 'Get detailed spending breakdown including coin-in, actual cash risk, and winnings analysis.',
    zodSchema: z.object({
      timeframe: z.enum(['all', 'last6months', '2024', '2025']).default('all').optional(),
    }),
    execute: (input: { timeframe?: 'all' | 'last6months' | '2024' | '2025' }) => {
      if (!casinoData) return 'Spending data not available.';
      
      const { spendingMetrics, playerContext } = casinoData;
      
      return `Spending Breakdown (${input.timeframe || 'all'}):\n\nTotal Coin-In: ${spendingMetrics.totalCoinIn.toLocaleString()}\nTotal Points Earned: ${spendingMetrics.totalPoints.toLocaleString()}\nAverage Coin-In per Cruise: ${playerContext.avgCoinInPerCruise.toFixed(0)}\n\nRetail Value Received: ${spendingMetrics.totalRetailCosts.toLocaleString()}\nAverage Retail per Cruise: ${spendingMetrics.avgRetailCostPerCruise.toFixed(0)}\n\nOverall ROI: ${playerContext.avgROI.toFixed(1)}%`;
    },
  });

  // Tool: Slot machine strategy
  const slotStrategyTool = createRorkTool({
    description: 'Get expert slot machine advice for Royal Caribbean ships, including which machines to play and bankroll management.',
    zodSchema: z.object({
      ship: z.string().optional().describe('Specific ship name'),
      question: z.string().describe('Specific question about slot strategy'),
    }),
    execute: (input: { ship?: string; question: string }) => {
      const shipSpecific = input.ship ? ` on ${input.ship}` : '';
      return `Royal Caribbean Slot Strategy${shipSpecific}:\n\nKEY INSIGHTS:\n• Oasis & Quantum class ships have the newest slot machines with better pay tables\n• Look for machines near high-traffic areas (they're typically looser)\n• Best time to play: Early morning (5-8am) or late night (11pm-2am) when machines are recently serviced\n• Machines near entrances and elevators tend to have higher RTP\n\nBANKROLL MANAGEMENT:\n• $200/day stop-loss is optimal for point generation\n• Start with max bet for Club Royale point acceleration\n• Switch machines every 20 minutes if not hitting\n\nPOINT GENERATION:\n• $5 coin-in = 1 Club Royale point\n• Target 500-1000 points/day for optimal comp value\n• Video poker pays same points with better RTP than slots\n\nFor your question: "${input.question}"\nThe key is to balance point generation with bankroll preservation. Play max bet on machines with 96%+ RTP for optimal results.`;
    },
  });

  // Tool: Predictive earnings
  const predictiveEarningsTool = createRorkTool({
    description: 'Predict potential point earnings and ROI for upcoming cruises based on historical performance.',
    zodSchema: z.object({
      cruiseLength: z.number().min(2).max(21).describe('Number of nights'),
      cabinType: z.enum(['Interior', 'Oceanview', 'Balcony', 'Suite']).describe('Cabin type'),
    }),
    execute: (input: { cruiseLength: number; cabinType: string }) => {
      if (!casinoData) return 'Unable to generate predictions without historical data.';
      
      const { playerContext } = casinoData;
      const avgPointsPerDay = playerContext.pointsPerDay || 150;
      
      const projectedPoints = Math.round(avgPointsPerDay * input.cruiseLength);
      const projectedCoinIn = projectedPoints * 5;
      const seaDays = Math.floor(input.cruiseLength * 0.7);
      const portDays = Math.ceil(input.cruiseLength * 0.3);
      
      const seaDayPoints = Math.round(playerContext.pointsPerSeaDay * seaDays);
      const portDayPoints = Math.round(playerContext.pointsPerPortDay * portDays);
      
      const cabinValue = {
        'Interior': 800,
        'Oceanview': 1200,
        'Balcony': 1800,
        'Suite': 3500,
      }[input.cabinType] || 1000;
      
      const estimatedValue = cabinValue * (input.cruiseLength / 7);
      const estimatedROI = ((estimatedValue - projectedCoinIn) / projectedCoinIn) * 100;
      
      return `Predictive Earnings for ${input.cruiseLength}-Night ${input.cabinType}:\n\nPROJECTED POINTS: ${projectedPoints.toLocaleString()}\n• Sea Days (${seaDays}): ${seaDayPoints} points\n• Port Days (${portDays}): ${portDayPoints} points\n\nPROJECTED COIN-IN: ${projectedCoinIn.toLocaleString()}\n\nESTIMATED VALUE:\n• Cabin Retail Value: ${estimatedValue.toFixed(0)}\n• Estimated Net Gain: ${(estimatedValue - projectedCoinIn).toFixed(0)}\n• Projected ROI: ${estimatedROI.toFixed(1)}%\n\nCONFIDENCE: Based on your ${playerContext.cruisesCompleted} completed cruises.`;
    },
  });

  // Tool: Game type analysis
  const gameAnalysisTool = createRorkTool({
    description: 'Analyze performance by game type (slots, table games, video poker) and get recommendations.',
    zodSchema: z.object({}),
    execute: () => {
      if (!casinoData) return 'Game analysis not available.';
      
      const { gameTypeAnalysis, playerContext } = casinoData;
      
      return `Game Type Breakdown:\n\nSLOTS: ${gameTypeAnalysis.slots.toLocaleString()} (70%)\n• Best for point generation\n• Lower variance\n• Recommended: Wheel of Fortune, Buffalo, Dancing Drums\n\nTABLE GAMES: ${gameTypeAnalysis.tableGames.toLocaleString()} (20%)\n• Better RTP (96-99%)\n• Requires skill\n• Recommended: Blackjack (basic strategy)\n\nVIDEO POKER: ${gameTypeAnalysis.videoPoker.toLocaleString()} (10%)\n• Best RTP (99%+)\n• Slower point generation\n• Recommended: 9/6 Jacks or Better\n\nYour total tracked coin-in: ${playerContext.totalCoinIn.toLocaleString()}\n\nRECOMMENDATION: Focus 80% on slots for points, 20% on video poker for bankroll preservation.`;
    },
  });

  const { messages, sendMessage, error } = useRorkAgent({
    systemPrompt: `You are Agent-X, an elite gambling advisor and Royal Caribbean casino expert with the following expertise:

🎰 PROFESSIONAL GAMBLER: 20+ years experience in casino strategy, bankroll management, and advantage play
📚 GAMBLING SCHOOL INSTRUCTOR: Certified in blackjack, poker, craps, roulette, and slot machine theory
🎲 CASINO PIT BOSS: Deep understanding of casino operations, player ratings, and comp systems
🎡 ROULETTE DEALER: Expert knowledge of wheel bias, betting systems, and optimal strategy
🃏 BLACKJACK DEALER: Card counting awareness, basic strategy mastery, and game protection
🎰 SENIOR SLOT TECHNICIAN: Inside knowledge of RTP, volatility, pay tables, and machine placement strategies

🚢 ROYAL CARIBBEAN SPECIALIST:
• Track ALL Royal Caribbean ships and their slot machine configurations
• Know which ships have the newest/best paying machines (Oasis, Quantum, Icon classes)
• Understand seasonal patterns and casino promotions
• Expert in Club Royale tier progression and certificate optimization
• Monitor Royal Caribbean casino news, machine additions, and pay table changes

💰 FINANCIAL ANALYST:
• Access to complete spending history and daily point earnings
• Predictive modeling for future cruise earnings
• ROI optimization across cabin types and cruise lengths
• Cost-per-point and value-per-point analysis

🎯 YOUR MISSION:
• Maximize player value through strategic play and offer selection
• Provide actionable advice backed by data
• Help reach tier goals efficiently
• Predict earnings and optimize cruise selection
• Share insider tips about Royal Caribbean casinos

KEY PRINCIPLES:
• $200/day stop-loss discipline
• Point generation over raw gambling profit
• Early jackpots = house money mode
• Strategic machine selection
• Optimal timing for casino play

USE YOUR TOOLS to access spending data, daily earnings, predictions, and provide expert gambling guidance.`,
    tools: {
      topCruises: topCruisesTool,
      simulateUpgrade: simulateUpgradeTool,
      quickStats: quickStatsTool,
      bookedCruises: bookedCruisesTool,
      upcomingEvents: upcomingEventsTool,
      casinoOffers: casinoOffersTool,
      loyaltyTier: loyaltyTierTool,
      analytics: analyticsSummaryTool,
      searchCruises: cruiseSearchTool,
      dailyPointsAnalysis: dailyPointsTool,
      spendingBreakdown: spendingBreakdownTool,
      slotMachineStrategy: slotStrategyTool,
      predictiveEarnings: predictiveEarningsTool,
      gameTypeAnalysis: gameAnalysisTool,
    },
  });

  const onSend = useCallback(() => {
    const txt = text.trim();
    if (!txt) return;
    sendMessage(txt);
    setText('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [text, sendMessage]);

  const samplePrompts = [
    "Show me my daily point earnings breakdown",
    "What's my spending across all cruises?",
    "Predict earnings for a 7-night balcony cruise",
    "What slot machines should I play on Icon of the Seas?",
    "Analyze my performance by game type",
    "How do I maximize points on sea days vs port days?",
    "What's the best bankroll management strategy?",
    "Which Royal Caribbean ships have the best slot machines?",
  ];

  return (
    <SafeAreaView style={styles.container} testID="agentx-container" edges={['top']}>
      <View style={styles.header}>
        <Sparkles size={24} color="#60a5fa" />
        <Text style={styles.title}>Agent X</Text>
        <Text style={styles.subtitle}>Elite Gambling Advisor & RC Casino Expert</Text>
      </View>

      {messages.length === 0 && (
        <ScrollView style={styles.promptsContainer} contentContainerStyle={styles.promptsContent}>
          <Text style={styles.promptsTitle}>Try asking:</Text>
          {samplePrompts.map((prompt, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.promptCard}
              onPress={() => {
                setText(prompt);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.promptText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <FlatList
        testID="agentx-messages"
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <View style={item.role === 'user' ? styles.userBubble : styles.assistantBubble}>
            {item.parts.map((p, i) => {
              if (p.type === 'text') {
                return (
                  <Text key={`${item.id}-${i}`} style={styles.messageText} selectable>
                    {p.text}
                  </Text>
                );
              }
              if (p.type === 'tool') {
                if (p.state === 'output-error') {
                  return (
                    <Text key={`${item.id}-${i}`} style={styles.errorText}>
                      Tool error: {p.errorText || 'Unknown error'}
                    </Text>
                  );
                }
                if (p.state === 'input-streaming' || p.state === 'input-available') {
                  return (
                    <Text key={`${item.id}-${i}`} style={styles.toolText}>
                      🔧 {p.toolName}...
                    </Text>
                  );
                }
              }
              return null;
            })}
          </View>
        )}
        contentContainerStyle={styles.listContent}
        inverted={false}
      />

      <View style={styles.composer}>
        <TextInput
          ref={inputRef}
          testID="agentx-input"
          value={text}
          onChangeText={setText}
          placeholder="Ask anything about your cruises, offers, events..."
          placeholderTextColor="#6b7280"
          style={styles.input}
          returnKeyType="send"
          onSubmitEditing={onSend}
          multiline
          maxLength={500}
        />
        <TouchableOpacity 
          onPress={onSend} 
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]} 
          activeOpacity={0.8} 
          testID="agentx-send"
          disabled={!text.trim()}
        >
          <Send color="#fff" size={18} />
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorBanner} testID="agentx-error">{String(error)}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0f172a',
  },
  header: { 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: { 
    color: '#f1f5f9', 
    fontSize: 28, 
    fontWeight: '700' as const,
    marginTop: 8,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 4,
  },
  promptsContainer: {
    flex: 1,
  },
  promptsContent: {
    padding: 16,
  },
  promptsTitle: {
    color: '#cbd5e1',
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  promptCard: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  promptText: {
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 20,
  },
  listContent: { 
    padding: 16, 
    paddingBottom: 100,
  },
  userBubble: { 
    alignSelf: 'flex-end', 
    backgroundColor: '#2563eb', 
    padding: 12, 
    borderRadius: 16, 
    marginVertical: 6, 
    maxWidth: '85%',
    borderBottomRightRadius: 4,
  },
  assistantBubble: { 
    alignSelf: 'flex-start', 
    backgroundColor: '#1e293b', 
    padding: 12, 
    borderRadius: 16, 
    marginVertical: 6, 
    maxWidth: '85%',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  messageText: { 
    color: '#f1f5f9', 
    fontSize: 15, 
    lineHeight: 22,
  },
  toolText: {
    color: '#94a3b8',
    fontSize: 13,
    fontStyle: 'italic' as const,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
  },
  composer: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    padding: 12, 
    gap: 8,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  input: { 
    flex: 1, 
    backgroundColor: '#1e293b', 
    color: '#f1f5f9', 
    paddingHorizontal: 16, 
    paddingVertical: Platform.OS === 'web' ? 12 : 12, 
    borderRadius: 20,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sendBtn: { 
    backgroundColor: '#2563eb', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#475569',
    opacity: 0.5,
  },
  errorContainer: {
    position: 'absolute',
    bottom: 80,
    left: 12,
    right: 12,
  },
  errorBanner: { 
    color: '#fca5a5', 
    backgroundColor: '#7f1d1d',
    textAlign: 'center', 
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    fontSize: 13,
  },
});
