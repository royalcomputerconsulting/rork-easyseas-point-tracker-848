import { createTRPCRouter } from '../../create-context';
import { listCruisesProcedure } from './list/route';
import { getCruiseProcedure } from './get/route';
import { createCruiseProcedure } from './create/route';
import { updateCruiseProcedure, updateCruiseFinancialDataProcedure, getCruiseFinancialDataProcedure } from './update/route';
import { verifyDataProcedure, cleanupDataProcedure, getCurrentDataProcedure } from './verify-data/route';
import { scrapeCruiseDataProcedure, updateCruisePricingProcedure, refreshItinerariesProcedure, scrapeSingleCruiseProcedure, batchVerifyCruisesProcedure } from './scrape-data/route';
import { 
  getSnapshotsProcedure, 
  rollbackToSnapshotProcedure, 
  deleteSnapshotProcedure, 
  clearAllSnapshotsProcedure, 
  createSnapshotProcedure, 
  batchUpdateWithRollbackProcedure, 
  testRollbackProcedure 
} from './rollback/route';
import {
  startRoyalCaribbeanScrapingProcedure,
  getScrapingStatusProcedure,
  listScrapingSessionsProcedure,
  cancelScrapingSessionProcedure,
  processScrapedFilesProcedure,
  getRoyalCaribbeanOffersProcedure,
  webScraperProcedure
} from './royal-caribbean-scraper/route';
import { 
  webPricingProcedure, 
  pricingProgressProcedure as webPricingProgressProcedure
} from './web-pricing/route';
import {
  smartAnalysisProcedure,
  getRecommendationsProcedure,
  calculateROIProcedure,
  getCruiseFinancialSummaryProcedure
} from './smart-analysis/route';
import {
  getClubRoyaleProfile,
  updateUserPointsProcedure,
  getUserPointsProgressProcedure,
  calculatePointsValueProcedure,
  getPointsHistoryProcedure,
  getClubRoyaleProfileProcedure,
  updateCruisePointsProcedure,
  getTierProgressionProcedure,
  getAvailableCertificatesProcedure,
  useCertificateProcedure,
  addCruisePointsProcedure,
  getPointsSummaryProcedure
} from './points-rewards/route';
import {
  getEnhancedCruiseDataProcedure,
  getClubRoyaleCategoriesProcedure
} from './enhanced-data/route';
import { 
  launchScraperProcedure, 
  getScraperStatusProcedure, 
  listScraperSessionsProcedure, 
  cancelScraperSessionProcedure 
} from './launch-scraper/route';
import {
  pricingProgressProcedure,
  fetchAllPricingProcedure
} from './pricing-progress/route';
import { fetchWebPricingProcedure, batchFetchWebPricingProcedure, getBatchPricingProgressProcedure } from './fetch-web-pricing/route';
import { gangwazeDiagnosticProcedure } from './gangwaze-diagnostic/route';
import { fetchPricingProcedure } from './fetch-pricing/route';
import { z } from 'zod';
import { publicProcedure } from '../../create-context';
import { memoryStore } from '../_stores/memory';
import { parseDateStrict } from '@/lib/date';

export const cruisesRouter = createTRPCRouter({
  list: listCruisesProcedure,
  get: getCruiseProcedure,
  create: createCruiseProcedure,
  update: updateCruiseProcedure,
  updateFinancialData: updateCruiseFinancialDataProcedure,
  getFinancialData: getCruiseFinancialDataProcedure,
  verifyData: verifyDataProcedure,
  cleanupData: cleanupDataProcedure,
  getCurrentData: getCurrentDataProcedure,
  scrapeData: scrapeCruiseDataProcedure,
  scrapeSingle: scrapeSingleCruiseProcedure,
  batchVerify: batchVerifyCruisesProcedure,
  updatePricing: updateCruisePricingProcedure,
  refreshItineraries: refreshItinerariesProcedure,
  
  // Rollback Management
  getSnapshots: getSnapshotsProcedure,
  rollbackToSnapshot: rollbackToSnapshotProcedure,
  deleteSnapshot: deleteSnapshotProcedure,
  clearAllSnapshots: clearAllSnapshotsProcedure,
  createSnapshot: createSnapshotProcedure,
  batchUpdateWithRollback: batchUpdateWithRollbackProcedure,
  testRollback: testRollbackProcedure,
  
  // Royal Caribbean Scraper
  startRoyalCaribbeanScraping: startRoyalCaribbeanScrapingProcedure,
  webScraper: webScraperProcedure,
  getScrapingStatus: getScrapingStatusProcedure,
  listScrapingSessions: listScrapingSessionsProcedure,
  cancelScrapingSession: cancelScrapingSessionProcedure,
  processScrapedFiles: processScrapedFilesProcedure,
  getRoyalCaribbeanOffers: getRoyalCaribbeanOffersProcedure,
  
  // Launch Python Scraper
  launchScraper: launchScraperProcedure,
  getScraperStatus: getScraperStatusProcedure,
  listScraperSessions: listScraperSessionsProcedure,
  cancelScraperSession: cancelScraperSessionProcedure,
  
  // Web Pricing
  webPricing: webPricingProcedure,
  webPricingProgress: webPricingProgressProcedure,
  
  // Smart Analysis and Recommendations
  smartAnalysis: smartAnalysisProcedure,
  getRecommendations: getRecommendationsProcedure,
  calculateROI: calculateROIProcedure,
  getCruiseFinancialSummary: getCruiseFinancialSummaryProcedure,
  
  // Points and Rewards System
  updateUserPoints: updateUserPointsProcedure,
  getUserPointsProgress: getUserPointsProgressProcedure,
  calculatePointsValue: calculatePointsValueProcedure,
  getPointsHistory: getPointsHistoryProcedure,
  
  // Club Royale Points and Rewards
  getClubRoyaleProfile: getClubRoyaleProfile,
  getClubRoyaleProfileLegacy: getClubRoyaleProfileProcedure,
  updateCruisePoints: updateCruisePointsProcedure,
  addCruisePoints: addCruisePointsProcedure,
  getPointsSummary: getPointsSummaryProcedure,
  getTierProgression: getTierProgressionProcedure,
  getAvailableCertificates: getAvailableCertificatesProcedure,
  useCertificate: useCertificateProcedure,
  
  // Pricing Progress
  pricingProgress: pricingProgressProcedure,
  fetchAllPricing: fetchAllPricingProcedure,
  fetchWebPricing: fetchWebPricingProcedure,
  batchFetchWebPricing: batchFetchWebPricingProcedure,
  getBatchPricingProgress: getBatchPricingProgressProcedure,
  fetchPricing: fetchPricingProcedure,
  
  // Diagnostics
  gangwazeDiagnostic: gangwazeDiagnosticProcedure,
  
  // Fix dates migration - converts 2-digit years to correct 4-digit years
  fixDates: publicProcedure.mutation(() => {
    console.log('[tRPC] Running date fix migration');
    
    const cruises = memoryStore.getCruises();
    const bookedCruises = memoryStore.getBookedCruises();
    let fixedCount = 0;
    
    // Fix cruises
    cruises.forEach(cruise => {
      let updated = false;
      const originalDep = cruise.departureDate;
      const originalRet = cruise.returnDate;
      
      if (cruise.departureDate) {
        const parsed = parseDateStrict(cruise.departureDate);
        if (parsed && parsed !== cruise.departureDate) {
          cruise.departureDate = parsed;
          updated = true;
        }
      }
      
      if (cruise.returnDate) {
        const parsed = parseDateStrict(cruise.returnDate);
        if (parsed && parsed !== cruise.returnDate) {
          cruise.returnDate = parsed;
          updated = true;
        }
      }
      
      if (updated) {
        console.log(`[tRPC] Fixed dates for cruise ${cruise.ship}: ${originalDep} -> ${cruise.departureDate}, ${originalRet} -> ${cruise.returnDate}`);
        cruise.updatedAt = new Date().toISOString();
        fixedCount++;
      }
    });
    
    // Fix booked cruises (they use departureDate/returnDate like regular cruises)
    bookedCruises.forEach(bookedCruise => {
      let updated = false;
      const originalDep = bookedCruise.departureDate;
      const originalRet = bookedCruise.returnDate;
      
      if (bookedCruise.departureDate) {
        const parsed = parseDateStrict(bookedCruise.departureDate);
        if (parsed && parsed !== bookedCruise.departureDate) {
          bookedCruise.departureDate = parsed;
          updated = true;
        }
      }
      
      if (bookedCruise.returnDate) {
        const parsed = parseDateStrict(bookedCruise.returnDate);
        if (parsed && parsed !== bookedCruise.returnDate) {
          bookedCruise.returnDate = parsed;
          updated = true;
        }
      }
      
      if (updated) {
        console.log(`[tRPC] Fixed dates for booked cruise ${bookedCruise.ship}: ${originalDep} -> ${bookedCruise.departureDate}, ${originalRet} -> ${bookedCruise.returnDate}`);
        bookedCruise.updatedAt = new Date().toISOString();
        fixedCount++;
      }
    });
    
    console.log(`[tRPC] Date fix migration complete. Fixed ${fixedCount} cruises.`);
    return { success: true, fixedCount };
  }),
  
  // Expected Analytics for a specific cruise
  getExpectedAnalytics: publicProcedure
    .input(z.object({
      cruiseId: z.string(),
    }))
    .query(({ input }) => {
      console.log('[tRPC] Getting expected analytics for cruise:', input.cruiseId);
      
      // Get the cruise details
      const cruise = memoryStore.getCruise(input.cruiseId);
      if (!cruise) {
        // Try to find in booked cruises
        const bookedCruise = memoryStore.getBookedCruises().find(c => c.id === input.cruiseId);
        if (!bookedCruise) {
          console.log('[tRPC] Cruise not found, returning default expected analytics');
        }
      }
      
      // Calculate expected values based on cruise length and historical data
      const nights = cruise?.nights || 7;
      const cruiseFare = cruise?.paidFare || cruise?.actualFare || cruise?.currentMarketPrice || 277;
      
      // Expected costs breakdown
      const expectedCosts = {
        cruiseFare,
        onboardSpend: nights * 150, // Average $150 per night onboard spending
        casinoPlay: nights * 500, // Average $500 per night casino play
        totalExpected: 0
      };
      expectedCosts.totalExpected = expectedCosts.cruiseFare + expectedCosts.onboardSpend + expectedCosts.casinoPlay;
      
      // Expected points based on play
      const expectedPoints = nights * 200; // Average 200 points per night
      
      // Expected value back
      const expectedValue = {
        freePlay: nights * 50, // Average $50 free play per night
        nextCruiseCertificate: 200, // Standard certificate value
        comps: nights * 25, // Average $25 in comps per night
        totalValue: 0
      };
      expectedValue.totalValue = expectedValue.freePlay + expectedValue.nextCruiseCertificate + expectedValue.comps;
      
      return {
        expectedCosts,
        expectedPoints,
        expectedValue,
        confidence: nights > 5 ? 'high' : 'medium',
        basedOn: 'historical averages'
      };
    }),
});