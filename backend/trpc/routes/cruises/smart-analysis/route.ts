import { publicProcedure } from '../../../create-context';
import { z } from 'zod';
import { memoryStore } from '../../_stores/memory';
import { Cruise, CasinoOffer } from '../../../../../types/models';

interface UserPreferences {
  preferredCabinTypes: string[];
  preferredCruiseLengths: number[];
  preferredDeparturePorts: string[];
  homeLocation: string;
  maxTravelDistance: number;
  minROI: number;
  maxOutOfPocket: number;
}

interface SmartAnalysis {
  cruiseId: string;
  ship: string;
  itinerary: string;
  departureDate: string;
  nights: number;
  departurePort: string;
  
  // Preference Scoring
  preferenceScore: number;
  cabinTypeScore: number;
  lengthScore: number;
  portScore: number;
  
  // Financial Analysis
  estimatedROI: number;
  outOfPocketCost: number;
  totalValue: number;
  coinInRequired: number;
  
  // Offer Analysis
  bestOffer?: {
    offerCode: string;
    offerType: string;
    cabinType: string;
    pointsRequired: number;
    freePlayValue: number;
  };
  
  // Scheduling
  hasConflicts: boolean;
  conflictDetails?: string[];
  
  // Distance & Travel
  estimatedTravelCost: number;
  travelDistance: number;
  
  // Overall Recommendation
  recommendationScore: number;
  recommendation: 'highly_recommended' | 'recommended' | 'consider' | 'not_recommended';
  reasons: string[];
}

// Default user preferences based on project requirements
const DEFAULT_USER_PREFERENCES: UserPreferences = {
  preferredCabinTypes: ['Suite', 'Junior Suite', 'Balcony', 'Oceanview', 'Interior'], // Suite preferred
  preferredCruiseLengths: [10, 11, 12, 13, 14, 7, 8, 9], // 10-14 nights preferred
  preferredDeparturePorts: ['Los Angeles', 'Galveston', 'Long Beach', 'San Pedro'], // Closest to Phoenix
  homeLocation: 'Phoenix, Arizona',
  maxTravelDistance: 2000, // miles
  minROI: 15, // 15% minimum ROI
  maxOutOfPocket: 3000 // $3000 max out of pocket
};

// Port distance mapping from Phoenix, AZ
const PORT_DISTANCES: { [key: string]: number } = {
  'Los Angeles': 370,
  'Long Beach': 370,
  'San Pedro': 370,
  'Galveston': 1180,
  'Miami': 2000,
  'Fort Lauderdale': 2000,
  'Port Canaveral': 1900,
  'Tampa': 1800,
  'New Orleans': 1100,
  'Charleston': 1600,
  'Baltimore': 2100,
  'New York': 2400,
  'Boston': 2600,
  'Seattle': 1420,
  'Vancouver': 1500
};

// Estimated airfare costs from Phoenix
const AIRFARE_COSTS: { [key: string]: number } = {
  'Los Angeles': 0, // Driving distance
  'Long Beach': 0,
  'San Pedro': 0,
  'Galveston': 250,
  'Miami': 350,
  'Fort Lauderdale': 350,
  'Port Canaveral': 320,
  'Tampa': 300,
  'New Orleans': 280,
  'Charleston': 320,
  'Baltimore': 380,
  'New York': 400,
  'Boston': 420,
  'Seattle': 200,
  'Vancouver': 250
};

export const smartAnalysisProcedure = publicProcedure
  .input(z.object({
    cruiseId: z.string().optional(),
    preferences: z.object({
      preferredCabinTypes: z.array(z.string()).optional(),
      preferredCruiseLengths: z.array(z.number()).optional(),
      preferredDeparturePorts: z.array(z.string()).optional(),
      homeLocation: z.string().optional(),
      maxTravelDistance: z.number().optional(),
      minROI: z.number().optional(),
      maxOutOfPocket: z.number().optional()
    }).optional(),
    limit: z.number().default(20)
  }))
  .query(async ({ input }) => {
    console.log('[SmartAnalysis] Starting smart cruise analysis with input:', input);
    
    try {
      const userPrefs = { ...DEFAULT_USER_PREFERENCES, ...input.preferences };
      
      // Get cruises to analyze
      let cruisesToAnalyze: Cruise[] = [];
      
      if (input.cruiseId) {
        const cruise = memoryStore.getCruise(input.cruiseId);
        if (cruise) {
          cruisesToAnalyze = [cruise];
        }
      } else {
        // Get available cruises (not booked) departing in next 12 months
        const allCruises = memoryStore.getCruises();
        const now = new Date();
        const oneYearFromNow = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));
        
        cruisesToAnalyze = allCruises
          .filter(cruise => {
            const departureDate = new Date(cruise.departureDate);
            return departureDate >= now && 
                   departureDate <= oneYearFromNow && 
                   !cruise.bookingId; // Only available cruises
          })
          .slice(0, input.limit);
      }
      
      console.log('[SmartAnalysis] Analyzing', cruisesToAnalyze.length, 'cruises');
      
      const analyses: SmartAnalysis[] = [];
      const casinoOffers = memoryStore.getCasinoOffers();
      const calendarEvents = memoryStore.getCalendarEvents();
      
      for (const cruise of cruisesToAnalyze) {
        const analysis = await analyzeCruise(cruise, casinoOffers, calendarEvents, userPrefs);
        analyses.push(analysis);
      }
      
      // Sort by recommendation score (highest first)
      analyses.sort((a, b) => b.recommendationScore - a.recommendationScore);
      
      const summary = {
        totalAnalyzed: analyses.length,
        highlyRecommended: analyses.filter(a => a.recommendation === 'highly_recommended').length,
        recommended: analyses.filter(a => a.recommendation === 'recommended').length,
        averageROI: analyses.reduce((sum, a) => sum + a.estimatedROI, 0) / analyses.length,
        averageOutOfPocket: analyses.reduce((sum, a) => sum + a.outOfPocketCost, 0) / analyses.length,
        conflictsDetected: analyses.filter(a => a.hasConflicts).length
      };
      
      console.log('[SmartAnalysis] Analysis complete:', summary);
      
      return {
        analyses,
        summary,
        userPreferences: userPrefs
      };
      
    } catch (error) {
      console.error('[SmartAnalysis] Error in smart analysis:', error);
      throw new Error(`Smart analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

async function analyzeCruise(
  cruise: Cruise, 
  casinoOffers: CasinoOffer[], 
  calendarEvents: any[], 
  userPrefs: UserPreferences
): Promise<SmartAnalysis> {
  // Normalize nights as a number and fix 0/NaN values
  const rawNights = (cruise as any)?.nights as unknown;
  const parsedNights = typeof rawNights === 'string' ? parseInt(rawNights, 10) : (typeof rawNights === 'number' ? rawNights : NaN);
  const safeNights = Number.isFinite(parsedNights) && parsedNights > 0 ? parsedNights : 7;

  // 1. Preference Scoring
  const cabinTypeScore = calculateCabinTypeScore(cruise.stateroomTypes || [], userPrefs.preferredCabinTypes);
  const lengthScore = calculateLengthScore(safeNights, userPrefs.preferredCruiseLengths);
  const portScore = calculatePortScore(cruise.departurePort || '', userPrefs.preferredDeparturePorts);
  const preferenceScore = (cabinTypeScore + lengthScore + portScore) / 3;
  
  // 2. Travel Cost Analysis
  const { travelDistance, estimatedTravelCost } = calculateTravelCosts(cruise.departurePort || '', userPrefs.homeLocation);
  
  // 3. Find Best Casino Offer
  const bestOffer = findBestCasinoOffer(cruise, casinoOffers);
  
  // 4. Financial Analysis
  const financialAnalysis = calculateFinancialMetrics({ ...cruise, nights: safeNights }, bestOffer, estimatedTravelCost);
  
  // 5. Scheduling Conflict Detection
  const { hasConflicts, conflictDetails } = detectSchedulingConflicts({ ...cruise, nights: safeNights }, calendarEvents);
  
  // 6. Generate Recommendation
  const { recommendationScore, recommendation, reasons } = generateRecommendation(
    { ...cruise, nights: safeNights }, 
    preferenceScore, 
    financialAnalysis, 
    hasConflicts, 
    travelDistance, 
    userPrefs
  );
  
  return {
    cruiseId: cruise.id,
    ship: cruise.ship,
    itinerary: cruise.itineraryName || 'Unknown Itinerary',
    departureDate: cruise.departureDate,
    nights: safeNights,
    departurePort: cruise.departurePort || 'Unknown Port',
    
    preferenceScore,
    cabinTypeScore,
    lengthScore,
    portScore,
    
    estimatedROI: financialAnalysis.roi,
    outOfPocketCost: financialAnalysis.outOfPocket,
    totalValue: financialAnalysis.totalValue,
    coinInRequired: financialAnalysis.coinIn,
    
    bestOffer,
    
    hasConflicts,
    conflictDetails,
    
    estimatedTravelCost,
    travelDistance,
    
    recommendationScore,
    recommendation,
    reasons
  };
}

function calculateCabinTypeScore(availableCabins: string[], preferredCabins: string[]): number {
  if (availableCabins.length === 0) return 0;
  
  // Find the best available cabin type based on preference order
  for (let i = 0; i < preferredCabins.length; i++) {
    const preferred = preferredCabins[i].toLowerCase();
    if (availableCabins.some(cabin => cabin.toLowerCase().includes(preferred))) {
      return 100 - (i * 15); // Higher score for more preferred cabin types
    }
  }
  
  return 20; // Base score if no preferred cabin types available
}

function calculateLengthScore(cruiseNights: number, preferredLengths: number[]): number {
  // Exact match gets highest score
  if (preferredLengths.includes(cruiseNights)) {
    const index = preferredLengths.indexOf(cruiseNights);
    return 100 - (index * 10);
  }
  
  // Close matches get partial scores
  const closestLength = preferredLengths.reduce((prev, curr) => 
    Math.abs(curr - cruiseNights) < Math.abs(prev - cruiseNights) ? curr : prev
  );
  
  const difference = Math.abs(closestLength - cruiseNights);
  return Math.max(0, 70 - (difference * 10));
}

function calculatePortScore(departurePort: string, preferredPorts: string[]): number {
  if (!departurePort) return 0;
  
  const portLower = departurePort.toLowerCase();
  
  for (let i = 0; i < preferredPorts.length; i++) {
    const preferred = preferredPorts[i].toLowerCase();
    if (portLower.includes(preferred)) {
      return 100 - (i * 20); // Higher score for more preferred ports
    }
  }
  
  return 30; // Base score for non-preferred ports
}

function calculateTravelCosts(departurePort: string, homeLocation: string): { travelDistance: number; estimatedTravelCost: number } {
  if (!departurePort) {
    return { travelDistance: 0, estimatedTravelCost: 0 };
  }
  
  // Find matching port in our distance/cost mappings
  const portKey = Object.keys(PORT_DISTANCES).find(port => 
    departurePort.toLowerCase().includes(port.toLowerCase())
  );
  
  if (portKey) {
    const distance = PORT_DISTANCES[portKey];
    const airfare = AIRFARE_COSTS[portKey];
    
    // Add ground transportation costs
    const groundTransport = distance <= 400 ? 100 : 150; // Gas/parking or airport transfers
    
    return {
      travelDistance: distance,
      estimatedTravelCost: airfare + groundTransport
    };
  }
  
  // Default for unknown ports
  return { travelDistance: 1500, estimatedTravelCost: 400 };
}

function findBestCasinoOffer(cruise: Cruise, casinoOffers: CasinoOffer[]): SmartAnalysis['bestOffer'] {
  // Find offers that match this cruise's offer code
  const matchingOffers = casinoOffers.filter(offer => 
    cruise.offerCode && offer.offerCode === cruise.offerCode
  );
  
  if (matchingOffers.length === 0) return undefined;
  
  // For now, return the first matching offer
  // In a real implementation, we'd analyze which offer provides the best value
  const offer = matchingOffers[0];
  
  return {
    offerCode: offer.offerCode,
    offerType: offer.offerType,
    cabinType: 'Suite', // Default to suite for casino offers
    pointsRequired: 15000, // Estimated based on offer type
    freePlayValue: extractFreePlayValue(offer.offerName)
  };
}

function extractFreePlayValue(offerName: string): number {
  const match = offerName.match(/\$(\d+(?:,\d+)?)/);  
  if (match) {
    return parseInt(match[1].replace(',', ''));
  }
  return 500; // Default free play value
}

function calculateFinancialMetrics(cruise: Cruise, bestOffer: SmartAnalysis['bestOffer'], travelCost: number) {
  const baseCruisePrice = memoryStore.calculateCruisePricing(cruise.ship, cruise.nights || 7, 'Suite');
  const taxes = Math.round(baseCruisePrice * 0.15);
  const totalCruiseValue = baseCruisePrice + taxes;
  
  if (!bestOffer) {
    return {
      roi: 0,
      outOfPocket: totalCruiseValue + travelCost,
      totalValue: totalCruiseValue,
      coinIn: 0
    };
  }
  
  // Calculate casino offer value
  const coinIn = bestOffer.pointsRequired * 5; // $5 per point
  const freePlayValue = bestOffer.freePlayValue;
  const cruiseSavings = totalCruiseValue * 0.8; // Assume 80% savings on cruise fare
  const totalValue = cruiseSavings + freePlayValue;
  const outOfPocket = coinIn + travelCost;
  
  const roi = outOfPocket > 0 ? ((totalValue - outOfPocket) / outOfPocket) * 100 : 0;
  
  return {
    roi,
    outOfPocket,
    totalValue,
    coinIn
  };
}

function detectSchedulingConflicts(cruise: Cruise, calendarEvents: any[]): { hasConflicts: boolean; conflictDetails?: string[] } {
  if (!cruise.departureDate) {
    return { hasConflicts: false };
  }

  let returnDateStr = cruise.returnDate;
  if (!returnDateStr) {
    const rawNights = (cruise as any)?.nights as unknown;
    const parsedNights = typeof rawNights === 'string' ? parseInt(rawNights, 10) : (typeof rawNights === 'number' ? rawNights : NaN);
    const safeNights = Number.isFinite(parsedNights) && parsedNights > 0 ? parsedNights : 7;
    const computed = memoryStore.calculateReturnDate(cruise.departureDate, safeNights);
    if (computed) returnDateStr = computed;
  }
  if (!returnDateStr) {
    return { hasConflicts: false };
  }
  
  const cruiseStart = new Date(cruise.departureDate);
  const cruiseEnd = new Date(returnDateStr);
  
  // Add buffer days for travel
  const bufferStart = new Date(cruiseStart);
  bufferStart.setDate(bufferStart.getDate() - 1);
  const bufferEnd = new Date(cruiseEnd);
  bufferEnd.setDate(bufferEnd.getDate() + 1);
  
  const conflicts: string[] = [];
  
  for (const event of calendarEvents) {
    const eventStart = new Date(event.startDate);
    const eventEnd = new Date(event.endDate || event.startDate);
    
    // Check for overlap
    if (eventStart <= bufferEnd && eventEnd >= bufferStart) {
      conflicts.push(`${event.summary} (${event.startDate} - ${event.endDate || event.startDate})`);
    }
  }
  
  return {
    hasConflicts: conflicts.length > 0,
    conflictDetails: conflicts.length > 0 ? conflicts : undefined
  };
}

function generateRecommendation(
  cruise: Cruise,
  preferenceScore: number,
  financialAnalysis: { roi: number; outOfPocket: number },
  hasConflicts: boolean,
  travelDistance: number,
  userPrefs: UserPreferences
): { recommendationScore: number; recommendation: SmartAnalysis['recommendation']; reasons: string[] } {
  
  const reasons: string[] = [];
  let score = 0;
  
  // Preference scoring (0-40 points)
  score += preferenceScore * 0.4;
  if (preferenceScore >= 80) {
    reasons.push('✅ Excellent match for your preferences');
  } else if (preferenceScore >= 60) {
    reasons.push('👍 Good match for your preferences');
  } else {
    reasons.push('⚠️ Limited match for your preferences');
  }
  
  // ROI scoring (0-30 points)
  if (financialAnalysis.roi >= userPrefs.minROI) {
    const roiPoints = Math.min(30, (financialAnalysis.roi / 100) * 30);
    score += roiPoints;
    if (financialAnalysis.roi >= 50) {
      reasons.push(`💰 Excellent ROI: ${financialAnalysis.roi.toFixed(1)}%`);
    } else {
      reasons.push(`💵 Good ROI: ${financialAnalysis.roi.toFixed(1)}%`);
    }
  } else {
    reasons.push(`📉 ROI below minimum: ${financialAnalysis.roi.toFixed(1)}%`);
  }
  
  // Out of pocket scoring (0-20 points)
  if (financialAnalysis.outOfPocket <= userPrefs.maxOutOfPocket) {
    score += 20;
    reasons.push(`✅ Within budget: $${financialAnalysis.outOfPocket.toLocaleString()}`);
  } else {
    const overBudget = financialAnalysis.outOfPocket - userPrefs.maxOutOfPocket;
    reasons.push(`💸 Over budget by $${overBudget.toLocaleString()}`);
  }
  
  // Travel distance scoring (0-10 points)
  if (travelDistance <= userPrefs.maxTravelDistance) {
    score += 10;
    if (travelDistance <= 500) {
      reasons.push('🚗 Close to home - easy travel');
    } else {
      reasons.push('✈️ Reasonable travel distance');
    }
  } else {
    reasons.push('🌍 Long travel distance required');
  }
  
  // Conflict penalty
  if (hasConflicts) {
    score -= 20;
    reasons.push('⚠️ Scheduling conflicts detected');
  } else {
    reasons.push('📅 No scheduling conflicts');
  }
  
  // Determine recommendation level
  let recommendation: SmartAnalysis['recommendation'];
  if (score >= 80) {
    recommendation = 'highly_recommended';
  } else if (score >= 60) {
    recommendation = 'recommended';
  } else if (score >= 40) {
    recommendation = 'consider';
  } else {
    recommendation = 'not_recommended';
  }
  
  return {
    recommendationScore: Math.round(score),
    recommendation,
    reasons
  };
}

export const calculateROIProcedure = publicProcedure
  .input(z.object({
    cruiseId: z.string(),
    cabinType: z.enum(['Interior', 'Oceanview', 'Balcony', 'Suite', 'Junior Suite']).default('Suite'),
    offerCode: z.string().optional(),
    pointsToSpend: z.number().default(15000),
    customTravelCost: z.number().optional(),
    customPerks: z.array(z.string()).optional()
  }))
  .query(async ({ input }) => {
    console.log('[SmartAnalysis] Calculating ROI for cruise:', input);
    
    try {
      const cruise = memoryStore.getCruise(input.cruiseId);
      if (!cruise) {
        throw new Error(`Cruise not found: ${input.cruiseId}`);
      }
      
      // Get actual receipt and statement data for this cruise
      const receipts = memoryStore.getReceiptsByCruiseId(input.cruiseId);
      const statements = memoryStore.getCruiseStatementsByCruiseId(input.cruiseId);
      
      console.log(`[SmartAnalysis] Found ${receipts.length} receipts and ${statements.length} statements for cruise ${input.cruiseId}`);
      
      const casinoOffers = memoryStore.getCasinoOffers();
      const payTable = memoryStore.getCasinoPayTable();
      
      // Find matching casino offer
      let selectedOffer: CasinoOffer | undefined;
      if (input.offerCode) {
        selectedOffer = casinoOffers.find(offer => offer.offerCode === input.offerCode);
      } else {
        selectedOffer = casinoOffers.find(offer => cruise.offerCode && offer.offerCode === cruise.offerCode);
      }
      
      // Use actual data from receipts/statements if available, otherwise calculate estimates
      let actualPaidFare = 0;
      let actualRetailValue = 0;
      let actualCasinoSpend = 0;
      let actualTotalSpent = 0;
      let actualLineItems: any[] = [];
      let hasActualData = false;
      
      // Extract data from receipts
      if (receipts.length > 0) {
        hasActualData = true;
        const receipt = receipts[0]; // Use first receipt
        actualPaidFare = receipt.totalPaid || 0;
        actualRetailValue = (receipt.totalFare || 0) + (receipt.taxesAndFees || 0);
        console.log(`[SmartAnalysis] Using receipt data: paid=${actualPaidFare}, retail=${actualRetailValue}`);
      }
      
      // Extract data from statements (more detailed)
      if (statements.length > 0) {
        hasActualData = true;
        const statement = statements[0]; // Use first statement
        actualCasinoSpend = statement.clubRoyaleEntertainmentCharges || statement.casino || 0;
        actualTotalSpent = statement.totalCharges || 0;
        actualLineItems = statement.lineItems || [];
        
        // If we don't have receipt data, use statement data
        if (!actualRetailValue) {
          actualRetailValue = (statement.cruiseFare || 0) + (statement.taxesAndFees || 0);
        }
        if (!actualPaidFare) {
          actualPaidFare = statement.totalPayments || 0;
        }
        
        console.log(`[SmartAnalysis] Using statement data: casino=${actualCasinoSpend}, total=${actualTotalSpent}, lineItems=${actualLineItems.length}`);
      }
      
      // Calculate base cruise pricing (fallback if no actual data)
      const estimatedCruisePrice = memoryStore.calculateCruisePricing(cruise.ship, cruise.nights || 7, input.cabinType);
      const estimatedTaxes = Math.round(estimatedCruisePrice * 0.15);
      const estimatedRetailValue = estimatedCruisePrice + estimatedTaxes;
      
      // Use actual data if available, otherwise use estimates
      const retailValue = actualRetailValue || estimatedRetailValue;
      const paidFare = actualPaidFare || estimatedCruisePrice;
      
      // Calculate travel costs
      const travelCost = input.customTravelCost || calculateTravelCosts(cruise.departurePort || '', 'Phoenix, Arizona').estimatedTravelCost;
      
      // Find pay table entry for points
      const payTableEntry = payTable.find(entry => input.pointsToSpend >= entry.points) || payTable[payTable.length - 1];
      
      // Calculate casino metrics
      const coinInRequired = actualCasinoSpend || (input.pointsToSpend * 5); // Use actual casino spend if available
      const pointsEarned = actualCasinoSpend ? Math.floor(actualCasinoSpend / 5) : input.pointsToSpend;
      
      // Calculate free play value
      const freePlayValue = selectedOffer ? extractFreePlayValue(selectedOffer.offerName) : 500;
      
      // Calculate perks value from actual line items if available
      let actualPerksValue = 0;
      if (actualLineItems.length > 0) {
        actualPerksValue = actualLineItems.reduce((total, item) => {
          const category = item.category?.toLowerCase() || '';
          if (['dining', 'beverages', 'spa', 'specialty_dining', 'internet', 'photos'].includes(category)) {
            return total + Math.abs(item.amount || 0);
          }
          return total;
        }, 0);
        console.log(`[SmartAnalysis] Calculated actual perks value from line items: ${actualPerksValue}`);
      }
      
      const perksValue = actualPerksValue || (input.customPerks ? 
        calculatePerksValue(input.customPerks) : 
        calculatePerksValue([selectedOffer?.offerName || 'Standard Casino Offer']));
      
      // Calculate cruise savings (what you saved vs retail)
      const cruiseSavings = Math.max(0, retailValue - paidFare);
      
      // Calculate total value and costs
      const totalValue = cruiseSavings + freePlayValue + perksValue;
      const totalOutOfPocket = coinInRequired + travelCost;
      const netSavings = totalValue - totalOutOfPocket;
      const roi = totalOutOfPocket > 0 ? (netSavings / totalOutOfPocket) * 100 : 0;
      
      // Calculate cost per point and value per point
      const costPerPoint = pointsEarned > 0 ? totalOutOfPocket / pointsEarned : 0;
      const valuePerPoint = pointsEarned > 0 ? totalValue / pointsEarned : 0;
      
      // Calculate break-even analysis
      const breakEvenPoints = totalOutOfPocket > 0 ? Math.ceil(totalOutOfPocket / 5) : 0;
      const profitMargin = totalValue > 0 ? (netSavings / totalValue) * 100 : 0;
      
      // Risk assessment
      let riskLevel: 'low' | 'medium' | 'high';
      if (roi >= 25 && costPerPoint <= 2) {
        riskLevel = 'low';
      } else if (roi >= 10 && costPerPoint <= 3) {
        riskLevel = 'medium';
      } else {
        riskLevel = 'high';
      }
      
      // Generate recommendations based on actual vs estimated data
      const recommendations: string[] = [];
      
      if (hasActualData) {
        recommendations.push('📊 Based on actual receipt/statement data');
      } else {
        recommendations.push('📈 Based on estimated data - upload receipts/statements for accuracy');
      }
      
      if (roi >= 50) {
        recommendations.push('🎯 Excellent ROI - Highly recommended investment');
      } else if (roi >= 25) {
        recommendations.push('✅ Good ROI - Solid investment opportunity');
      } else if (roi >= 10) {
        recommendations.push('⚠️ Modest ROI - Consider other options');
      } else {
        recommendations.push('❌ Poor ROI - Not recommended');
      }
      
      if (valuePerPoint >= 2) {
        recommendations.push('💎 Excellent value per point (>$2)');
      } else if (valuePerPoint >= 1) {
        recommendations.push('👍 Good value per point (>$1)');
      } else {
        recommendations.push('📉 Low value per point (<$1)');
      }
      
      if (costPerPoint <= 2) {
        recommendations.push('💰 Low cost per point - efficient spending');
      } else if (costPerPoint <= 3) {
        recommendations.push('💵 Moderate cost per point');
      } else {
        recommendations.push('💸 High cost per point - expensive');
      }
      
      // Add insights from actual spending patterns
      if (actualLineItems.length > 0) {
        const spendingByCategory = actualLineItems.reduce((acc, item) => {
          const category = item.category || 'OTHER';
          acc[category] = (acc[category] || 0) + Math.abs(item.amount || 0);
          return acc;
        }, {} as Record<string, number>);
        
        const topSpendingCategory = Object.entries(spendingByCategory)
          .sort(([,a], [,b]) => (b as number) - (a as number))[0];
        
        if (topSpendingCategory) {
          recommendations.push(`💳 Highest spending: ${topSpendingCategory[0]} (${(topSpendingCategory[1] as number).toFixed(0)})`);
        }
      }
      
      // Scenario analysis
      const scenarios = {
        conservative: {
          roi: roi * 0.8,
          totalValue: totalValue * 0.8,
          description: 'Conservative estimate (20% lower value)'
        },
        optimistic: {
          roi: roi * 1.2,
          totalValue: totalValue * 1.2,
          description: 'Optimistic estimate (20% higher value)'
        },
        worstCase: {
          roi: roi * 0.5,
          totalValue: totalValue * 0.5,
          description: 'Worst case scenario (50% lower value)'
        }
      };
      
      const result = {
        cruise: {
          id: cruise.id,
          ship: cruise.ship,
          itinerary: cruise.itineraryName,
          departureDate: cruise.departureDate,
          nights: cruise.nights,
          cabinType: input.cabinType
        },
        offer: selectedOffer ? {
          code: selectedOffer.offerCode,
          type: selectedOffer.offerType,
          name: selectedOffer.offerName,
          expires: selectedOffer.expires
        } : null,
        payTableEntry: {
          points: payTableEntry.points,
          reward: payTableEntry.reward,
          nextCruiseBonus: payTableEntry.nextCruiseBonus,
          cabinTypes: payTableEntry.cabinTypes
        },
        financial: {
          retailValue,
          cruiseSavings,
          freePlayValue,
          perksValue,
          totalValue,
          coinInRequired,
          travelCost,
          totalOutOfPocket,
          netSavings,
          roi,
          costPerPoint,
          valuePerPoint,
          breakEvenPoints,
          profitMargin
        },
        analysis: {
          riskLevel,
          recommendations,
          scenarios
        },
        breakdown: {
          baseCruisePrice: hasActualData ? paidFare : estimatedCruisePrice,
          taxes: hasActualData ? (retailValue - paidFare) : estimatedTaxes,
          travelCost,
          coinIn: coinInRequired,
          savings: cruiseSavings,
          freePlay: freePlayValue,
          perks: perksValue
        },
        actualData: {
          hasReceiptData: receipts.length > 0,
          hasStatementData: statements.length > 0,
          actualCasinoSpend,
          actualTotalSpent,
          pointsEarned,
          lineItemsCount: actualLineItems.length,
          spendingBreakdown: actualLineItems.length > 0 ? 
            actualLineItems.reduce((acc, item) => {
              const category = item.category || 'OTHER';
              acc[category] = (acc[category] || 0) + Math.abs(item.amount || 0);
              return acc;
            }, {} as Record<string, number>) : {}
        }
      };
      
      console.log('[SmartAnalysis] ROI calculation complete:', {
        cruiseId: input.cruiseId,
        roi: roi.toFixed(1) + '%',
        totalValue: totalValue.toLocaleString(),
        outOfPocket: totalOutOfPocket.toLocaleString(),
        riskLevel,
        hasActualData,
        actualCasinoSpend
      });
      
      return result;
      
    } catch (error) {
      console.error('[SmartAnalysis] Error calculating ROI:', error);
      throw new Error(`ROI calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

// Helper function to calculate perks value (moved from memory store)
function calculatePerksValue(perks: string[]): number {
  let totalValue = 0;
  
  perks.forEach(perk => {
    const perkLower = perk.toLowerCase();
    
    // Dining perks
    if (perkLower.includes('specialty dining') || perkLower.includes('chef\'s table')) {
      totalValue += 150;
    } else if (perkLower.includes('dining package')) {
      totalValue += 300;
    }
    
    // Beverage perks
    if (perkLower.includes('beverage package') || perkLower.includes('drink package')) {
      totalValue += 200;
    } else if (perkLower.includes('wine tasting')) {
      totalValue += 75;
    }
    
    // Spa perks
    if (perkLower.includes('spa credit') || perkLower.includes('spa treatment')) {
      totalValue += 100;
    }
    
    // Shore excursion perks
    if (perkLower.includes('shore excursion') || perkLower.includes('excursion credit')) {
      totalValue += 200;
    }
    
    // Internet perks
    if (perkLower.includes('internet') || perkLower.includes('wifi')) {
      totalValue += 100;
    }
    
    // Gratuities
    if (perkLower.includes('gratuities') || perkLower.includes('tips')) {
      totalValue += 150;
    }
    
    // Free play
    const freePlayMatch = perk.match(/\$(\d+)\s*free\s*play/i);
    if (freePlayMatch) {
      totalValue += parseInt(freePlayMatch[1]);
    }
  });
  
  return totalValue;
}

export const getRecommendationsProcedure = publicProcedure
  .input(z.object({
    limit: z.number().default(10),
    minScore: z.number().default(60)
  }))
  .query(async ({ input }) => {
    console.log('[SmartAnalysis] Getting top recommendations with input:', input);
    
    try {
      // Get smart analysis for all available cruises
      const userPrefs = DEFAULT_USER_PREFERENCES;
      
      // Get available cruises (not booked) departing in next 12 months
      const allCruises = memoryStore.getCruises();
      const now = new Date();
      const oneYearFromNow = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));
      
      const cruisesToAnalyze = allCruises
        .filter(cruise => {
          const departureDate = new Date(cruise.departureDate);
          return departureDate >= now && 
                 departureDate <= oneYearFromNow && 
                 !cruise.bookingId; // Only available cruises
        })
        .slice(0, 50);
      
      const analyses: SmartAnalysis[] = [];
      const casinoOffers = memoryStore.getCasinoOffers();
      const calendarEvents = memoryStore.getCalendarEvents();
      
      for (const cruise of cruisesToAnalyze) {
        const analysis = await analyzeCruise(cruise, casinoOffers, calendarEvents, userPrefs);
        analyses.push(analysis);
      }
      
      // Sort by recommendation score (highest first)
      analyses.sort((a, b) => b.recommendationScore - a.recommendationScore);
      
      const analysisResult = { analyses };
      
      // Filter and sort recommendations
      const topRecommendations = analysisResult.analyses
        .filter((analysis: SmartAnalysis) => analysis.recommendationScore >= input.minScore)
        .slice(0, input.limit);
      
      console.log('[SmartAnalysis] Returning', topRecommendations.length, 'top recommendations');
      
      return {
        recommendations: topRecommendations,
        summary: {
          totalEvaluated: analysisResult.analyses.length,
          qualifyingRecommendations: topRecommendations.length,
          averageScore: topRecommendations.reduce((sum: number, r: SmartAnalysis) => sum + r.recommendationScore, 0) / topRecommendations.length || 0
        }
      };
      
    } catch (error) {
      console.error('[SmartAnalysis] Error getting recommendations:', error);
      throw new Error(`Failed to get recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

export const getCruiseFinancialSummaryProcedure = publicProcedure
  .input(z.object({
    cruiseId: z.string().optional()
  }))
  .query(async ({ input }) => {
    console.log('[SmartAnalysis] Getting cruise financial summary for:', input.cruiseId || 'all cruises');
    
    try {
      let cruisesToAnalyze: Cruise[] = [];
      
      if (input.cruiseId) {
        const cruise = memoryStore.getCruise(input.cruiseId);
        if (cruise) {
          cruisesToAnalyze = [cruise];
        }
      } else {
        // Get all cruises with receipts or statements
        const allCruises = memoryStore.getCruises();
        cruisesToAnalyze = allCruises.filter(cruise => {
          const hasReceipts = memoryStore.getReceiptsByCruiseId(cruise.id).length > 0;
          const hasStatements = memoryStore.getCruiseStatementsByCruiseId(cruise.id).length > 0;
          return hasReceipts || hasStatements;
        });
      }
      
      console.log(`[SmartAnalysis] Analyzing financial data for ${cruisesToAnalyze.length} cruises`);
      
      const cruiseFinancials = cruisesToAnalyze.map(cruise => {
        const receipts = memoryStore.getReceiptsByCruiseId(cruise.id);
        const statements = memoryStore.getCruiseStatementsByCruiseId(cruise.id);
        
        let totalPaid = 0;
        let totalRetailValue = 0;
        let casinoSpend = 0;
        let totalSpent = 0;
        let lineItems: any[] = [];
        
        // Extract data from receipts
        if (receipts.length > 0) {
          const receipt = receipts[0];
          totalPaid = receipt.totalPaid || 0;
          totalRetailValue = (receipt.totalFare || 0) + (receipt.taxesAndFees || 0);
        }
        
        // Extract data from statements
        if (statements.length > 0) {
          const statement = statements[0];
          casinoSpend = statement.clubRoyaleEntertainmentCharges || statement.casino || 0;
          totalSpent = statement.totalCharges || 0;
          lineItems = statement.lineItems || [];
          
          // Use statement data if receipt data not available
          if (!totalRetailValue) {
            totalRetailValue = (statement.cruiseFare || 0) + (statement.taxesAndFees || 0);
          }
          if (!totalPaid) {
            totalPaid = statement.totalPayments || 0;
          }
        }
        
        // Calculate spending by category
        const spendingByCategory = lineItems.reduce((acc, item) => {
          const category = item.category || 'OTHER';
          acc[category] = (acc[category] || 0) + Math.abs(item.amount || 0);
          return acc;
        }, {} as Record<string, number>);
        
        // Calculate savings and ROI
        const savings = Math.max(0, totalRetailValue - totalPaid);
        const pointsEarned = casinoSpend > 0 ? Math.floor(casinoSpend / 5) : 0;
        const roi = casinoSpend > 0 ? ((savings - casinoSpend) / casinoSpend) * 100 : 0;
        
        return {
          cruiseId: cruise.id,
          ship: cruise.ship,
          itinerary: cruise.itineraryName,
          departureDate: cruise.departureDate,
          nights: cruise.nights,
          hasReceiptData: receipts.length > 0,
          hasStatementData: statements.length > 0,
          financial: {
            totalPaid,
            totalRetailValue,
            savings,
            casinoSpend,
            totalSpent,
            pointsEarned,
            roi,
            valuePerPoint: pointsEarned > 0 ? savings / pointsEarned : 0
          },
          spendingByCategory,
          lineItemsCount: lineItems.length
        };
      });
      
      // Calculate overall summary
      const summary = {
        totalCruises: cruiseFinancials.length,
        totalPaid: cruiseFinancials.reduce((sum, c) => sum + c.financial.totalPaid, 0),
        totalRetailValue: cruiseFinancials.reduce((sum, c) => sum + c.financial.totalRetailValue, 0),
        totalSavings: cruiseFinancials.reduce((sum, c) => sum + c.financial.savings, 0),
        totalCasinoSpend: cruiseFinancials.reduce((sum, c) => sum + c.financial.casinoSpend, 0),
        totalPointsEarned: cruiseFinancials.reduce((sum, c) => sum + c.financial.pointsEarned, 0),
        averageROI: cruiseFinancials.length > 0 ? 
          cruiseFinancials.reduce((sum, c) => sum + c.financial.roi, 0) / cruiseFinancials.length : 0,
        averageValuePerPoint: cruiseFinancials.length > 0 ? 
          cruiseFinancials.reduce((sum, c) => sum + c.financial.valuePerPoint, 0) / cruiseFinancials.length : 0
      };
      
      console.log('[SmartAnalysis] Financial summary complete:', {
        totalCruises: summary.totalCruises,
        totalSavings: summary.totalSavings,
        totalCasinoSpend: summary.totalCasinoSpend,
        averageROI: summary.averageROI.toFixed(1) + '%'
      });
      
      return {
        cruiseFinancials,
        summary
      };
      
    } catch (error) {
      console.error('[SmartAnalysis] Error getting financial summary:', error);
      throw new Error(`Financial summary failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });