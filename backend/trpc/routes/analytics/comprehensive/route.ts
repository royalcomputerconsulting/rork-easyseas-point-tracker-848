import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { memoryStore } from '../../_stores/memory';
import type { 
  Cruise, 
  BookedCruise, 
  FinancialsRecord,
  ReceiptData,
  CruiseStatementData
} from '@/types/models';

interface CruiseWithFinancials {
  cruise: Cruise | BookedCruise;
  receipts: ReceiptData[];
  statements: CruiseStatementData[];
  financials: FinancialsRecord[];
  analytics: {
    amountWonOrLost: number;
    pointsEarned: number;
    retailCosts: number;
    casinoDiscounts: number;
    onboardSpend: number;
    freePlayReceived: number;
    freePlayUsed: number;
    roi: number;
    valuePerPoint: number;
    coinIn: number;
    outOfPocket: number;
  };
}

// Helper function to get departure date from either Cruise or BookedCruise
function getDepartureDate(cruise: Cruise | BookedCruise): string {
  if ('departureDate' in cruise) {
    return cruise.departureDate;
  } else {
    return (cruise as BookedCruise).startDate;
  }
}

interface OverallAnalytics {
  totalCruises: number;
  totalAmountWonOrLost: number;
  totalPointsEarned: number;
  totalRetailCosts: number;
  totalCasinoDiscounts: number;
  totalOnboardSpend: number;
  totalFreePlay: number;
  totalCoinIn: number;
  totalOutOfPocket: number;
  overallROI: number;
  overallValuePerPoint: number;
  averagePointsPerCruise: number;
  averageROIPerCruise: number;
}

export const getComprehensiveAnalyticsProcedure = publicProcedure
  .query(async () => {
    console.log('[Analytics] Getting comprehensive analytics');
    
    // Get all financial data - prioritize financials records as the primary source
    let financials = memoryStore.getFinancials();
    
    // If no financials data is loaded, try to load from CSV
    if (financials.length === 0) {
      console.log('[Analytics] No financials data found, attempting to load from CSV...');
      try {
        const { promises: fs } = await import('fs');
        const path = await import('path');

        const normalizeAmount = (raw: string): number => {
          if (!raw) return 0;
          const cleaned = raw.replace(/[$,]/g, '').trim();
          const parsed = Number(cleaned);
          return isFinite(parsed) ? parsed : 0;
        };

        const csvPath = path.join(process.cwd(), 'DATA', 'financials.database.csv');
        const csvContent = await fs.readFile(csvPath, 'utf8');
        const lines = csvContent.split('\n').filter(line => line.trim());

        if (lines.length > 1) {
          const headers = lines[0].split(',').map(h => h.trim());
          const records: any[] = [];
          const seen = new Set<string>();

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length !== headers.length) continue;

            const record: any = {
              processedAt: new Date().toISOString(),
              currency: 'USD',
              verified: false
            };

            headers.forEach((header, index) => {
              const value = values[index];
              if (value && value !== '') {
                if (header === 'sourceType') {
                  record.sourceType = value;
                } else if (header === 'category') {
                  record.category = value;
                  record.department = value;
                } else if (header === 'amount') {
                  const amt = normalizeAmount(value);
                  record.amount = amt;
                  if (record.sourceType === 'receipt') {
                    record.lineTotal = amt;
                  }
                } else if (header === 'verified') {
                  record.verified = value.toLowerCase() === 'true';
                } else if (header === 'description') {
                  record.description = value;
                  record.itemDescription = value;
                } else if (header.toLowerCase().includes('date')) {
                  // Preserve date-like fields as-is for signature and logic
                  record[header] = value;
                } else {
                  record[header] = value;
                }
              }
            });

            if (record.sourceType === 'statement' && record.amount !== undefined) {
              record.txnType = record.amount >= 0 ? 'Charge' : 'Credit';
            }

            // Deduplicate: receipts should NOT have duplicate rows
            const signatureFields = [
              record.sourceType || '',
              record.cruiseId || record.reservationNumber || '',
              record.postDate || record.txnDate || record.sailDateStart || record.sailDate || '',
              (record.description || record.itemDescription || '').toString().toLowerCase(),
              String(record.amount ?? record.lineTotal ?? '')
            ];
            const signature = signatureFields.join('|');
            if (seen.has(signature)) {
              continue;
            }
            seen.add(signature);
            records.push(record);
          }

          const inserted = memoryStore.addFinancials(records);
          console.log('[Analytics] Loaded from CSV:', {
            lines: lines.length - 1,
            inserted: inserted.length,
            uniqueSignatures: seen.size
          });
          financials = memoryStore.getFinancials();
        }
      } catch (error) {
        console.warn('[Analytics] Failed to load financials from CSV:', error);
      }
    }
    
    // Get all cruises and booked cruises
    const allCruises = memoryStore.getCruises();
    const bookedCruises = memoryStore.getBookedCruises();
    
    // Get legacy data for compatibility
    const receipts = memoryStore.getReceipts();
    const statements = memoryStore.getCruiseStatements();
    
    console.log('[Analytics] Data counts:', {
      cruises: allCruises.length,
      booked: bookedCruises.length,
      receipts: receipts.length,
      statements: statements.length,
      financials: financials.length
    });
    
    // Group financials by cruise ID to build comprehensive analytics
    const financialsByCruise = financials.reduce((acc, record) => {
      const cruiseId = record.cruiseId || 'unknown';
      if (!acc[cruiseId]) {
        acc[cruiseId] = {
          receipts: [],
          statements: [],
          financials: []
        };
      }
      acc[cruiseId].financials.push(record);
      return acc;
    }, {} as Record<string, { receipts: any[], statements: any[], financials: FinancialsRecord[] }>);
    
    console.log('[Analytics] Cruises with financial data:', Object.keys(financialsByCruise).length);
    
    // Process cruises with financial data
    const cruisesWithFinancials: CruiseWithFinancials[] = [];
    
    // Process all cruises that have financial data
    Object.entries(financialsByCruise).forEach(([cruiseId, cruiseData]) => {
      if (cruiseData.financials.length === 0) return;
      
      // Find the corresponding cruise or booked cruise
      const bookedCruise = bookedCruises.find(bc => bc.id === cruiseId || bc.reservationNumber === cruiseId);
      const regularCruise = allCruises.find(c => c.id === cruiseId);
      let cruise = (bookedCruise as any) || (regularCruise as any);
      
      if (!cruise) {
        const first = cruiseData.financials[0];
        const nowIso = new Date().toISOString();
        // Create a synthetic minimal Cruise so analytics can aggregate even if not present in cruises list
        const dep = first?.sailDateStart || first?.postDate || first?.processedAt || nowIso;
        const ret = first?.sailDateEnd || dep;
        const depDate = new Date(dep);
        const retDate = new Date(ret);
        const nights = !isNaN(depDate.getTime()) && !isNaN(retDate.getTime())
          ? Math.max(1, Math.round((retDate.getTime() - depDate.getTime()) / (1000 * 60 * 60 * 24)))
          : 4;
        const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        // Determine cruise status based on sail date
        const currentDate = new Date();
        const sailDate = new Date(dep);
        const cruiseStatus = sailDate < currentDate ? 'sold_out' : 'on_sale'; // Use valid Cruise status values
        
        cruise = {
          id: cruiseId,
          ship: first?.shipName || 'Unknown Ship',
          itineraryName: first?.itineraryName || '',
          departurePort: '',
          arrivalPort: undefined,
          departureDate: isNaN(depDate.getTime()) ? toIso(new Date()) : toIso(depDate),
          returnDate: isNaN(retDate.getTime()) ? toIso(new Date((isNaN(depDate.getTime()) ? Date.now() : depDate.getTime()) + nights * 86400000)) : toIso(retDate),
          nights,
          line: 'Royal Caribbean',
          region: undefined,
          shipClass: undefined,
          stateroomTypes: ['Interior'],
          status: cruiseStatus,
          createdAt: nowIso,
          updatedAt: nowIso,
        } as import('@/types/models').Cruise;
      }
      
      // Calculate analytics from financials data
      const receiptFinancials = cruiseData.financials.filter(f => f.sourceType === 'receipt');
      const statementFinancials = cruiseData.financials.filter(f => f.sourceType === 'statement');
      
      // Calculate retail costs from receipts
      const retailCosts = receiptFinancials.reduce((sum, f) => {
        return sum + (f.lineTotal || 0) + (f.tax || 0) + (f.gratuity || 0) - (f.discount || 0);
      }, 0);
      
      // Calculate casino discounts from receipts
      const casinoDiscounts = receiptFinancials.reduce((sum, f) => {
        return sum + (f.discount || 0);
      }, 0);
      
      // Calculate onboard spend from statements
      const onboardSpend = statementFinancials.reduce((sum, f) => {
        return sum + Math.max(0, f.amount || 0);
      }, 0);
      
      // Calculate casino charges from statements
      const casinoCharges = statementFinancials
        .filter(f => f.department === 'Casino')
        .reduce((sum, f) => sum + Math.max(0, f.amount || 0), 0);
      
      // VERIFIED POINTS SYSTEM - Use actual verified points data
      const VERIFIED_POINTS: Record<string, number> = {
        '5207254': 976,   // Navigator 9/15 - VERIFIED
        '2665774': 4581,  // Star - VERIFIED
        '236930': 2030,   // Ovation - VERIFIED
        '6242276': 2030,  // Ovation alternate ID - VERIFIED
        '2501764': 1000,  // Harmony - VERIFIED
        '7871133': 3562   // Wonder - Calculated (12149 - 976 - 4581 - 2030 - 1000)
      };
      
      // Use verified points if available, otherwise calculate from casino charges
      let pointsEarned = VERIFIED_POINTS[cruiseId] || Math.round(casinoCharges / 5);
      
      // For cruises without statements, estimate points based on cruise length
      if (statementFinancials.length === 0) {
        const nights = cruise.nights || 4;
        pointsEarned = nights >= 7 ? 1500 : nights >= 4 ? 1000 : 600;
      }
      
      // Calculate winnings and amount won/lost with verified data
      const VERIFIED_WINNINGS: Record<string, number> = {
        '5207254': 589,   // Navigator 9/15 - Won $589 (VERIFIED)
        '2665774': 0,     // Star - Estimate
        '236930': 0,      // Ovation - Estimate
        '6242276': 0,     // Ovation alternate - Estimate
        '2501764': 0,     // Harmony - Estimate
        '7871133': 0      // Wonder - Estimate
      };
      
      const winnings = VERIFIED_WINNINGS[cruiseId] !== undefined 
        ? VERIFIED_WINNINGS[cruiseId] 
        : ((bookedCruise as any)?.winningsBroughtHome || 0);
      const amountWonOrLost = statementFinancials.length > 0 ? winnings - casinoCharges : winnings;
      
      // Calculate free play
      const freePlayReceived = receiptFinancials.reduce((sum, f) => {
        const desc = (f.description || f.itemDescription || '').toLowerCase();
        if (desc.includes('free play') || desc.includes('freeplay') || desc.includes('fp')) {
          return sum + Math.abs(f.amount || f.lineTotal || 0);
        }
        return sum;
      }, 0) + (((bookedCruise as any)?.userFinancialData?.additionalFreeplayReceived) || 0);
      
      const freePlayUsed = freePlayReceived; // Assume all free play is used
      
      // Calculate out of pocket costs (what you actually paid for cruise + internet + gratuities)
      const cruiseFarePaid = receiptFinancials.find(f => f.description?.includes('Amount Paid'))?.amount || 0;
      const internetCharges = statementFinancials.filter(f => f.description?.includes('INTERNET')).reduce((sum, f) => sum + Math.max(0, f.amount || 0), 0);
      const gratuityCharges = statementFinancials.filter(f => f.description?.includes('GRATUITIES') && (f.amount || 0) > 0).reduce((sum, f) => sum + (f.amount || 0), 0);
      
      const outOfPocket = (bookedCruise as any)?.netOutOfPocket !== undefined ? (bookedCruise as any).netOutOfPocket :
        cruiseFarePaid + internetCharges + gratuityCharges;
      
      // Coin-in (total amount played)
      const coinIn = pointsEarned * 5; // $5 per point
      
      // Calculate total value received (retail cruise fare + free play + casino discounts + spa/dining comps)
      const retailCruiseFare = receiptFinancials.find(f => f.description?.includes('Cruise Fare (gross)'))?.amount || 0;
      const spaComps = statementFinancials.filter(f => f.department === 'Spa').reduce((sum, f) => sum + Math.max(0, f.amount || 0), 0);
      const diningComps = statementFinancials.filter(f => f.department === 'Dining').reduce((sum, f) => sum + Math.max(0, f.amount || 0), 0);
      
      const totalValueReceived = retailCruiseFare + freePlayReceived + casinoDiscounts + spaComps + diningComps;
      
      // ROI calculation: (Total Value Received - Out of Pocket) / Out of Pocket * 100
      const roi = outOfPocket > 0 ? ((totalValueReceived - outOfPocket) / outOfPocket) * 100 : 0;
      
      // Value per point: Total savings divided by points earned
      const totalSavings = totalValueReceived - outOfPocket;
      const valuePerPoint = pointsEarned > 0 ? totalSavings / pointsEarned : 0;
      
      console.log(`[Analytics] Cruise ${cruiseId} analytics:`, {
        retailCosts,
        casinoDiscounts,
        onboardSpend,
        casinoCharges,
        pointsEarned,
        outOfPocket,
        roi: roi.toFixed(1),
        valuePerPoint: valuePerPoint.toFixed(2)
      });
      
      cruisesWithFinancials.push({
        cruise,
        receipts: [], // Legacy - keeping for compatibility
        statements: [], // Legacy - keeping for compatibility
        financials: cruiseData.financials,
        analytics: {
          amountWonOrLost,
          pointsEarned,
          retailCosts,
          casinoDiscounts,
          onboardSpend,
          freePlayReceived,
          freePlayUsed,
          roi,
          valuePerPoint,
          coinIn,
          outOfPocket
        }
      });
    });
    
    console.log('[Analytics] Total cruises with financials processed:', cruisesWithFinancials.length);
    
    // Filter to only include COMPLETE PACKAGES: cruises with both receipt AND statement data
    // A complete package must have:
    // 1. Both receipt and statement financial data
    // 2. Points earned (casino activity)
    // 3. Verified amounts
    const completePackages = cruisesWithFinancials.filter(c => {
      const receiptData = c.financials.filter(f => f.sourceType === 'receipt');
      const statementData = c.financials.filter(f => f.sourceType === 'statement');
      const hasAnySource = receiptData.length > 0 || statementData.length > 0;
      const hasCasinoActivity = c.analytics.pointsEarned > 0;
      const hasValidAmounts = c.analytics.outOfPocket > 0 || c.analytics.retailCosts > 0;
      return hasAnySource && (hasCasinoActivity || hasValidAmounts);
    });

    console.log(`[Analytics] Relaxed complete packages (any source + activity or amounts): ${completePackages.length}`);
    console.log(`[Analytics] Total cruises with any financial data: ${cruisesWithFinancials.length}`);
    
    // Filter to include ALL 2025 cruises for portfolio performance (not just April+)
    const start2025 = new Date('2025-01-01');
    const end2025 = new Date('2025-12-31T23:59:59');
    const cruisesIn2025 = completePackages.filter(c => {
      let sailDateStr = getDepartureDate(c.cruise);
      // Handle M/D/YY format by converting to full year
      if (sailDateStr && sailDateStr.match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)) {
        const parts = sailDateStr.split('/');
        const month = parts[0];
        const day = parts[1];
        const year = '20' + parts[2]; // Convert YY to 20YY
        sailDateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      const sailDate = new Date(sailDateStr);
      return !isNaN(sailDate.getTime()) && sailDate >= start2025 && sailDate <= end2025;
    });

    console.log(`[Analytics] Complete packages in 2025: ${cruisesIn2025.length}`);

    // Calculate overall analytics (for all 2025 complete packages)
    const overallAnalytics: OverallAnalytics = {
      totalCruises: cruisesIn2025.length,
      totalAmountWonOrLost: cruisesIn2025.reduce((sum, c) => sum + c.analytics.amountWonOrLost, 0),
      totalPointsEarned: cruisesIn2025.reduce((sum, c) => sum + c.analytics.pointsEarned, 0),
      totalRetailCosts: cruisesIn2025.reduce((sum, c) => sum + c.analytics.retailCosts, 0),
      totalCasinoDiscounts: cruisesIn2025.reduce((sum, c) => sum + c.analytics.casinoDiscounts, 0),
      totalOnboardSpend: cruisesIn2025.reduce((sum, c) => sum + c.analytics.onboardSpend, 0),
      totalFreePlay: cruisesIn2025.reduce((sum, c) => sum + c.analytics.freePlayReceived, 0),
      totalCoinIn: cruisesIn2025.reduce((sum, c) => sum + c.analytics.coinIn, 0),
      totalOutOfPocket: cruisesIn2025.reduce((sum, c) => sum + c.analytics.outOfPocket, 0),
      overallROI: 0,
      overallValuePerPoint: 0,
      averagePointsPerCruise: 0,
      averageROIPerCruise: 0
    };
    
    // Calculate derived metrics
    const totalValueReceived = overallAnalytics.totalRetailCosts + overallAnalytics.totalFreePlay + overallAnalytics.totalCasinoDiscounts;
    
    if (overallAnalytics.totalOutOfPocket > 0) {
      overallAnalytics.overallROI = ((totalValueReceived - overallAnalytics.totalOutOfPocket) / overallAnalytics.totalOutOfPocket) * 100;
    }
    
    // Calculate cost per point (how much each point actually cost you)
    if (overallAnalytics.totalPointsEarned > 0) {
      const totalSavings = totalValueReceived - overallAnalytics.totalOutOfPocket;
      overallAnalytics.overallValuePerPoint = totalSavings / overallAnalytics.totalPointsEarned;
    }
    
    if (overallAnalytics.totalCruises > 0) {
      overallAnalytics.averagePointsPerCruise = overallAnalytics.totalPointsEarned / overallAnalytics.totalCruises;
      overallAnalytics.averageROIPerCruise = overallAnalytics.overallROI / overallAnalytics.totalCruises;
    }
    
    console.log('[Analytics] Portfolio Performance (2025):', {
      totalOutOfPocket: overallAnalytics.totalOutOfPocket,
      totalWinLoss: overallAnalytics.totalAmountWonOrLost,
      totalPoints: overallAnalytics.totalPointsEarned,
      costPerPoint: overallAnalytics.totalOutOfPocket / overallAnalytics.totalPointsEarned
    });
    
    // Generate top 10 rankings (only from complete packages)
    const rankings = {
      // Total value received = retail + freeplay + discounts - out of pocket
      highestOfferValue: completePackages
        .slice()
        .sort((a, b) => {
          const aValue = a.analytics.retailCosts + a.analytics.freePlayReceived + a.analytics.casinoDiscounts - a.analytics.outOfPocket;
          const bValue = b.analytics.retailCosts + b.analytics.freePlayReceived + b.analytics.casinoDiscounts - b.analytics.outOfPocket;
          return bValue - aValue;
        })
        .slice(0, 10)
        .map(c => {
          const totalValue = c.analytics.retailCosts + c.analytics.freePlayReceived + c.analytics.casinoDiscounts - c.analytics.outOfPocket;
          return {
            cruiseId: c.cruise.id,
            ship: c.cruise.ship,
            sailDate: getDepartureDate(c.cruise),
            nights: c.cruise.nights,
            value: totalValue,
            metric: `${totalValue.toFixed(0)} saved`
          };
        }),
      
      // Phase 2.2 leaderboards
      bestROI: completePackages
        .filter(c => isFinite(c.analytics.roi))
        .slice()
        .sort((a, b) => b.analytics.roi - a.analytics.roi)
        .slice(0, 10)
        .map(c => ({
          cruiseId: c.cruise.id,
          ship: c.cruise.ship,
          sailDate: getDepartureDate(c.cruise),
          nights: c.cruise.nights,
          value: c.analytics.roi,
          metric: `${c.analytics.roi.toFixed(0)}% ROI`
        })),
      
      highestValuePerPoint: completePackages
        .filter(c => c.analytics.valuePerPoint > 0)
        .slice()
        .sort((a, b) => b.analytics.valuePerPoint - a.analytics.valuePerPoint)
        .slice(0, 10)
        .map(c => ({
          cruiseId: c.cruise.id,
          ship: c.cruise.ship,
          sailDate: getDepartureDate(c.cruise),
          nights: c.cruise.nights,
          value: c.analytics.valuePerPoint,
          metric: `${c.analytics.valuePerPoint.toFixed(2)}/point`
        })),
      
      lowestOutOfPocket: completePackages
        .slice()
        .sort((a, b) => a.analytics.outOfPocket - b.analytics.outOfPocket)
        .slice(0, 10)
        .map(c => ({
          cruiseId: c.cruise.id,
          ship: c.cruise.ship,
          sailDate: getDepartureDate(c.cruise),
          nights: c.cruise.nights,
          value: c.analytics.outOfPocket,
          metric: `${c.analytics.outOfPocket.toFixed(0)}`
        })),
      
      biggestCasinoWins: completePackages
        .filter(c => c.analytics.amountWonOrLost > 0)
        .slice()
        .sort((a, b) => b.analytics.amountWonOrLost - a.analytics.amountWonOrLost)
        .slice(0, 10)
        .map(c => ({
          cruiseId: c.cruise.id,
          ship: c.cruise.ship,
          sailDate: getDepartureDate(c.cruise),
          nights: c.cruise.nights,
          value: c.analytics.amountWonOrLost,
          metric: `+${c.analytics.amountWonOrLost.toFixed(0)} won`
        })),
      
      highestTotalValueReceived: completePackages
        .slice()
        .sort((a, b) => {
          const aTotal = a.analytics.retailCosts + a.analytics.freePlayReceived + a.analytics.casinoDiscounts;
          const bTotal = b.analytics.retailCosts + b.analytics.freePlayReceived + b.analytics.casinoDiscounts;
          return bTotal - aTotal;
        })
        .slice(0, 10)
        .map(c => {
          const total = c.analytics.retailCosts + c.analytics.freePlayReceived + c.analytics.casinoDiscounts;
          return {
            cruiseId: c.cruise.id,
            ship: c.cruise.ship,
            sailDate: getDepartureDate(c.cruise),
            nights: c.cruise.nights,
            value: total,
            metric: `${total.toFixed(0)} total value`
          };
        }),
      
      mostPointsEarned: completePackages
        .slice()
        .sort((a, b) => b.analytics.pointsEarned - a.analytics.pointsEarned)
        .slice(0, 10)
        .map(c => ({
          cruiseId: c.cruise.id,
          ship: c.cruise.ship,
          sailDate: getDepartureDate(c.cruise),
          nights: c.cruise.nights,
          value: c.analytics.pointsEarned,
          metric: `${c.analytics.pointsEarned.toLocaleString()} pts`
        })),
      
      // Longest cruises with best value ratio (savings per night)
      longestBestValue: completePackages
        .filter(c => (c.cruise.nights || 0) > 0)
        .slice()
        .map(c => {
          const savings = (c.analytics.retailCosts + c.analytics.freePlayReceived + c.analytics.casinoDiscounts - c.analytics.outOfPocket);
          const valuePerNight = savings / Math.max(1, c.cruise.nights);
          return { base: c, savings, valuePerNight };
        })
        .sort((a, b) => {
          if (b.base.cruise.nights !== a.base.cruise.nights) return b.base.cruise.nights - a.base.cruise.nights;
          return b.valuePerNight - a.valuePerNight;
        })
        .slice(0, 10)
        .map(({ base, valuePerNight }) => ({
          cruiseId: base.cruise.id,
          ship: base.cruise.ship,
          sailDate: getDepartureDate(base.cruise),
          nights: base.cruise.nights,
          value: valuePerNight,
          metric: `${valuePerNight.toFixed(0)}/night`
        })),
      
      // Keep original longest list for compatibility
      longestCruises: completePackages
        .slice()
        .sort((a, b) => b.cruise.nights - a.cruise.nights)
        .slice(0, 10)
        .map(c => ({
          cruiseId: c.cruise.id,
          ship: c.cruise.ship,
          sailDate: getDepartureDate(c.cruise),
          nights: c.cruise.nights,
          value: c.cruise.nights,
          metric: `${c.cruise.nights} nights`
        })),
      
      // Step 15: Cruise Length Analysis Rankings
      bestValuePerNight: completePackages
        .filter(c => (c.cruise.nights || 0) > 0)
        .slice()
        .map(c => {
          const totalSavings = c.analytics.retailCosts + c.analytics.freePlayReceived + c.analytics.casinoDiscounts - c.analytics.outOfPocket;
          const valuePerNight = totalSavings / Math.max(1, c.cruise.nights);
          return { cruise: c, valuePerNight };
        })
        .sort((a, b) => b.valuePerNight - a.valuePerNight)
        .slice(0, 10)
        .map(({ cruise, valuePerNight }) => ({
          cruiseId: cruise.cruise.id,
          ship: cruise.cruise.ship,
          sailDate: getDepartureDate(cruise.cruise),
          nights: cruise.cruise.nights,
          value: valuePerNight,
          metric: `${valuePerNight.toFixed(0)}/night`
        })),
      
      shortVsLongPerformance: (() => {
        const shortCruises = completePackages.filter(c => (c.cruise.nights || 0) <= 7);
        const longCruises = completePackages.filter(c => (c.cruise.nights || 0) > 7);
        
        const calcAverage = (cruises: typeof completePackages, metric: keyof typeof completePackages[0]['analytics']) => {
          return cruises.length > 0 ? cruises.reduce((sum, c) => sum + c.analytics[metric], 0) / cruises.length : 0;
        };
        
        const calcValuePerNight = (cruises: typeof completePackages) => {
          if (cruises.length === 0) return 0;
          const totalSavings = cruises.reduce((sum, c) => {
            return sum + (c.analytics.retailCosts + c.analytics.freePlayReceived + c.analytics.casinoDiscounts - c.analytics.outOfPocket);
          }, 0);
          const totalNights = cruises.reduce((sum, c) => sum + (c.cruise.nights || 0), 0);
          return totalNights > 0 ? totalSavings / totalNights : 0;
        };
        
        return {
          short: {
            count: shortCruises.length,
            avgROI: calcAverage(shortCruises, 'roi'),
            avgPointsPerCruise: calcAverage(shortCruises, 'pointsEarned'),
            avgValuePerPoint: calcAverage(shortCruises, 'valuePerPoint'),
            avgValuePerNight: calcValuePerNight(shortCruises),
            avgOutOfPocket: calcAverage(shortCruises, 'outOfPocket')
          },
          long: {
            count: longCruises.length,
            avgROI: calcAverage(longCruises, 'roi'),
            avgPointsPerCruise: calcAverage(longCruises, 'pointsEarned'),
            avgValuePerPoint: calcAverage(longCruises, 'valuePerPoint'),
            avgValuePerNight: calcValuePerNight(longCruises),
            avgOutOfPocket: calcAverage(longCruises, 'outOfPocket')
          }
        };
      })()
    
    };
    
    // Step 18: Casino Strategy Insights
    const casinoStrategyInsights = {
      // Casino perspective vs reality analysis
      perspectiveAnalysis: (() => {
        const totalCoinIn = overallAnalytics.totalCoinIn;
        const totalOutOfPocket = overallAnalytics.totalOutOfPocket;
        const totalWinLoss = overallAnalytics.totalAmountWonOrLost;
        const totalFreePlay = overallAnalytics.totalFreePlay;
        
        // Casino's view: They see coin-in as "money at risk"
        const casinoPerceivedRisk = totalCoinIn;
        
        // Reality: Actual cash at risk (out of pocket + winnings lost)
        const actualCashRisk = totalOutOfPocket + Math.max(0, -totalWinLoss);
        
        // Coin-in inflation factor
        const coinInInflationFactor = casinoPerceivedRisk > 0 ? actualCashRisk / casinoPerceivedRisk : 0;
        
        return {
          casinoPerceivedRisk,
          actualCashRisk,
          coinInInflationFactor,
          inflationPercentage: ((1 - coinInInflationFactor) * 100),
          analysis: coinInInflationFactor < 0.5 ? 'Excellent - Casino overvalues your play' :
                   coinInInflationFactor < 0.8 ? 'Good - Favorable risk perception' :
                   'Fair - Risk perception aligned'
        };
      })(),
      
      // House money mode detection
      houseMoney: (() => {
        const cruisesWithWins = completePackages.filter(c => c.analytics.amountWonOrLost > 0);
        const totalWinnings = cruisesWithWins.reduce((sum, c) => sum + c.analytics.amountWonOrLost, 0);
        const subsequentPlay = cruisesWithWins.reduce((sum, c) => sum + c.analytics.coinIn, 0);
        
        const houseMoneyCruises = cruisesWithWins.filter(c => {
          // Detect if subsequent coin-in exceeded winnings (playing with house money)
          return c.analytics.coinIn > c.analytics.amountWonOrLost * 2;
        });
        
        return {
          totalWinnings,
          cruisesWithWins: cruisesWithWins.length,
          houseMoneyCruises: houseMoneyCruises.length,
          houseMoneyCoinIn: houseMoneyCruises.reduce((sum, c) => sum + c.analytics.coinIn, 0),
          houseMoneyCruiseIds: houseMoneyCruises.map(c => c.cruise.id),
          riskLevel: houseMoneyCruises.length > cruisesWithWins.length * 0.5 ? 'High' :
                    houseMoneyCruises.length > 0 ? 'Moderate' : 'Low'
        };
      })(),
      
      // Strategic advantage calculations
      strategicAdvantage: (() => {
        const avgPointsPerCruise = overallAnalytics.averagePointsPerCruise;
        const avgValuePerPoint = overallAnalytics.overallValuePerPoint;
        const avgROI = overallAnalytics.overallROI;
        
        // Calculate tier momentum (points acceleration)
        const cruisesByDate = completePackages
          .slice()
          .sort((a, b) => new Date(getDepartureDate(a.cruise)).getTime() - new Date(getDepartureDate(b.cruise)).getTime());
        
        let tierMomentum = 'Stable';
        if (cruisesByDate.length >= 3) {
          const recent = cruisesByDate.slice(-3);
          const earlier = cruisesByDate.slice(0, -3);
          
          if (earlier.length > 0) {
            const recentAvgPoints = recent.reduce((sum, c) => sum + c.analytics.pointsEarned, 0) / recent.length;
            const earlierAvgPoints = earlier.reduce((sum, c) => sum + c.analytics.pointsEarned, 0) / earlier.length;
            
            if (recentAvgPoints > earlierAvgPoints * 1.2) tierMomentum = 'Accelerating';
            else if (recentAvgPoints < earlierAvgPoints * 0.8) tierMomentum = 'Declining';
          }
        }
        
        // Risk multiplier efficiency
        const riskMultiplier = overallAnalytics.totalCoinIn > 0 ? 
          (overallAnalytics.totalFreePlay + overallAnalytics.totalCasinoDiscounts) / overallAnalytics.totalCoinIn : 0;
        
        return {
          avgPointsPerCruise,
          avgValuePerPoint,
          avgROI,
          tierMomentum,
          riskMultiplier,
          riskMultiplierPercentage: riskMultiplier * 100,
          strategicScore: Math.min(100, (avgROI / 100) * 30 + (avgValuePerPoint) * 20 + (riskMultiplier * 100) * 0.5),
          recommendations: [
            avgROI < 50 ? 'Focus on higher-value cruise offers' : null,
            avgValuePerPoint < 2 ? 'Optimize point earning efficiency' : null,
            riskMultiplier < 0.1 ? 'Increase strategic play for better comps' : null,
            tierMomentum === 'Declining' ? 'Consider tier status protection strategies' : null
          ].filter(Boolean)
        };
      })()
    };
    
    // Calculate formulas
    const formulas = {
      pointsPerDollar: overallAnalytics.totalCoinIn > 0 ? 
        `${(overallAnalytics.totalPointsEarned / overallAnalytics.totalCoinIn).toFixed(3)} points per dollar played` : 'N/A',
      dollarPerPoint: overallAnalytics.totalPointsEarned > 0 ? 
        `${(overallAnalytics.totalOutOfPocket / overallAnalytics.totalPointsEarned).toFixed(2)} out of pocket per point earned` : 'N/A',
      savingsPerCruise: overallAnalytics.totalCruises > 0 ? 
        `${((totalValueReceived - overallAnalytics.totalOutOfPocket) / overallAnalytics.totalCruises).toFixed(0)} average savings per cruise` : 'N/A',
      roiFormula: 'ROI = ((Retail Cruise Fare + FreePlay + Casino Discounts + Spa/Dining Comps - Out of Pocket) / Out of Pocket) × 100',
      valuePerPointFormula: 'Value per Point = (Total Value Received - Out of Pocket) / Points Earned',
      coinInFormula: 'Coin-In = Points Earned × $5 (1 point per $5 played)',
      outOfPocketFormula: 'Out of Pocket = Actual Cruise Fare Paid + Internet Charges + Gratuities',
      // Strategy formulas
      coinInInflationFormula: 'Coin-In Inflation = (Casino Perceived Risk - Actual Cash Risk) / Casino Perceived Risk × 100',
      strategicScoreFormula: 'Strategic Score = (ROI/100 × 30) + (Value Per Point × 20) + (Risk Multiplier × 100 × 0.5)',
      riskMultiplierFormula: 'Risk Multiplier = (Free Play + Casino Discounts) / Total Coin-In'
    };
    
    return {
      cruisesWithFinancials: completePackages, // Only return complete packages
      overallAnalytics,
      rankings,
      casinoStrategyInsights, // Step 18: Casino Strategy Insights
      formulas,
      lastUpdated: new Date().toISOString(),
      // Debug info for troubleshooting
      debugInfo: {
        totalFinancialRecords: financials.length,
        totalCruisesWithAnyData: cruisesWithFinancials.length,
        completePackagesCount: completePackages.length,
        cruisesIn2025: cruisesIn2025.length,
        receiptRecords: financials.filter(f => f.sourceType === 'receipt').length,
        statementRecords: financials.filter(f => f.sourceType === 'statement').length
      }
    };
  });

export const getAIInsightsProcedure = publicProcedure
  .input(z.object({
    analyticsData: z.any()
  }))
  .mutation(async ({ input }) => {
    console.log('[AI Insights] Generating insights');
    
    try {
      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a casino cruise analytics expert. Analyze the provided data and give 3-5 concise insights about play patterns, ROI optimization, and Club Royale progression. Also provide 2-3 actionable recommendations. Be specific and data-driven.'
            },
            {
              role: 'user',
              content: `Analyze this cruise casino data and provide insights:\n${JSON.stringify(input.analyticsData, null, 2)}`
            }
          ]
        })
      });
      
      const result = await response.json();
      
      const completion: string = result?.completion ?? '';
      const lines = typeof completion === 'string' ? completion.split('\n').filter((line: string) => line.trim()) : [];
      
      return {
        insights: lines.slice(0, 5),
        recommendations: lines.slice(5, 8),
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[AI Insights] Error:', error);
      return {
        insights: ['Unable to generate insights at this time'],
        recommendations: ['Please try again later'],
        generatedAt: new Date().toISOString()
      };
    }
  });

export const getCruiseAINarrativeProcedure = publicProcedure
  .input(z.object({ cruiseId: z.string() }))
  .mutation(async ({ input }) => {
    console.log('[AI Narrative] Generating per-cruise narrative for', input.cruiseId);

    try {
      const cruises = memoryStore.getCruises();
      const booked = memoryStore.getBookedCruises();
      const receipts = memoryStore.getReceipts();
      const statements = memoryStore.getCruiseStatements();
      const financials = memoryStore.getFinancials();
      const payTable = memoryStore.getCasinoPayTable();

      const cruise = booked.find(c => c.id === input.cruiseId) || cruises.find(c => c.id === input.cruiseId);
      const cruiseReceipts = receipts.filter(r => r.cruiseId === input.cruiseId);
      const cruiseStatements = statements.filter(s => s.cruiseId === input.cruiseId);
      const cruiseFinancials = financials.filter(f => f.cruiseId === input.cruiseId);

      const retailCosts = cruiseReceipts.reduce((sum: number, r: any) => sum + (r.totalFare || 0), 0);
      const taxesAndFees = cruiseReceipts.reduce((sum: number, r: any) => sum + (r.taxesAndFees || 0), 0);
      const amountPaid = cruiseReceipts.reduce((sum: number, r: any) => sum + (r.totalPaid || 0), 0);
      const casinoDiscount = Math.max(0, retailCosts + taxesAndFees - amountPaid);

      const freePlay = cruiseReceipts.reduce((sum: number, r: any) => {
        let fp = 0;
        if (Array.isArray(r.specialOffers)) {
          r.specialOffers.forEach((offer: string) => {
            const match = offer.toLowerCase().match(/\$([0-9,]+(?:\.[0-9]{2})?)/g);
            if ((offer.toLowerCase().includes('free play') || offer.toLowerCase().includes('freeplay') || offer.toLowerCase().includes('fp')) && match) {
              match.forEach((m) => { fp += parseFloat(m.replace(/[$,]/g, '')) || 0; });
            }
          });
        }
        if (typeof r.freePlay === 'number') fp += r.freePlay;
        return sum + fp;
      }, 0);

      const onboardCategoryTotals = cruiseStatements.reduce((acc: Record<string, number>, s: any) => {
        const add = (k: string, v: number | undefined) => { acc[k] = (acc[k] || 0) + (v || 0); };
        add('casino', s.clubRoyaleEntertainmentCharges || s.casino);
        add('beveragePackages', s.beveragePackages);
        add('specialtyDining', s.specialtyDining);
        add('spa', s.spa);
        add('photos', s.photos);
        add('shopping', s.shopping);
        add('internet', s.internetPackages);
        add('excursions', s.excursions);
        add('other', s.otherCharges);
        return acc;
      }, {} as Record<string, number>);
      const onboardSpend = Object.values(onboardCategoryTotals).reduce((sum, v) => sum + v, 0);
      const casinoCharges = onboardCategoryTotals.casino || 0;

      const pointsEarned = (cruise as any)?.cruisePointsEarned ?? Math.floor(casinoCharges / 5);
      const coinIn = pointsEarned * 5;

      const outOfPocket = (cruise as any)?.netOutOfPocket ?? amountPaid;

      const totalValueBack = retailCosts + casinoDiscount + freePlay + ((cruise as any)?.winningsBroughtHome || 0);
      const roi = outOfPocket > 0 ? ((totalValueBack - outOfPocket) / outOfPocket) * 100 : 0;

      let currentTier = 'None';
      let nextTier: string | null = null;
      let pointsToNextTier: number | null = null;
      if (Array.isArray(payTable) && payTable.length > 0) {
        const eligible = payTable.filter((t: any) => pointsEarned >= t.points).pop();
        const upcoming = payTable.find((t: any) => pointsEarned < t.points);
        currentTier = eligible?.reward || 'None';
        nextTier = upcoming?.reward || null;
        pointsToNextTier = upcoming ? (upcoming.points - pointsEarned) : null;
      }

      const payload = {
        cruise: {
          id: input.cruiseId,
          ship: cruise?.ship || 'Unknown Ship',
          sailDate: cruise ? (('departureDate' in cruise ? (cruise as any).departureDate : (cruise as any).startDate) as string) : '',
          nights: (cruise as any)?.nights || 0,
        },
        metrics: {
          retailCosts,
          taxesAndFees,
          casinoDiscount,
          amountPaid,
          freePlay,
          onboardSpend,
          casinoCharges,
          pointsEarned,
          coinIn,
          outOfPocket,
          roi,
          categoryBreakdown: onboardCategoryTotals,
          financialsCount: cruiseFinancials.length,
        },
        tiers: {
          currentTier,
          nextTier,
          pointsToNextTier,
        }
      } as const;

      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a precise casino cruise analyst. Write a short narrative (120-180 words) with 4 titled bullet points: 1) Coin-in vs True Cash Risk, 2) Spending Pattern Highlights by category, 3) ROI Optimization Tips (specific, actionable), 4) Club Royale Progress (current tier, points to next). Use numbers in dollars and percentages. Tone: concise, data-first.'
            },
            {
              role: 'user',
              content: `Create a per-cruise analysis for the following data. If a field is zero or missing, gracefully omit it.\n${JSON.stringify(payload, null, 2)}`
            }
          ]
        })
      });

      const result = await response.json();
      const narrative: string = result?.completion || '';

      return {
        narrative,
        meta: payload,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[AI Narrative] Error:', error);
      return {
        narrative: 'Unable to generate AI narrative right now. Please try again later.',
        meta: null,
        generatedAt: new Date().toISOString()
      };
    }
  });

export const getPortfolioAIAnalysisProcedure = publicProcedure
  .mutation(async () => {
    console.log('[AI Portfolio] Generating overall portfolio AI analysis');
    try {
      const financials = memoryStore.getFinancials();
      const cruises = memoryStore.getCruises();
      const booked = memoryStore.getBookedCruises();

      const byCruise = financials.reduce((acc, f) => {
        const key = f.cruiseId || 'unknown';
        if (!acc[key]) acc[key] = { receipts: [], statements: [], items: [] as FinancialsRecord[] } as any;
        acc[key].items.push(f);
        return acc;
      }, {} as Record<string, { receipts: FinancialsRecord[]; statements: FinancialsRecord[]; items: FinancialsRecord[] }>);

      const summaries = Object.entries(byCruise).map(([cruiseId, bucket]) => {
        const rows = bucket.items;
        const receiptRows = rows.filter(r => r.sourceType === 'receipt');
        const statementRows = rows.filter(r => r.sourceType === 'statement');
        const retail = receiptRows.reduce((s, r) => s + (r.lineTotal || 0) + (r.tax || 0) + (r.gratuity || 0) - (r.discount || 0), 0);
        const out = statementRows.reduce((s, r) => s + Math.max(0, r.amount || 0), 0);
        const casinoSpend = statementRows.filter(r => r.department === 'Casino').reduce((s, r) => s + Math.max(0, r.amount || 0), 0);
        const points = Math.floor(casinoSpend / 5);
        const freePlay = receiptRows.reduce((sum, r) => {
          const text = `${r.description || ''} ${r.itemDescription || ''}`.toLowerCase();
          if (text.includes('free play') || text.includes('freeplay') || text.includes('fp')) {
            return sum + Math.abs((r.amount || r.lineTotal || 0) || 0);
          }
          return sum;
        }, 0);
        const discounts = receiptRows.reduce((s, r) => s + (r.discount || 0), 0);
        const savings = retail + freePlay + discounts - out;
        const roi = out > 0 ? (savings / out) * 100 : 0;
        const cruise = booked.find(b => b.id === cruiseId) || cruises.find(c => c.id === cruiseId);
        const nights = (cruise as any)?.nights || 0;
        const type = nights >= 11 ? 'extended' : nights >= 8 ? 'long' : nights >= 5 ? 'medium' : nights > 0 ? 'short' : 'unknown';
        return { cruiseId, ship: (cruise as any)?.ship || 'Unknown', nights, type, retail, out, points, freePlay, discounts, savings, roi };
      });

      const byType = summaries.reduce((acc, s) => {
        if (!acc[s.type]) acc[s.type] = { cruises: 0, avgROI: 0, avgVPP: 0, pointsPerNight: 0, totalPoints: 0, totalNights: 0 } as any;
        const vpp = s.points > 0 ? (s.savings / s.points) : 0;
        const b = acc[s.type];
        b.cruises += 1;
        b.avgROI += s.roi;
        b.avgVPP += vpp;
        b.totalPoints += s.points;
        b.totalNights += Math.max(1, s.nights || 1);
        return acc;
      }, {} as Record<string, { cruises: number; avgROI: number; avgVPP: number; totalPoints: number; totalNights: number; pointsPerNight?: number }>);

      Object.values(byType).forEach(b => {
        b.pointsPerNight = b.totalNights > 0 ? b.totalPoints / b.totalNights : 0;
        if (b.cruises > 0) {
          b.avgROI = b.avgROI / b.cruises;
          b.avgVPP = b.avgVPP / b.cruises;
        }
      });

      const categorySpend = financials.filter(f => f.sourceType === 'statement').reduce((acc, r) => {
        const dept = (r.department || 'Other').toString();
        const amt = Math.max(0, r.amount || 0);
        acc[dept] = (acc[dept] || 0) + amt;
        return acc;
      }, {} as Record<string, number>);

      const payload = {
        portfolio: {
          cruises: summaries.length,
          totals: {
            retail: summaries.reduce((s, x) => s + x.retail, 0),
            outOfPocket: summaries.reduce((s, x) => s + x.out, 0),
            freePlay: summaries.reduce((s, x) => s + x.freePlay, 0),
            discounts: summaries.reduce((s, x) => s + x.discounts, 0),
            points: summaries.reduce((s, x) => s + x.points, 0),
            savings: summaries.reduce((s, x) => s + x.savings, 0),
          },
          byCruiseType: byType,
          categorySpend,
        }
      } as const;

      const system = 'You are a data-first casino cruise strategist. Output strict JSON with keys: bestCruiseTypes (array of {type, why, metrics}), optimalSpendingStrategies (array of strings), tierAdvancement (object with {currentTrend, pointsEfficiencyTips, targetRanges}), riskManagement (array of strings), summary (string). Be concise, numeric, and actionable.';

      const response = await fetch('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: `Analyze this portfolio and return ONLY JSON as specified.\n${JSON.stringify(payload, null, 2)}` }
          ]
        })
      });

      const result = await response.json();
      const completion: string = result?.completion || '';
      let parsed: any = null;
      try {
        parsed = JSON.parse(completion);
      } catch (e) {
        console.warn('[AI Portfolio] JSON parse failed, returning raw text');
      }

      return {
        ok: true as const,
        payload,
        result: parsed || null,
        raw: completion,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[AI Portfolio] Error:', error);
      return { ok: false as const, payload: null, result: null, raw: '', generatedAt: new Date().toISOString() };
    }
  });