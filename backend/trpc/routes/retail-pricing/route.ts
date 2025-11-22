import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../../create-context';
import { promises as fs } from 'fs';
import path from 'path';

const DEFAULT_PUBLISHED_HTML = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTB2LwoioQEePLAol_trHwYrwtYrXGEVY_8IcqH15Me-bK9EnpBHoejJ1Q_dcIzWsPNuYPs7IP6Tc6R/pubhtml';

function toCsvUrl(publishedHtmlUrl: string): string {
  try {
    if (publishedHtmlUrl.includes('/pubhtml')) {
      return publishedHtmlUrl.replace('/pubhtml', '/pub?output=csv');
    }
    if (publishedHtmlUrl.includes('/pub') && !publishedHtmlUrl.includes('output=csv')) {
      const u = new URL(publishedHtmlUrl);
      u.searchParams.set('output', 'csv');
      return u.toString();
    }
    return publishedHtmlUrl;
  } catch {
    return publishedHtmlUrl;
  }
}

async function ensureDir(): Promise<string> {
  const dir = path.join(process.cwd(), 'DATA', 'RETAIL');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function writeFileSafe(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf8');
}

async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

function parseCsv(csv: string): { headers: string[]; rows: string[][] } {
  const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

export const retailPricingRouter = createTRPCRouter({
  status: publicProcedure
    .query(async () => {
      try {
        const dir = await ensureDir();
        const file = path.join(dir, 'retail-pricing.csv');
        let exists = false;
        let size = 0;
        let mtime: string | null = null;
        try {
          const st = await fs.stat(file);
          exists = true;
          size = st.size;
          mtime = st.mtime.toISOString();
        } catch {}
        return { exists, file, size, updatedAt: mtime };
      } catch (e) {
        return { exists: false, file: '', size: 0, updatedAt: null, error: (e as Error).message };
      }
    }),

  fetchAndSaveFromWeb: publicProcedure
    .input(z.object({ publishedHtmlUrl: z.string().url().optional() }).optional())
    .mutation(async ({ input }) => {
      console.log('[retailPricing] fetchAndSaveFromWeb called', input);
      const publishedHtmlUrl = input?.publishedHtmlUrl ?? DEFAULT_PUBLISHED_HTML;
      const csvUrl = toCsvUrl(publishedHtmlUrl);
      try {
        const res = await fetch(csvUrl);
        if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status} ${res.statusText}`);
        const csv = await res.text();
        const dir = await ensureDir();
        const file = path.join(dir, 'retail-pricing.csv');
        await writeFileSafe(file, csv);
        console.log('[retailPricing] Saved CSV to', file, 'bytes=', csv.length);
        const parsed = parseCsv(csv);
        return { success: true as const, file, rows: parsed.rows.length, cols: parsed.headers.length, headers: parsed.headers.slice(0, 25) };
      } catch (e) {
        console.error('[retailPricing] fetch error', e);
        return { success: false as const, error: (e as Error).message };
      }
    }),

  read: publicProcedure
    .query(async () => {
      try {
        const dir = await ensureDir();
        const file = path.join(dir, 'retail-pricing.csv');
        const csv = await readFileIfExists(file);
        if (!csv) return { headers: [] as string[], rows: [] as string[][] };
        const parsed = parseCsv(csv);
        return parsed;
      } catch (e) {
        console.error('[retailPricing] read error', e);
        return { headers: [] as string[], rows: [] as string[][] };
      }
    })
});
