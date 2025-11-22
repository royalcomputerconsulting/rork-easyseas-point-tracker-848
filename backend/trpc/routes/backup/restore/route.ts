import { z } from 'zod';
import { protectedProcedure } from '@/backend/trpc/create-context';
import { memoryStore } from '@/backend/trpc/routes/_stores/memory';
import path from 'path';
import { isDiskWritable, fsSafe } from '@/backend/trpc/routes/_utils/fsSupport';

// Access global backup storage
declare global {
  // eslint-disable-next-line no-var
  var __backupStore: Map<string, any> | undefined;
}

export const restoreBackupProcedure = protectedProcedure
  .input(z.object({
    backupId: z.string(),
  }))
  .mutation(async ({ input }) => {
    console.log(`[BACKUP] Restoring backup ${input.backupId}...`);
    
    try {
      if (!global.__backupStore) {
        throw new Error('No backups available');
      }
      
      let backup = global.__backupStore.get(input.backupId);
      if (!backup) {
        try {
          const filePath = path.join(process.cwd(), 'DATA', 'BACKUPS', `${input.backupId}.json`);
          if (isDiskWritable() && fsSafe) {
            const raw = await fsSafe.readFile(filePath, 'utf8');
            backup = JSON.parse(raw);
            console.log('[BACKUP] Loaded backup from disk', filePath);
          }
        } catch {}
      }
      if (!backup) {
        throw new Error(`Backup ${input.backupId} not found`);
      }
      
      const currentSnapshot = {
        cruises: [...memoryStore.cruises],
        bookedCruises: [...memoryStore.bookedCruises],
        offers: [...memoryStore.offers],
        receipts: [...memoryStore.receipts],
        cruiseStatements: [...memoryStore.cruiseStatements],
        financials: [...memoryStore.financials],
        calendarEvents: [...memoryStore.calendarEvents],
        casinoOffers: [...memoryStore.casinoOffers],
        certificates: [...memoryStore.certificates],
        estimatorParams: memoryStore.estimatorParams,
        casinoPerformance: [...memoryStore.casinoPerformance],
        casinoAnalytics: [...memoryStore.casinoAnalytics],
        thresholds: memoryStore.thresholds,
        alerts: memoryStore.alerts,
        priceAlerts: memoryStore.priceAlerts,
        prices: memoryStore.prices,
        userProfile: memoryStore.getUserProfile?.() ?? null,
        lastImport: memoryStore.lastImport ?? null,
        webPricingSnapshot: memoryStore.getWebPricingSnapshot?.() ?? null,
        timestamp: new Date().toISOString(),
        name: 'Pre-restore snapshot',
        description: `Snapshot before restoring ${backup.name}`,
      };
      
      const snapshotId = `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      if (!global.__backupStore) {
        global.__backupStore = new Map<string, any>();
      }
      global.__backupStore.set(snapshotId, currentSnapshot);
      
      memoryStore.cruises = [...(backup.cruises || [])];
      memoryStore.bookedCruises = [...(backup.bookedCruises || [])];
      memoryStore.offers = [...(backup.offers || [])];
      memoryStore.receipts = [...(backup.receipts || [])];
      memoryStore.cruiseStatements = [...(backup.cruiseStatements || [])];
      memoryStore.financials = [...(backup.financials || [])];
      memoryStore.calendarEvents = [...(backup.calendarEvents || [])];
      memoryStore.casinoOffers = [...(backup.casinoOffers || [])];
      memoryStore.certificates = [...(backup.certificates || [])];
      memoryStore.casinoPerformance = [...(backup.casinoPerformance || [])];
      memoryStore.casinoAnalytics = [...(backup.casinoAnalytics || [])];
      // Restore extended state
      if (backup.thresholds !== undefined) memoryStore.thresholds = backup.thresholds;
      if (backup.alerts !== undefined) memoryStore.alerts = backup.alerts;
      if (backup.priceAlerts !== undefined) memoryStore.priceAlerts = backup.priceAlerts;
      if (backup.prices !== undefined) memoryStore.prices = backup.prices;
      if (backup.estimatorParams !== undefined) memoryStore.estimatorParams = backup.estimatorParams;
      if (backup.userProfile !== undefined && backup.userProfile) memoryStore.updateUserProfile(backup.userProfile);
      if (backup.lastImport !== undefined) memoryStore.lastImport = backup.lastImport;
      if (backup.webPricingSnapshot !== undefined && memoryStore.setWebPricingSnapshot) memoryStore.setWebPricingSnapshot(backup.webPricingSnapshot);

      try {
        memoryStore.standardizeAllDates();
        memoryStore.fixCruiseDatesAndDuration();
      } catch {}

      try {
        await memoryStore.persistNow();
      } catch {}
      
      console.log(`[BACKUP] Restored backup ${input.backupId}: ${Array.isArray(backup.cruises) ? backup.cruises.length : 0} cruises, ${Array.isArray(backup.bookedCruises) ? backup.bookedCruises.length : 0} booked cruises, ${Array.isArray(backup.offers) ? backup.offers.length : 0} offers, ${Array.isArray(backup.financials) ? backup.financials.length : 0} fin rows`);
      
      return {
        success: true,
        message: `Successfully restored backup "${backup.name}" from ${backup.timestamp}`,
        snapshotId,
        stats: {
          cruises: Array.isArray(backup.cruises) ? backup.cruises.length : 0,
          bookedCruises: Array.isArray(backup.bookedCruises) ? backup.bookedCruises.length : 0,
          offers: Array.isArray(backup.offers) ? backup.offers.length : 0,
          casinoOffers: Array.isArray(backup.casinoOffers) ? backup.casinoOffers.length : 0,
          receipts: Array.isArray(backup.receipts) ? backup.receipts.length : 0,
          statements: Array.isArray(backup.cruiseStatements) ? backup.cruiseStatements.length : 0,
          financials: Array.isArray(backup.financials) ? backup.financials.length : 0,
          certificates: Array.isArray(backup.certificates) ? backup.certificates.length : 0,
          casinoPerformance: Array.isArray(backup.casinoPerformance) ? backup.casinoPerformance.length : 0,
          casinoAnalytics: Array.isArray(backup.casinoAnalytics) ? backup.casinoAnalytics.length : 0,
        },
      };
    } catch (error) {
      console.error('[BACKUP] Error restoring backup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore backup',
      };
    }
  });