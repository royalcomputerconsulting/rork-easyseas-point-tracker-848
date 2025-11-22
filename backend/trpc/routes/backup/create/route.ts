import { z } from 'zod';
import { protectedProcedure } from '@/backend/trpc/create-context';
import { memoryStore } from '@/backend/trpc/routes/_stores/memory';
import path from 'path';
import { isDiskWritable, fsSafe } from '@/backend/trpc/routes/_utils/fsSupport';

// Global backup storage
declare global {
  // eslint-disable-next-line no-var
  var __backupStore: Map<string, any> | undefined;
}

if (!global.__backupStore) {
  global.__backupStore = new Map();
}

export const createBackupProcedure = protectedProcedure
  .input(z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    persistToDisk: z.boolean().optional(),
  }))
  .mutation(async ({ input }) => {
    console.log('[BACKUP] Creating backup...');
    
    try {
      const timestamp = new Date().toISOString();
      const currentState = {
        name: input.name || `Backup ${new Date().toLocaleString()}`,
        description: input.description || 'Manual backup',
        timestamp,
        cruises: memoryStore.cruises,
        bookedCruises: memoryStore.bookedCruises,
        offers: memoryStore.offers,
        casinoOffers: memoryStore.casinoOffers,
        calendarEvents: memoryStore.calendarEvents,
        prices: memoryStore.prices,
        thresholds: memoryStore.thresholds,
        alerts: memoryStore.alerts,
        priceAlerts: memoryStore.priceAlerts,
        receipts: memoryStore.receipts,
        cruiseStatements: memoryStore.cruiseStatements,
        financials: memoryStore.financials,
        casinoAnalytics: memoryStore.casinoAnalytics,
        certificates: memoryStore.certificates,
        estimatorParams: memoryStore.estimatorParams,
        casinoPerformance: memoryStore.casinoPerformance,
        userProfile: memoryStore.getUserProfile(),
        lastImport: memoryStore.lastImport,
        webPricingSnapshot: memoryStore.getWebPricingSnapshot(),
      };
      
      const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      global.__backupStore!.set(backupId, currentState);

      if (input.persistToDisk && isDiskWritable() && fsSafe) {
        try {
          const dir = path.join(process.cwd(), 'DATA', 'BACKUPS');
          await fsSafe.mkdir(dir, { recursive: true });
          const filePath = path.join(dir, `${backupId}.json`);
          await fsSafe.writeFile(filePath, JSON.stringify(currentState), 'utf8');
          console.log('[BACKUP] Persisted backup to disk at', filePath);
        } catch (diskErr) {
          console.warn('[BACKUP] Failed to persist backup to disk (non-fatal):', diskErr);
        }
      }
      
      console.log(`[BACKUP] Created backup ${backupId} with ${currentState.cruises.length} cruises, ${currentState.bookedCruises.length} booked cruises, ${currentState.offers.length} offers, ${currentState.financials.length} financial rows, ${currentState.certificates.length} certificates, ${currentState.casinoPerformance.length} performance records`);
      
      return {
        success: true,
        backupId,
        name: currentState.name,
        timestamp: currentState.timestamp,
        stats: {
          cruises: currentState.cruises.length,
          bookedCruises: currentState.bookedCruises.length,
          offers: currentState.offers.length,
          receipts: currentState.receipts.length,
          statements: currentState.cruiseStatements.length,
          financials: currentState.financials.length,
          calendar: currentState.calendarEvents.length,
          certificates: currentState.certificates.length,
          casinoPerformance: currentState.casinoPerformance.length,
          casinoOffers: currentState.casinoOffers.length,
        },
      };
    } catch (error) {
      console.error('[BACKUP] Error creating backup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create backup',
      };
    }
  });