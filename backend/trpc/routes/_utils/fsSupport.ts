import type { Stats } from 'fs';

export function isDiskWritable(): boolean {
  try {
    const hasDeno = typeof (globalThis as any).Deno !== 'undefined';
    if (hasDeno) return false;
    const proc = (globalThis as any).process;
    const hasNode = !!(proc?.versions?.node);
    return !!hasNode;
  } catch {
    return false;
  }
}

export const fsSafe = isDiskWritable() ? require('fs').promises as typeof import('fs').promises : (null as unknown as typeof import('fs').promises);
