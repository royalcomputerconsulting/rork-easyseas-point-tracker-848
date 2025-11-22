import { protectedProcedure } from '@/backend/trpc/create-context';
import { memoryStore } from '@/backend/trpc/routes/_stores/memory';

// Access global backup storage
declare global {
  // eslint-disable-next-line no-var
  var __persistentBackup: any | undefined;
}

export const getLatestBackupProcedure = protectedProcedure
  .query(async () => {
    console.log('[BACKUP] Checking for persistent backup...');
    
    try {
      // Check if there's a persistent backup to restore
      if (global.__persistentBackup) {
        const backup = global.__persistentBackup;
        
        // Check if memory store is empty and we have a backup
        const isMemoryEmpty = memoryStore.cruises.length === 0 && 
                              memoryStore.bookedCruises.length === 0 && 
                              memoryStore.offers.length === 0;
        
        if (isMemoryEmpty && backup.cruises && backup.cruises.length > 0) {
          console.log('[BACKUP] Memory store is empty, restoring from persistent backup...');
          
          // Restore the backup
          memoryStore.cruises = [...backup.cruises];
          memoryStore.bookedCruises = [...backup.bookedCruises];
          memoryStore.offers = [...backup.offers];
          memoryStore.receipts = [...(backup.receipts || [])];
          
          console.log(`[BACKUP] Restored ${backup.cruises.length} cruises, ${backup.bookedCruises.length} booked cruises, ${backup.offers.length} offers from persistent backup`);
          
          return {
            hasBackup: true,
            restored: true,
            timestamp: backup.timestamp,
            stats: {
              cruises: backup.cruises.length,
              bookedCruises: backup.bookedCruises.length,
              offers: backup.offers.length,
              receipts: backup.receipts?.length || 0,
            },
          };
        }
        
        return {
          hasBackup: true,
          restored: false,
          timestamp: backup.timestamp,
          stats: {
            cruises: backup.cruises.length,
            bookedCruises: backup.bookedCruises.length,
            offers: backup.offers.length,
            receipts: backup.receipts?.length || 0,
          },
        };
      }
      
      return {
        hasBackup: false,
        restored: false,
        stats: {
          cruises: memoryStore.cruises.length,
          bookedCruises: memoryStore.bookedCruises.length,
          offers: memoryStore.offers.length,
          receipts: memoryStore.receipts.length,
        },
      };
    } catch (error) {
      console.error('[BACKUP] Error checking/restoring backup:', error);
      return {
        hasBackup: false,
        restored: false,
        error: error instanceof Error ? error.message : 'Failed to check backup',
        stats: {
          cruises: 0,
          bookedCruises: 0,
          offers: 0,
          receipts: 0,
        },
      };
    }
  });