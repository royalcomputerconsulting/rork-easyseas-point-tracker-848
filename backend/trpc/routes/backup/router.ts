import { createTRPCRouter, protectedProcedure } from '@/backend/trpc/create-context';
import { createBackupProcedure } from './create/route';
import { restoreBackupProcedure } from './restore/route';
import { listBackupsProcedure } from './list/route';
import { autoBackupProcedure } from './auto/route';
import { getLatestBackupProcedure } from './latest/route';
import { setDefaultDatasetProcedure, loadDefaultDatasetProcedure } from './default/route';
import { memoryStore } from '../_stores/memory';

const forcePersistProcedure = protectedProcedure
  .mutation(async () => {
    try {
      console.log('[BACKUP] Force persisting data to disk...');
      await memoryStore.persistNow();
      
      return {
        success: true,
        message: 'Data persisted successfully',
        stats: {
          cruises: memoryStore.cruises.length,
          bookedCruises: memoryStore.bookedCruises.length,
          casinoOffers: memoryStore.casinoOffers.length,
          calendarEvents: memoryStore.calendarEvents.length,
        }
      };
    } catch (error) {
      console.error('[BACKUP] Force persist failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to persist data'
      };
    }
  });

export const backupRouter = createTRPCRouter({
  create: createBackupProcedure,
  restore: restoreBackupProcedure,
  list: listBackupsProcedure,
  auto: autoBackupProcedure,
  getLatest: getLatestBackupProcedure,
  setDefault: setDefaultDatasetProcedure,
  loadDefault: loadDefaultDatasetProcedure,
  forcePersist: forcePersistProcedure,
});