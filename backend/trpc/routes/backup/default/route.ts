import { z } from 'zod';
import { protectedProcedure } from '@/backend/trpc/create-context';
import { memoryStore } from '@/backend/trpc/routes/_stores/memory';
import path from 'path';
import { isDiskWritable, fsSafe } from '@/backend/trpc/routes/_utils/fsSupport';

declare global {
  // eslint-disable-next-line no-var
  var __defaultDatasetId: string | undefined;
}

export const setDefaultDatasetProcedure = protectedProcedure
  .input(z.object({ name: z.string().default('Default Data Set'), description: z.string().optional() }))
  .mutation(async ({ input }) => {
    try {
      const { createBackupProcedure } = await import('../create/route');
      const res = await (createBackupProcedure as any).resolve({
        input: { name: input.name, description: input.description ?? 'Default data set', persistToDisk: true },
        ctx: undefined,
        type: 'mutation',
        path: 'backup.create'
      });
      if (res?.success && res.backupId) {
        global.__defaultDatasetId = res.backupId;
        const markerDir = path.join(process.cwd(), 'DATA', 'BACKUPS');
        if (isDiskWritable() && fsSafe) {
          await fsSafe.mkdir(markerDir, { recursive: true });
          await fsSafe.writeFile(path.join(markerDir, 'DEFAULT_DATASET_ID.txt'), res.backupId, 'utf8');
        }
        return { success: true as const, backupId: res.backupId };
      }
      return { success: false as const, error: 'Failed to create default dataset backup' };
    } catch (e) {
      return { success: false as const, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  });

export const loadDefaultDatasetProcedure = protectedProcedure
  .mutation(async () => {
    try {
      let id = global.__defaultDatasetId;
      if (!id) {
        try {
          const text = isDiskWritable() && fsSafe ? await fsSafe.readFile(path.join(process.cwd(), 'DATA', 'BACKUPS', 'DEFAULT_DATASET_ID.txt'), 'utf8') : '';
          id = text.trim();
        } catch {}
      }
      if (!id) {
        return { success: false as const, error: 'No default dataset found' };
      }
      const { restoreBackupProcedure } = await import('../restore/route');
      const res = await (restoreBackupProcedure as any).resolve({ input: { backupId: id }, ctx: undefined, type: 'mutation', path: 'backup.restore' });
      return res;
    } catch (e) {
      return { success: false as const, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  });
