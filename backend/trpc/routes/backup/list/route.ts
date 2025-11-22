import { protectedProcedure } from '@/backend/trpc/create-context';
import path from 'path';
import { isDiskWritable, fsSafe } from '@/backend/trpc/routes/_utils/fsSupport';

// Access global backup storage
declare global {
  // eslint-disable-next-line no-var
  var __backupStore: Map<string, any> | undefined;
}

export const listBackupsProcedure = protectedProcedure
  .query(async () => {
    console.log('[BACKUP] Listing backups (memory + disk)...');

    try {
      const results: Array<{
        id: string;
        name: string;
        description?: string;
        timestamp: string;
        stats: { cruises: number; bookedCruises: number; offers: number; receipts: number };
      }> = [];

      // 1) Include in-memory backups
      if (global.__backupStore && global.__backupStore.size > 0) {
        for (const [id, backup] of global.__backupStore.entries()) {
          results.push({
            id,
            name: backup.name,
            description: backup.description,
            timestamp: backup.timestamp,
            stats: {
              cruises: Array.isArray(backup.cruises) ? backup.cruises.length : 0,
              bookedCruises: Array.isArray(backup.bookedCruises) ? backup.bookedCruises.length : 0,
              offers: Array.isArray(backup.offers) ? backup.offers.length : 0,
              receipts: Array.isArray(backup.receipts) ? backup.receipts.length : 0,
            },
          });
        }
      }

      // 2) Include disk backups from DATA/BACKUPS
      try {
        const dir = path.join(process.cwd(), 'DATA', 'BACKUPS');
        const exists = isDiskWritable() && fsSafe ? await fsSafe
          .stat(dir)
          .then(() => true)
          .catch(() => false) : false;

        if (exists) {
          const files = await fsSafe.readdir(dir);
          const jsonFiles = files.filter((f) => f.endsWith('.json'));

          // Read file headers quickly without loading huge JSONs if possible
          // We'll parse fully as they are JSON, but limit to first 200 files sorted by mtime desc
          const filesWithTime = await Promise.all(
            jsonFiles.map(async (f) => {
              const full = path.join(dir, f);
              const stat = await fsSafe.stat(full).catch(() => null as any);
              return { file: f, full, mtimeMs: stat ? stat.mtimeMs : 0 };
            }),
          );

          filesWithTime.sort((a, b) => b.mtimeMs - a.mtimeMs);
          const toRead = filesWithTime.slice(0, 200);

          for (const entry of toRead) {
            try {
              const raw = await fsSafe.readFile(entry.full, 'utf8');
              const backup = JSON.parse(raw);
              const inferredId = entry.file.replace(/\.json$/, '');
              results.push({
                id: inferredId,
                name: backup.name || inferredId,
                description: backup.description || 'Disk backup',
                timestamp: backup.timestamp || new Date(entry.mtimeMs).toISOString(),
                stats: {
                  cruises: Array.isArray(backup.cruises) ? backup.cruises.length : 0,
                  bookedCruises: Array.isArray(backup.bookedCruises) ? backup.bookedCruises.length : 0,
                  offers: Array.isArray(backup.offers) ? backup.offers.length : 0,
                  receipts: Array.isArray(backup.receipts) ? backup.receipts.length : 0,
                },
              });
            } catch (e) {
              console.warn('[BACKUP] Failed to read backup file:', entry.full, e);
            }
          }
        } else {
          console.log('[BACKUP] No disk backup directory found at DATA/BACKUPS');
        }
      } catch (diskErr) {
        console.warn('[BACKUP] Failed scanning disk backups (continuing with memory only):', diskErr);
      }

      // Deduplicate by id (prefer in-memory entries over disk ones)
      const deduped = Object.values(
        results.reduce((acc, item) => {
          if (!acc[item.id]) acc[item.id] = item;
          return acc;
        }, {} as Record<string, (typeof results)[number]>),
      );

      // Sort by timestamp desc
      deduped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      console.log(`[BACKUP] Found ${deduped.length} backups`);

      return {
        success: true,
        backups: deduped,
      };
    } catch (error) {
      console.error('[BACKUP] Error listing backups:', error);
      return {
        success: false,
        backups: [],
        error: error instanceof Error ? error.message : 'Failed to list backups',
      };
    }
  });