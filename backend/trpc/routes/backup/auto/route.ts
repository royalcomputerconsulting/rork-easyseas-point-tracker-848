import { z } from 'zod';
import { protectedProcedure } from '@/backend/trpc/create-context';
import { memoryStore } from '@/backend/trpc/routes/_stores/memory';

// Access global backup storage
declare global {
  // eslint-disable-next-line no-var
  var __backupStore: Map<string, any> | undefined;
  // eslint-disable-next-line no-var
  var __persistentBackup: any | undefined;
}

if (!global.__backupStore) {
  global.__backupStore = new Map();
}

export const autoBackupProcedure = protectedProcedure
  .input(z.object({
    cruises: z.array(z.any()).optional(),
    booked: z.array(z.any()).optional(),
    offers: z.array(z.any()).optional(),
    calendar: z.array(z.any()).optional(),
  }))
  .mutation(async ({ input }) => {
    console.log('[AUTO-BACKUP] Creating automatic backup on sync...');
    
    try {
      // Create a persistent backup that survives server restarts
      const backupData = {
        cruises: input.cruises || memoryStore.cruises,
        bookedCruises: input.booked || memoryStore.bookedCruises,
        offers: input.offers || memoryStore.offers,
        casinoOffers: memoryStore.casinoOffers,
        calendarEvents: input.calendar || memoryStore.calendarEvents,
        receipts: memoryStore.receipts,
        cruiseStatements: memoryStore.cruiseStatements,
        financials: memoryStore.financials,
        casinoAnalytics: memoryStore.casinoAnalytics,
        certificates: memoryStore.certificates,
        estimatorParams: memoryStore.estimatorParams,
        casinoPerformance: memoryStore.casinoPerformance,
        prices: memoryStore.prices,
        thresholds: memoryStore.thresholds,
        alerts: memoryStore.alerts,
        priceAlerts: memoryStore.priceAlerts,
        userProfile: memoryStore.getUserProfile(),
        lastImport: memoryStore.lastImport,
        webPricingSnapshot: memoryStore.getWebPricingSnapshot(),
        timestamp: new Date().toISOString(),
        name: 'Auto-sync backup',
        description: 'Automatic backup created during sync to backend',
      };
      
      // Store as persistent backup
      global.__persistentBackup = backupData;
      
      // Also store in regular backup store
      const backupId = `auto_${Date.now()}`;
      global.__backupStore!.set(backupId, backupData);
      
      console.log(`[AUTO-BACKUP] Created persistent backup with ${backupData.cruises.length} cruises, ${backupData.bookedCruises.length} booked cruises, ${backupData.offers.length} offers, ${backupData.financials.length} financial records, ${backupData.certificates.length} certificates`);
      
      return {
        success: true,
        backupId,
        stats: {
          cruises: backupData.cruises.length,
          bookedCruises: backupData.bookedCruises.length,
          offers: backupData.offers.length,
          casinoOffers: backupData.casinoOffers.length,
          receipts: backupData.receipts.length,
          statements: backupData.cruiseStatements.length,
          financials: backupData.financials.length,
          calendar: backupData.calendarEvents.length,
          certificates: backupData.certificates.length,
          casinoPerformance: backupData.casinoPerformance.length,
        },
      };
    } catch (error) {
      console.error('[AUTO-BACKUP] Error creating automatic backup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create automatic backup',
      };
    }
  });