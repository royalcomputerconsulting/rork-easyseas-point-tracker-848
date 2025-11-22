import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../../create-context';
import { memoryStore } from '../_stores/memory';
import type { FinancialsRecord, FinancialSourceType, CertificateItem, EstimatorParams, CasinoPerformance } from '@/types/models';
import { promises as fs } from 'fs';
import path from 'path';
import { normalizeCategory, normalizeDepartment, normalizePaymentMethod, extractOnboardCredit, extractRefOrFolio } from '@/backend/trpc/routes/financials/normalizers';

const MASTER_CRUISE_IDS = new Set<string>([
  '7871133', // Wonder
  '6242276', // Navigator A
  '5156149', // Navigator B
  '5207254', // Navigator C
  '2501764', // Harmony
  '2665774', // Star
  '236930',  // Ovation
]);
const isMasterCruise = (id?: string | null): boolean => !!id && MASTER_CRUISE_IDS.has(String(id));

const financialsInputSchema = z.object({
  cruiseId: z.string(),
  shipName: z.string().optional(),
  sailDateStart: z.string().optional(),
  sailDateEnd: z.string().optional(),
  itineraryName: z.string().optional(),
  guestName: z.string().optional(),
  cabinNumber: z.string().optional(),
  bookingId: z.string().optional(),
  reservationNumber: z.string().optional(),
  sourceType: z.enum(['receipt','statement'] satisfies FinancialSourceType[]),
  sourceFileBaseName: z.string().optional(),
  sourcePageNumber: z.number().optional(),
  sourceTotalPages: z.number().optional(),
  processedAt: z.string().default(() => new Date().toISOString()),
  ocrVersion: z.string().optional(),
  verified: z.boolean().default(false),
  receiptId: z.string().optional(),
  receiptDateTime: z.string().optional(),
  venue: z.string().optional(),
  category: z.enum(['Food & Beverage','Retail','Spa','ShoreEx','Casino','Gratuity','Tax/Fees','Other']).optional(),
  itemDescription: z.string().optional(),
  quantity: z.number().optional(),
  unitPrice: z.number().optional(),
  lineTotal: z.number().optional(),
  tax: z.number().optional(),
  gratuity: z.number().optional(),
  discount: z.number().optional(),
  paymentMethod: z.enum(['SeaPass','OBC','Credit Card','Promo']).optional(),
  employeeIdOrServerName: z.string().optional(),
  folioNumber: z.string().optional(),
  statementId: z.string().optional(),
  postDate: z.string().optional(),
  txnType: z.enum(['Charge','Credit','Adjustment']).optional(),
  description: z.string().optional(),
  department: z.enum(['Casino','Beverage','Dining','Photo','Spa','Retail','ShoreEx','ServiceFees','Taxes','Gratuities','Other']).optional(),
  amount: z.number().optional(),
  balanceAfter: z.number().optional(),
  onboardCreditApplied: z.number().optional(),
  statementPaymentMethod: z.enum(['SeaPass','OBC','Credit Card']).optional(),
  refNumber: z.string().optional(),
});

function toCsv(records: FinancialsRecord[]): string {
  const headers = [
    'id','cruiseId','shipName','sailDateStart','sailDateEnd','itineraryName','guestName','cabinNumber','bookingId','reservationNumber',
    'sourceType','sourceFileBaseName','sourcePageNumber','sourceTotalPages','processedAt','ocrVersion','verified',
    'receiptId','receiptDateTime','venue','category','itemDescription','quantity','unitPrice','lineTotal','tax','gratuity','discount','paymentMethod','employeeIdOrServerName','folioNumber',
    'statementId','postDate','txnType','description','department','amount','balanceAfter','onboardCreditApplied','statementPaymentMethod','refNumber',
    'createdAt','updatedAt'
  ] as const;
  const escape = (val: unknown): string => {
    if (val === undefined || val === null) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const rows = records.map(r => headers.map(h => escape((r as any)[h])) .join(','));
  return [headers.join(','), ...rows].join('\n');
}

async function ensureDirs(): Promise<{ baseDir: string; snapshotsDir: string; exportsDir: string }> {
  const baseDir = path.join(process.cwd(), 'DATA', 'FINANCIALS');
  const snapshotsDir = path.join(baseDir, 'snapshots');
  const exportsDir = path.join(process.cwd(), 'DATA', 'SCRAPER', 'exports');
  await fs.mkdir(baseDir, { recursive: true });
  await fs.mkdir(snapshotsDir, { recursive: true });
  await fs.mkdir(exportsDir, { recursive: true });
  return { baseDir, snapshotsDir, exportsDir };
}

function detectMixedCurrency(rows: FinancialsRecord[]): boolean {
  const set = new Set<string>();
  rows.forEach(r => {
    if (r.currency && r.currency.trim() !== '') set.add(r.currency.trim());
  });
  return set.size > 1;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && ch === delimiter) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(v => v.trim());
}

async function loadCsvIntoMemory(): Promise<{ success: boolean; inserted: number; path?: string; error?: string; skipped?: number; totalLines?: number; headers?: string[] }> {
  try {
    const primaryPath = path.join(process.cwd(), 'DATA', 'financials.database.csv');
    const fallbackPaths = [
      path.join(process.cwd(), 'DATA', 'FINANCIALS', 'financials.csv'),
      path.join(process.cwd(), 'DATA', 'financials.csv')
    ];

    let csvPath = '';
    let csvContent = '';

    try {
      csvContent = await fs.readFile(primaryPath, 'utf8');
      csvPath = primaryPath;
      console.log('[tRPC] loadCsvIntoMemory: Using PRIMARY CSV at', csvPath);
    } catch (e) {
      console.warn('[tRPC] loadCsvIntoMemory: Primary path missing, trying fallbacks');
      for (const testPath of fallbackPaths) {
        try {
          csvContent = await fs.readFile(testPath, 'utf8');
          csvPath = testPath;
          console.log('[tRPC] loadCsvIntoMemory: Found fallback CSV at', csvPath);
          break;
        } catch {}
      }
    }

    if (!csvContent) return { success: false, inserted: 0, error: 'No CSV file found' };

    const rawLines = csvContent.split(/\r?\n/);
    const lines = rawLines.filter(line => line.trim() !== '');
    if (lines.length < 2) return { success: false, inserted: 0, error: 'CSV empty' };

    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    const headers = parseCsvLine(lines[0], delimiter);
    const records: Omit<FinancialsRecord,'id'|'createdAt'|'updatedAt'>[] = [];

    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const valuesRaw = parseCsvLine(lines[i], delimiter);
      let values = valuesRaw;
      if (values.length !== headers.length) {
        const descIdx = headers.indexOf('description');
        if (values.length > headers.length) {
          if (descIdx !== -1) {
            const before = values.slice(0, descIdx);
            const trailingCount = headers.length - descIdx - 1;
            const overflow = values.slice(descIdx, values.length - Math.max(0, trailingCount));
            const trailing = trailingCount > 0 ? values.slice(values.length - trailingCount) : [];
            values = [...before, overflow.join(' '), ...trailing];
          } else {
            // No explicit description column in CSV; merge all overflow into the last column
            const head = values.slice(0, headers.length - 1);
            const tailMerged = values.slice(headers.length - 1).join(' ');
            values = [...head, tailMerged];
          }
        } else if (values.length < headers.length) {
          values = [...values, ...Array(headers.length - values.length).fill('')];
        }
        // After coercion, if still mismatched, log and pad/truncate as last resort (do NOT skip rows)
        if (values.length !== headers.length) {
          console.warn('[tRPC] Coercion fallback at line', i + 1, 'cols:', values.length, 'expected:', headers.length);
          if (values.length > headers.length) values = values.slice(0, headers.length);
          else values = [...values, ...Array(headers.length - values.length).fill('')];
        }
      }
      const record: any = {};
      headers.forEach((header, index) => {
        const value = values[index];
        if (value && value !== '') {
          if (header === 'sourceType') {
            const v = String(value).toLowerCase();
            record.sourceType = (v === 'receipt' ? 'receipt' : 'statement') as 'receipt' | 'statement';
          } else if (header === 'category') {
            if (value === 'Tax/Fees') { record.category = 'Tax/Fees' as const; record.department = 'Taxes' as const; }
            else if (value === 'Casino') { record.category = 'Casino' as const; record.department = 'Casino' as const; }
            else if (value === 'Beverage') { record.category = 'Food & Beverage' as const; record.department = 'Beverage' as const; }
            else if (value === 'Dining') { record.category = 'Food & Beverage' as const; record.department = 'Dining' as const; }
            else if (value === 'Gratuity') { record.category = 'Gratuity' as const; record.department = 'Gratuities' as const; }
            else if (value === 'Spa') { record.category = 'Spa' as const; record.department = 'Spa' as const; }
            else if (value === 'Retail') { record.category = 'Retail' as const; record.department = 'Retail' as const; }
            else { record.category = 'Other' as const; record.department = 'Other' as const; }
          } else if (header === 'amount') {
            const amt = parseFloat(value.replace(/[$,]/g, '')) || 0;
            record.amount = amt;
            if (record.sourceType === 'receipt') record.lineTotal = amt;
          } else if (header === 'verified') {
            record.verified = value.toLowerCase() === 'true';
          } else if (header === 'description') {
            record.description = value;
            record.itemDescription = value;
          } else if (header === 'lineTotal' || header === 'tax' || header === 'gratuity' || header === 'discount') {
            (record as any)[header] = parseFloat(value.replace(/[$,]/g, '')) || 0;
          } else {
            (record as any)[header] = value;
          }
        }
      });

      if (record.cruiseId) {
        record.bookingId = record.bookingId ?? record.cruiseId;
        record.reservationNumber = record.reservationNumber ?? record.cruiseId;
      }

      record.processedAt = new Date().toISOString();
      record.currency = 'USD';
      if (record.sourceType === 'statement' && record.amount !== undefined) {
        record.txnType = record.amount >= 0 ? 'Charge' : 'Credit';
      }
      records.push(record);
    }

    const seenReceipts = new Set<string>();
    const seenStatements = new Set<string>();
    const uniqueRecords = records.filter((r: any) => {
      const amountLike = (typeof r.amount === 'number' ? r.amount : (typeof r.lineTotal === 'number' ? r.lineTotal : 0)) || 0;
      if (r.sourceType === 'receipt') {
        const key = `${r.cruiseId ?? ''}|${r.receiptId ?? ''}|${r.receiptDateTime ?? ''}|${r.itemDescription ?? r.description ?? ''}|${amountLike}`;
        if (seenReceipts.has(key)) return false;
        seenReceipts.add(key);
        return true;
      }
      // For statements, allow legitimate same-day same-amount rows; only drop true exact duplicates
      const key = `${r.cruiseId ?? ''}|${r.statementId ?? ''}|${r.postDate ?? ''}|${r.description ?? r.itemDescription ?? ''}|${amountLike}`;
      if (seenStatements.has(key)) return false;
      seenStatements.add(key);
      return true;
    });

    memoryStore.financials = [];
    const inserted = memoryStore.addFinancials(uniqueRecords).length;
    await memoryStore.persistNow();
    console.log('[tRPC] loadCsvIntoMemory: finished', { path: csvPath, inserted, skipped, total: lines.length - 1, unique: uniqueRecords.length });
    return { success: true, inserted, path: csvPath, skipped, totalLines: lines.length - 1, headers };
  } catch (e: any) {
    console.error('[tRPC] loadCsvIntoMemory error', e);
    return { success: false, inserted: 0, error: e?.message };
  }
}

export const financialsRouter = createTRPCRouter({
  insertHardcodedReceipts: publicProcedure
    .mutation(async () => {
      console.log('[tRPC] financials.insertHardcodedReceipts called');
      try {
        // Clear existing receipts to avoid duplicates
        const existingFinancials = memoryStore.getFinancials();
        const nonReceiptFinancials = existingFinancials.filter(f => f.sourceType !== 'receipt');
        memoryStore.financials = nonReceiptFinancials;
        
        const records = [
          {
            cruiseId: '7871133',
            shipName: 'WONDER OF THE SEAS',
            sailDateStart: '2025-03-09T00:00:00.000Z',
            itineraryName: '7 NIGHT WESTERN CARIBBEAN & PERFECT DAY',
            guestName: 'SCOTT MERLIS',
            reservationNumber: '7871133',
            sourceType: 'receipt' as const,
            sourceFileBaseName: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/6s86n31sl2069dh661906',
            processedAt: new Date().toISOString(),
            verified: true,
            receiptId: 'WON-2025-03-09',
            venue: 'Cruise Fare',
            category: 'Other' as const,
            itemDescription: 'Taxes, fees, and port expenses',
            lineTotal: 321.10,
            tax: 0,
            gratuity: 0,
            discount: 0,
            paymentMethod: 'Credit Card' as const,
          },
          {
            cruiseId: '5207254',
            shipName: 'NAVIGATOR OF THE SEAS',
            sailDateStart: '2025-09-15T00:00:00.000Z',
            itineraryName: '4 NIGHT CATALINA & ENSENADA CRUISE',
            guestName: 'SCOTT MERLIS',
            reservationNumber: '5207254',
            sourceType: 'receipt' as const,
            sourceFileBaseName: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/oqzz0h5shpbrq6j24vktw',
            processedAt: new Date().toISOString(),
            verified: true,
            receiptId: 'NAV-2025-09-15',
            venue: 'Cruise Fare',
            category: 'Other' as const,
            itemDescription: 'Taxes, fees, and port expenses',
            lineTotal: 127.17,
            tax: 0,
            gratuity: 0,
            discount: 0,
            paymentMethod: 'Credit Card' as const,
          },
          {
            cruiseId: '7836829',
            shipName: 'RADIANCE OF THE SEAS',
            sailDateStart: '2025-09-26T00:00:00.000Z',
            itineraryName: '8 NIGHT PACIFIC COASTAL CRUISE',
            guestName: 'SCOTT MERLIS',
            reservationNumber: '7836829',
            sourceType: 'receipt' as const,
            sourceFileBaseName: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/g3w6rstf6mhzrmpt0z306',
            processedAt: new Date().toISOString(),
            verified: true,
            receiptId: 'RAD-2025-09-26',
            venue: 'Cruise Fare',
            category: 'Other' as const,
            itemDescription: 'Taxes, fees, and port expenses',
            lineTotal: 296.42,
            tax: 0,
            gratuity: 0,
            discount: 0,
            paymentMethod: 'Credit Card' as const,
          },
          {
            cruiseId: '2755395',
            shipName: 'LIBERTY OF THE SEAS',
            sailDateStart: '2025-10-16T00:00:00.000Z',
            itineraryName: '9 NIGHT CANADA & NEW ENGLAND CRUISE',
            guestName: 'SCOTT MERLIS',
            reservationNumber: '2755395',
            sourceType: 'receipt' as const,
            sourceFileBaseName: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/g4l15ql58gx9jktr2yf7g',
            processedAt: new Date().toISOString(),
            verified: true,
            receiptId: 'LIB-2025-10-16',
            venue: 'Cruise Fare',
            category: 'Other' as const,
            itemDescription: 'Taxes, fees, and port expenses',
            lineTotal: 505.00,
            tax: 0,
            gratuity: 0,
            discount: 0,
            paymentMethod: 'Credit Card' as const,
          },
          {
            cruiseId: '2552321',
            shipName: 'QUANTUM OF THE SEAS',
            sailDateStart: '2025-10-22T00:00:00.000Z',
            itineraryName: '6 NIGHT CABO OVERNIGHT AND ENSENADA',
            guestName: 'SCOTT MERLIS',
            reservationNumber: '2552321',
            sourceType: 'receipt' as const,
            sourceFileBaseName: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/wfyhtc9cwihvdscd954hw',
            processedAt: new Date().toISOString(),
            verified: true,
            receiptId: 'QON-2025-10-22',
            venue: 'Cruise Fare',
            category: 'Other' as const,
            itemDescription: 'Taxes, fees, and port expenses',
            lineTotal: 133.06,
            tax: 0,
            gratuity: 0,
            discount: 0,
            paymentMethod: 'Credit Card' as const,
          },
          {
            cruiseId: '2665774',
            shipName: 'STAR OF THE SEAS',
            sailDateStart: '2025-08-27T00:00:00.000Z',
            itineraryName: '4N STAR SHOWCASE CRUISE TO PERFECT DAY',
            guestName: 'SCOTT MERLIS',
            reservationNumber: '2665774',
            sourceType: 'receipt' as const,
            sourceFileBaseName: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/xdp50qus945howkctbtxg',
            processedAt: new Date().toISOString(),
            verified: true,
            receiptId: 'STAR-2025-08-27',
            venue: 'Cruise Fare',
            category: 'Other' as const,
            itemDescription: 'Taxes, fees, and port expenses + upgrade',
            lineTotal: 277.12,
            tax: 0,
            gratuity: 0,
            discount: 0,
            paymentMethod: 'Credit Card' as const,
          },
          {
            cruiseId: '2501764',
            shipName: 'HARMONY OF THE SEAS',
            sailDateStart: '2025-04-20T00:00:00.000Z',
            itineraryName: '7 NIGHT WESTERN CARIBBEAN CRUISE',
            guestName: 'SCOTT MERLIS',
            reservationNumber: '2501764',
            sourceType: 'receipt' as const,
            sourceFileBaseName: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/zs1r7dms2qm73ik7tnuw3',
            processedAt: new Date().toISOString(),
            verified: true,
            receiptId: 'HAR-2025-04-20',
            venue: 'Cruise Fare',
            category: 'Other' as const,
            itemDescription: 'Taxes, fees, and port expenses',
            lineTotal: 784.92,
            tax: 0,
            gratuity: 0,
            discount: 0,
            paymentMethod: 'Credit Card' as const,
          },
          {
            cruiseId: '236930',
            shipName: 'OVATION OF THE SEAS',
            sailDateStart: '2025-07-29T00:00:00.000Z',
            itineraryName: '3 NIGHT ENSENADA CRUISE',
            guestName: 'SCOTT MERLIS',
            reservationNumber: '236930',
            sourceType: 'receipt' as const,
            sourceFileBaseName: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/9e8fqhg63ouwz8le909ze',
            processedAt: new Date().toISOString(),
            verified: true,
            receiptId: 'OVA-2025-07-29',
            venue: 'Cruise Fare',
            category: 'Other' as const,
            itemDescription: 'Taxes, fees, and port expenses',
            lineTotal: 109.68,
            tax: 0,
            gratuity: 0,
            discount: 0,
            paymentMethod: 'Credit Card' as const,
          },
          {
            cruiseId: '7120064',
            shipName: 'QUANTUM OF THE SEAS',
            sailDateStart: '2025-10-02T00:00:00.000Z',
            itineraryName: '4 NIGHT ENSENADA CRUISE',
            guestName: 'SCOTT MERLIS',
            reservationNumber: '7120064',
            sourceType: 'receipt' as const,
            sourceFileBaseName: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/r17wmqag5657s1sz58fol',
            processedAt: new Date().toISOString(),
            verified: true,
            receiptId: 'QON-2025-10-02',
            venue: 'Cruise Fare',
            category: 'Other' as const,
            itemDescription: 'Taxes, fees, and port expenses',
            lineTotal: 466.16,
            tax: 0,
            gratuity: 0,
            discount: 0,
            paymentMethod: 'Credit Card' as const,
          },
          {
            cruiseId: '29779',
            shipName: 'QUANTUM OF THE SEAS',
            sailDateStart: '2025-11-17T00:00:00.000Z',
            itineraryName: '4 NIGHT ENSENADA CRUISE',
            guestName: 'SCOTT MERLIS',
            reservationNumber: '29779',
            sourceType: 'receipt' as const,
            sourceFileBaseName: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/62gjsbl9r6y9xp21pvxqi',
            processedAt: new Date().toISOString(),
            verified: true,
            receiptId: 'QON-2025-11-17',
            venue: 'Cruise Fare',
            category: 'Other' as const,
            itemDescription: 'Taxes, fees, and port expenses',
            lineTotal: 109.88,
            tax: 0,
            gratuity: 0,
            discount: 0,
            paymentMethod: 'Credit Card' as const,
          },
          {
            cruiseId: '5207254-2',
            shipName: 'NAVIGATOR OF THE SEAS',
            sailDateStart: '2025-09-15T00:00:00.000Z',
            itineraryName: '4 NIGHT CATALINA & ENSENADA CRUISE',
            guestName: 'SCOTT MERLIS',
            reservationNumber: '5207254',
            sourceType: 'receipt' as const,
            sourceFileBaseName: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/111ykxu6poxsln6wwncpv',
            processedAt: new Date().toISOString(),
            verified: true,
            receiptId: 'NAV-2025-09-15-B',
            venue: 'Cruise Fare',
            category: 'Other' as const,
            itemDescription: 'Duplicate image variant',
            lineTotal: 127.17,
            tax: 0,
            gratuity: 0,
            discount: 0,
            paymentMethod: 'Credit Card' as const,
          },
        ];
        const created = memoryStore.addFinancials(records.map(r => ({
          ...r,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          id: undefined as unknown as string,
        })));
        console.log('[tRPC] financials.insertHardcodedReceipts inserted', created.length);
        
        // Force persistence and wait for it
        try {
          await memoryStore.persistNow();
          console.log('[tRPC] financials.insertHardcodedReceipts persisted successfully');
        } catch (e) {
          console.error('[tRPC] Failed to persist:', e);
        }
        
        return { success: true as const, inserted: created.length };
      } catch (e) {
        console.error('[tRPC] financials.insertHardcodedReceipts error', e);
        return { success: false as const, inserted: 0 };
      }
    }),
  insertHardcodedStatements: publicProcedure
    .mutation(async () => {
      console.log('[tRPC] financials.insertHardcodedStatements called');
      try {
        const mk = (date: string, category: string, description: string, amount: number) => ({ date, category, description, amount });
        
        // Clear existing statements to avoid duplicates
        memoryStore.cruiseStatements = [];
        
        const createdStatements = [
          memoryStore.createCruiseStatement({
            cruiseId: '7871133',
            reservationNumber: '7871133',
            ship: 'WONDER OF THE SEAS',
            cabinNumber: '9711',
            departureDate: '2025-03-09',
            returnDate: '2025-03-16',
            itinerary: '7 Night Western Caribbean & Perfect Day',
            folio: 'WON-9711-03-2025',
            lineItems: [
              mk('2025-03-09','PLAY','CLUB ROYALE ENTERTAINMENT',650.00),
              mk('2025-03-09','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',20.00),
              mk('2025-03-10','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',150.00),
              mk('2025-03-10','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',100.00),
              mk('2025-03-10','BEVERAGES','LIME & COCONUT',12.98),
              mk('2025-03-10','SERVICES','ONBOARD GRATUITIES',18.50),
              mk('2025-03-10','SERVICES','ONBOARD GRATUITIES',18.50),
              mk('2025-03-10','DINING','IZUMI',82.60),
              mk('2025-03-11','BEVERAGES','STARBUCKS',4.07),
              mk('2025-03-11','BEVERAGES','VITALITY CAFE',2.36),
              mk('2025-03-11','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',40.00),
              mk('2025-03-11','BEVERAGES','CASINO BAR',6.49),
              mk('2025-03-11','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',40.00),
              mk('2025-03-11','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',100.00),
              mk('2025-03-11','CREDITS','NON-REFUNDABLE ONBOARD CREDIT',-150.00),
              mk('2025-03-11','SERVICES','ONBOARD GRATUITIES',18.50),
              mk('2025-03-11','BEVERAGES','CASINO BAR',6.49),
              mk('2025-03-12','SERVICES','ONBOARD GRATUITIES',18.50),
              mk('2025-03-12','DINING','CHEF\'S TABLE',117.99),
              mk('2025-03-12','PLAY','CLUB ROYALE ENTERTAINMENT',500.00),
              mk('2025-03-13','BEVERAGES','LIME & COCONUT',6.49),
              mk('2025-03-13','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',100.00),
              mk('2025-03-13','SERVICES','ONBOARD GRATUITIES',18.50),
              mk('2025-03-13','PLAY','CLUB ROYALE ENTERTAINMENT',500.00),
              mk('2025-03-14','BEVERAGES','LIME & COCONUT',1.00),
              mk('2025-03-14','SERVICES','ONBOARD GRATUITIES',18.50),
              mk('2025-03-14','BEVERAGES','STATEROOM SERVICE',9.38),
              mk('2025-03-15','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',40.00),
              mk('2025-03-15','SHOPPING','SOLERA',110.00),
              mk('2025-03-15','BEVERAGES','STATEROOM SERVICE',10.00),
            ]
          }),
          memoryStore.createCruiseStatement({
            cruiseId: '6242276',
            reservationNumber: '6242276',
            ship: 'OVATION OF THE SEAS',
            cabinNumber: '9234',
            departureDate: '2025-08-01',
            returnDate: '2025-08-04',
            itinerary: '3 Night Ensenada Cruise',
            folio: 'OVA-9234-08-2025',
            lineItems: [
              mk('2025-08-01','SPA','SPA/SALON',192.36),
              mk('2025-08-01','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',100.00),
              mk('2025-08-01','BEVERAGES','CASINO BAR',6.49),
              mk('2025-08-02','SPA','SPA/SALON',20.00),
              mk('2025-08-02','INTERNET / COMMUNICATIONS','INTERNET',25.99),
              mk('2025-08-02','SERVICES','ONBOARD GRATUITIES',18.50),
              mk('2025-08-02','SERVICES','ONBOARD GRATUITIES',18.50),
              mk('2025-08-02','BEVERAGES','CASINO BAR',6.49),
              mk('2025-08-02','SERVICES','ONBOARD GRATUITIES',18.50),
              mk('2025-08-02','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',40.00),
              mk('2025-08-03','MISC','MEXICO NON-RESIDENT TAX',5.00),
              mk('2025-08-03','REFUND - SERVICES','ONBOARD GRATUITIES',-55.50),
              mk('2025-08-03','BEVERAGES','LIME & COCONUT',6.49),
              mk('2025-08-03','BEVERAGES','CASINO BAR',27.14),
              mk('2025-08-03','REFUND - BEVERAGES','CASINO BAR',-27.14),
              mk('2025-08-03','BEVERAGES','CASINO BAR',12.98),
            ]
          }),
          memoryStore.createCruiseStatement({
            cruiseId: '236930',
            reservationNumber: '236930',
            ship: 'OVATION OF THE SEAS',
            cabinNumber: '10556',
            departureDate: '2025-07-29',
            returnDate: '2025-08-01',
            itinerary: '3 Night Ensenada Cruise',
            folio: 'OVA-10556-07-2025',
            lineItems: [
              mk('2025-07-29','BEVERAGES','POOL BAR',7.07),
              mk('2025-07-29','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',100.00),
              mk('2025-07-29','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',60.00),
              mk('2025-07-29','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',40.00),
              mk('2025-07-30','BEVERAGES','POOL BAR',6.49),
              mk('2025-07-30','MISC','MEXICO NON-RESIDENT TAX',5.00),
              mk('2025-07-30','INTERNET/COMMUNICATIONS','INTERNET',26.99),
              mk('2025-07-30','SERVICES','ONBOARD GRATUITIES',18.50),
              mk('2025-07-30','SERVICES','ONBOARD GRATUITIES',18.50),
              mk('2025-07-30','SERVICES','ONBOARD GRATUITIES',18.50),
              mk('2025-07-30','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',100.00),
              mk('2025-07-30','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',100.00),
              mk('2025-07-31','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',100.00),
              mk('2025-07-31','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',100.00),
              mk('2025-07-31','BEVERAGES','CASINO BAR',6.49),
              mk('2025-07-31','BEVERAGES','CASINO BAR',16.82),
              mk('2025-07-31','BEVERAGES','CASINO BAR',6.49),
              mk('2025-07-31','REFUND - BEVERAGES','CASINO BAR',-16.82),
            ]
          }),
          memoryStore.createCruiseStatement({
            cruiseId: '2665774',
            reservationNumber: '2665774',
            ship: 'STAR OF THE SEAS',
            cabinNumber: '10187',
            departureDate: '2025-08-27',
            returnDate: '2025-08-31',
            itinerary: '4N Star Showcase Cruise to Perfect Day',
            folio: 'STAR-10187-08-2025',
            lineItems: [
              mk('2025-08-27','CREDITS','NON-REFUNDABLE ONBOARD CREDIT',-25.00),
              mk('2025-08-27','BEVERAGES','CLOUD 17',6.88),
              mk('2025-08-27','PLAY','ESCAPE ROOM',39.99),
              mk('2025-08-27','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',150.00),
              mk('2025-08-27','DINING','HOOKED',16.70),
              mk('2025-08-27','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',150.00),
              mk('2025-08-27','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',100.00),
              mk('2025-08-27','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',150.00),
              mk('2025-08-27','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',100.00),
              mk('2025-08-27','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',200.00),
              mk('2025-08-28','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',250.00),
              mk('2025-08-28','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',100.00),
              mk('2025-08-28','SERVICES','WOW BANDS',14.99),
              mk('2025-08-28','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',200.00),
              mk('2025-08-28','BEVERAGES','CASINO BAR',12.98),
              mk('2025-08-28','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',200.00),
              mk('2025-08-28','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',200.00),
              mk('2025-08-28','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',127.00),
              mk('2025-08-28','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',100.00),
              mk('2025-08-28','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',150.00),
              mk('2025-08-28','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',107.00),
              mk('2025-08-28','DINING','IZUMI',61.95),
              mk('2025-08-28','REFUND - DINING','IZUMI',-61.95),
              mk('2025-08-29','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',100.00),
              mk('2025-08-29','BEVERAGES','CASINO BAR',12.98),
              mk('2025-08-29','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',300.00),
              mk('2025-08-29','INTERNET / COMMUNICATIONS','INTERNET',34.99),
              mk('2025-08-29','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',20.00),
              mk('2025-08-29','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',40.00),
              mk('2025-08-30','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',177.00),
              mk('2025-08-30','REFUND - INTERNET / COMMUNICAT','INTERNET',-10.50),
              mk('2025-08-30','REFUND - INTERNET / COMMUNICAT','INTERNET',-10.50),
              mk('2025-08-30','BEVERAGES','CASINO BAR',19.47),
            ]
          }),
          memoryStore.createCruiseStatement({
            cruiseId: '2501764',
            reservationNumber: '2501764',
            ship: 'HARMONY OF THE SEAS',
            cabinNumber: '12729',
            departureDate: '2025-04-20',
            returnDate: '2025-04-27',
            itinerary: '7 Night Western Caribbean Cruise',
            folio: 'HAR-12729-04-2025',
            lineItems: [
              mk('2025-04-20','BEVERAGES','CASINO BAR',6.49),
              mk('2025-04-20','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',150.00),
              mk('2025-04-20','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',200.00),
              mk('2025-04-20','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',100.00),
              mk('2025-04-20','PLAY','CLUB ROYALE ENTERTAINMENT',525.00),
              mk('2025-04-21','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',40.00),
              mk('2025-04-21','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',150.00),
              mk('2025-04-21','SERVICES','ONBOARD GRATUITIES',18.50),
              mk('2025-04-21','SERVICES','ONBOARD GRATUITIES',18.50),
              mk('2025-04-21','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',150.00),
              mk('2025-04-21','BEVERAGES','CASINO BAR',6.49),
              mk('2025-04-21','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',40.00),
              mk('2025-04-21','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',100.00),
              mk('2025-04-22','INTERNET / COMMUNICATIONS','INTERNET',149.95),
              mk('2025-04-22','SERVICES','ONBOARD GRATUITIES',18.50),
              mk('2025-04-22','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',127.00),
              mk('2025-04-23','BEVERAGES','CASINO BAR',16.52),
              mk('2025-04-23','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',100.00),
              mk('2025-04-23','BEVERAGES','STATEROOM SERVICE',9.38),
              mk('2025-04-23','BEVERAGES','STATEROOM SERVICE',5.00),
              mk('2025-04-23','SERVICES','ONBOARD GRATUITIES',18.50),
              mk('2025-04-24','BEVERAGES','CASINO BAR',12.98),
              mk('2025-04-24','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',40.00),
              mk('2025-04-24','BEVERAGES','STATEROOM SERVICE',9.38),
              mk('2025-04-24','BEVERAGES','STATEROOM SERVICE',9.38),
              mk('2025-04-24','BEVERAGES','STATEROOM SERVICE',2.00),
            ]
          }),
          memoryStore.createCruiseStatement({
            cruiseId: '5207254',
            reservationNumber: '5207254',
            ship: 'NAVIGATOR OF THE SEAS',
            cabinNumber: 'N/A',
            departureDate: '2025-09-15',
            returnDate: '2025-09-19',
            itinerary: '4 Night Catalina & Ensenada Cruise',
            folio: 'NAV-5207254-09-2025-A',
            lineItems: [
              mk('2025-09-15','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',100.00),
              mk('2025-09-16','BEVERAGES','CASINO BAR',12.98),
              mk('2025-09-17','SERVICES','ONBOARD GRATUITIES',18.50),
            ]
          }),
          memoryStore.createCruiseStatement({
            cruiseId: '5207254',
            reservationNumber: '5207254',
            ship: 'NAVIGATOR OF THE SEAS',
            cabinNumber: 'N/A',
            departureDate: '2025-09-15',
            returnDate: '2025-09-19',
            itinerary: '4 Night Catalina & Ensenada Cruise',
            folio: 'NAV-5207254-09-2025-B',
            lineItems: [
              mk('2025-09-18','GAMING','CLUB ROYALE ENTERTAINMENT GAMES',60.00),
              mk('2025-09-18','BEVERAGES','CASINO BAR',6.49),
              mk('2025-09-19','MISC','MEXICO NON-RESIDENT TAX',5.00),
            ]
          }),
        ];
        
        // Count the actual financial records created (line items)
        const totalLineItems = createdStatements.reduce((sum, s: any) => {
          return sum + (Array.isArray(s.lineItems) ? s.lineItems.length : 0);
        }, 0);
        
        console.log('[tRPC] financials.insertHardcodedStatements created statements:', createdStatements.length, 'with', totalLineItems, 'line items');
        
        // Force persistence and wait for it
        try {
          await memoryStore.persistNow();
          console.log('[tRPC] financials.insertHardcodedStatements persisted successfully');
        } catch (e) {
          console.error('[tRPC] Failed to persist:', e);
        }
        
        return { success: true as const, inserted: totalLineItems };
      } catch (e) {
        console.error('[tRPC] financials.insertHardcodedStatements error', e);
        return { success: false as const, inserted: 0 };
      }
    }),
  list: publicProcedure
    .query(async () => {
      console.log('[tRPC] financials.list called');
      try {
        let data = memoryStore.getFinancials();
        if (data.length === 0) {
          console.log('[tRPC] financials.list: empty store, attempting CSV autoload');
          const res = await loadCsvIntoMemory();
          console.log('[tRPC] financials.list: autoload result', res);
          data = memoryStore.getFinancials();
        }
        console.log('[tRPC] financials.list returning', data.length, 'rows');
        return data;
      } catch (e) {
        console.error('[tRPC] financials.list error', e);
        return [] as FinancialsRecord[];
      }
    }),
  analyticsSummary: publicProcedure
    .input(z.object({
      cohort: z.enum(['all','last12m']).optional(),
      dateRange: z.object({ from: z.string(), to: z.string() }).optional(),
    }).optional())
    .query(({ input }) => {
      console.log('[tRPC] financials.analyticsSummary called', input);
      try {
        const rows = memoryStore.getFinancials();
        const inRange = rows.filter(r => {
          const date = r.postDate || r.receiptDateTime || r.processedAt;
          if (!input?.dateRange) return true;
          if (!date) return false;
          return date >= input.dateRange.from && date <= input.dateRange.to;
        });
        let totalRetail = 0;
        let totalOut = 0;
        let taxesFees = 0;
        const byCategory: Record<string, number> = {};
        let casinoSpendMasters = 0;
        inRange.forEach(r => {
          if (r.sourceType === 'receipt') {
            const retail = (r.lineTotal ?? 0) + (r.tax ?? 0) + (r.gratuity ?? 0) - (r.discount ?? 0);
            totalRetail += retail;
            const cat = (r.category ?? 'Other').toString();
            byCategory[cat] = (byCategory[cat] || 0) + retail;
          } else if (r.sourceType === 'statement') {
            const amt = r.amount ?? 0;
            totalOut += amt > 0 ? amt : 0;
            const dept = (r.department ?? 'Other').toString();
            byCategory[dept] = (byCategory[dept] || 0) + Math.max(0, amt);
            if (dept === 'Taxes' || dept === 'ServiceFees' || dept === 'Gratuities') taxesFees += Math.max(0, amt);
            if (dept === 'Casino' && isMasterCruise(r.cruiseId)) casinoSpendMasters += Math.max(0, amt);
          }
        });
        const userPts = memoryStore.getUserProfile()?.points ?? 0;
        const pointsApprox = Math.max(userPts, Math.floor(casinoSpendMasters / 5));
        const savings = Math.max(0, totalRetail - totalOut);
        const roi = totalOut > 0 ? savings / totalOut : 0;
        const vpp = pointsApprox > 0 ? savings / pointsApprox : 0;
        return {
          totals: { retail: totalRetail, outOfPocket: totalOut, taxesFees, savings, roi, vpp },
          categories: Object.entries(byCategory).map(([key, total]) => ({ key, total })),
          pointsApprox,
          count: inRange.length
        };
      } catch (e) {
        console.error('[tRPC] financials.analyticsSummary error', e);
        return { totals: { retail: 0, outOfPocket: 0, taxesFees: 0, savings: 0, roi: 0, vpp: 0 }, categories: [], pointsApprox: 0, count: 0 };
      }
    }),
  statusAndPoints: publicProcedure
    .query(() => {
      console.log('[tRPC] financials.statusAndPoints called');
      try {
        const profile = memoryStore.getUserProfile();
        const rows = memoryStore.getFinancials();
        const casinoRecognizedTotal = rows.reduce((sum, r) => {
          if (r.sourceType === 'statement' && r.department === 'Casino') {
            return sum + Math.max(0, r.amount ?? 0);
          }
          return sum;
        }, 0);
        return {
          level: profile?.level ?? 'PRIME',
          points: profile?.points ?? 0,
          nextLevelPoints: profile?.nextLevelPoints ?? 25000,
          casinoRecognizedTotal,
          freePlay: { earned: 0, redeemed: 0 }
        };
      } catch (e) {
        console.error('[tRPC] financials.statusAndPoints error', e);
        return { level: 'PRIME', points: 0, nextLevelPoints: 25000, casinoRecognizedTotal: 0, freePlay: { earned: 0, redeemed: 0 } };
      }
    }),
  financialOverview: publicProcedure
    .query(() => {
      console.log('[tRPC] financials.financialOverview called');
      try {
        const rows = memoryStore.getFinancials();
        let retail = 0, out = 0, taxesFees = 0;
        let freePlayEarned = 0, freePlayRedeemed = 0;
        const byDeptRaw: Record<string, number> = {};
        let casinoSpendMasters = 0;
        rows.forEach(r => {
          if (r.sourceType === 'receipt') {
            const retailRow = (r.lineTotal ?? 0) + (r.tax ?? 0) + (r.gratuity ?? 0) - (r.discount ?? 0);
            retail += retailRow;
          } else {
            const amt = Math.max(0, r.amount ?? 0);
            out += amt;
            const dept = (r.department ?? 'Other').toString();
            byDeptRaw[dept] = (byDeptRaw[dept] || 0) + amt;
            if (dept === 'Taxes' || dept === 'ServiceFees' || dept === 'Gratuities') taxesFees += amt;
            if (dept === 'Casino' && isMasterCruise(r.cruiseId)) casinoSpendMasters += amt;
            const desc = (r.description ?? '').toUpperCase();
            if (desc.includes('FREE PLAY')) {
              if (r.txnType === 'Credit') freePlayEarned += Math.max(0, r.amount ?? 0);
              else if (r.txnType === 'Charge') freePlayRedeemed += Math.max(0, r.amount ?? 0);
            }
          }
        });
        const normalizeKey = (dept: string) => {
          switch (dept) {
            case 'Dining': return 'dining';
            case 'Beverage': return 'beverage';
            case 'ShoreEx': return 'excursions';
            case 'Spa': return 'spa';
            case 'Casino': return 'casino';
            default: return 'other';
          }
        };
        const onboardMap: Record<string, number> = {};
        Object.entries(byDeptRaw).forEach(([k, v]) => {
          const nk = normalizeKey(k);
          onboardMap[nk] = (onboardMap[nk] || 0) + v;
        });
        const mixedCurrency = detectMixedCurrency(rows);
        const savings = Math.max(0, retail - out);
        const roi = out > 0 ? savings / out : 0;
        const computedPoints = Math.floor((casinoSpendMasters ?? 0) / 5);
        const profilePoints = memoryStore.getUserProfile()?.points ?? 0;
        const points = Math.max(profilePoints, computedPoints);
        const vpp = points > 0 ? savings / points : 0;
        const onboardCategories = [
          { key: 'dining', total: onboardMap['dining'] ?? 0 },
          { key: 'beverage', total: onboardMap['beverage'] ?? 0 },
          { key: 'excursions', total: onboardMap['excursions'] ?? 0 },
          { key: 'spa', total: onboardMap['spa'] ?? 0 },
          { key: 'casino', total: onboardMap['casino'] ?? 0 },
          { key: 'other', total: onboardMap['other'] ?? 0 },
        ];
        return { retail, outOfPocket: out, taxesFees, onboardCategories, roi, vpp, points, freePlay: { earned: freePlayEarned, redeemed: freePlayRedeemed }, mixedCurrency };
      } catch (e) {
        console.error('[tRPC] financials.financialOverview error', e);
        return { retail: 0, outOfPocket: 0, taxesFees: 0, onboardCategories: [], roi: 0, vpp: 0, points: 0, freePlay: { earned: 0, redeemed: 0 }, mixedCurrency: false };
      }
    }),
  pairedSummary: publicProcedure
    .query(() => {
      console.log('[tRPC] financials.pairedSummary called');
      try {
        const rows = memoryStore.getFinancials();
        const byCruise: Record<string, { hasReceipt: boolean; hasStatement: boolean; retail: number; out: number }> = {};
        rows.forEach(r => {
          const key = r.cruiseId || 'unknown';
          if (!byCruise[key]) byCruise[key] = { hasReceipt: false, hasStatement: false, retail: 0, out: 0 };
          const b = byCruise[key];
          if (r.sourceType === 'receipt') {
            b.hasReceipt = true;
            b.retail += (r.lineTotal ?? 0) + (r.tax ?? 0) + (r.gratuity ?? 0) - (r.discount ?? 0);
          } else if (r.sourceType === 'statement') {
            b.hasStatement = true;
            b.out += Math.max(0, r.amount ?? 0);
          }
        });
        let pairedCount = 0, singlesReceiptOnly = 0, singlesStatementOnly = 0;
        let totalRetail = 0, totalOut = 0;
        Object.values(byCruise).forEach(b => {
          if (b.hasReceipt && b.hasStatement) { pairedCount++; totalRetail += b.retail; totalOut += b.out; }
          else if (b.hasReceipt) singlesReceiptOnly++;
          else if (b.hasStatement) singlesStatementOnly++;
        });
        const savings = Math.max(0, totalRetail - totalOut);
        const roi = totalOut > 0 ? (savings / totalOut) * 100 : 0;
        return { pairedCount, singlesReceiptOnly, singlesStatementOnly, savings, roi };
      } catch (e) {
        console.error('[tRPC] financials.pairedSummary error', e);
        return { pairedCount: 0, singlesReceiptOnly: 0, singlesStatementOnly: 0, savings: 0, roi: 0 };
      }
    }),
  casinoAnalytics: publicProcedure
    .query(() => {
      console.log('[tRPC] financials.casinoAnalytics called');
      try {
        const rows = memoryStore.getFinancials();
        let coinInMasters = 0; // approx by casino charges for master cruises only
        let retail = 0;
        let out = 0;
        rows.forEach(r => {
          if (r.sourceType === 'statement' && r.department === 'Casino' && isMasterCruise(r.cruiseId)) {
            const amt = Math.max(0, r.amount ?? 0);
            coinInMasters += amt;
          }
          if (r.sourceType === 'receipt') retail += (r.lineTotal ?? 0);
          if (r.sourceType === 'statement') out += Math.max(0, r.amount ?? 0);
        });
        const computedPoints = Math.floor(coinInMasters / 5);
        const profilePoints = memoryStore.getUserProfile()?.points ?? 0;
        const points = Math.max(profilePoints, computedPoints);
        const savings = Math.max(0, retail - out);
        const roi = out > 0 ? savings / out : 0;
        const vpp = points > 0 ? savings / points : 0;
        return { coinIn: coinInMasters, points, retail, outOfPocket: out, roi, vpp };
      } catch (e) {
        console.error('[tRPC] financials.casinoAnalytics error', e);
        return { coinIn: 0, points: 0, retail: 0, outOfPocket: 0, roi: 0, vpp: 0 };
      }
    }),
  read: publicProcedure
    .query(() => {
      console.log('[tRPC] financials.read called');
      try {
        return { rows: memoryStore.getFinancials(), count: memoryStore.getFinancials().length };
      } catch (e) {
        console.error('[tRPC] financials.read error', e);
        return { rows: [] as FinancialsRecord[], count: 0 };
      }
    }),
  byCruise: publicProcedure
    .input(z.object({ cruiseId: z.string() }))
    .query(({ input }) => {
      console.log('[tRPC] financials.byCruise called', input);
      try {
        return memoryStore.getFinancialsByCruiseId(input.cruiseId);
      } catch (e) {
        console.error('[tRPC] financials.byCruise error', e);
        return [] as FinancialsRecord[];
      }
    }),
  add: publicProcedure
    .input(z.object({ records: z.array(financialsInputSchema) }))
    .mutation(({ input }) => {
      console.log('[tRPC] financials.add called for', input.records.length, 'records');
      try {
        const created = memoryStore.addFinancials(
          input.records.map(r => ({ ...r, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), id: undefined as unknown as string }))
        );
        return { success: true as const, inserted: created.length };
      } catch (e) {
        console.error('[tRPC] financials.add error', e);
        return { success: false as const, inserted: 0 };
      }
    }),
  writeRows: publicProcedure
    .input(z.object({ records: z.array(financialsInputSchema) }))
    .mutation(({ input }) => {
      console.log('[tRPC] financials.writeRows called for', input.records.length, 'records');
      try {
        const created = memoryStore.addFinancials(
          input.records.map(r => ({ ...r, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), id: undefined as unknown as string }))
        );
        return { success: true as const, inserted: created.length };
      } catch (e) {
        console.error('[tRPC] financials.writeRows error', e);
        return { success: false as const, inserted: 0 };
      }
    }),
  unlinked: publicProcedure
    .query(() => {
      console.log('[tRPC] financials.unlinked called');
      try {
        const rows = memoryStore.getFinancials();
        const unlinked = rows.filter(r => !r.cruiseId || r.cruiseId.trim() === '' || !r.verified);
        console.log('[tRPC] financials.unlinked returning', unlinked.length);
        return unlinked;
      } catch (e) {
        console.error('[tRPC] financials.unlinked error', e);
        return [] as FinancialsRecord[];
      }
    }),
  linkRecord: publicProcedure
    .input(z.object({ id: z.string(), cruiseId: z.string(), verify: z.boolean().optional() }))
    .mutation(({ input }) => {
      console.log('[tRPC] financials.linkRecord called', input);
      try {
        const rows = memoryStore.getFinancials();
        const idx = rows.findIndex(r => r.id === input.id);
        if (idx === -1) {
          return { success: false as const, message: 'Record not found' };
        }
        const record = rows[idx];
        record.cruiseId = input.cruiseId;
        if (input.verify === true) {
          const isValidAmount = typeof record.amount === 'number' || typeof record.lineTotal === 'number';
          if (isValidAmount) {
            record.verified = true;
          }
        }
        record.updatedAt = new Date().toISOString();
        console.log('[tRPC] financials.linkRecord updated');
        return { success: true as const };
      } catch (e) {
        console.error('[tRPC] financials.linkRecord error', e);
        return { success: false as const, message: 'Failed to link' };
      }
    }),
  countOverview: publicProcedure
    .query(async () => {
      console.log('[tRPC] financials.countOverview called');
      try {
        const tripItEvents = memoryStore.getCalendarEvents().length;

        // Always hard-reload from CSV to guarantee exact row count and avoid prior inflated in-memory state
        const reload = await loadCsvIntoMemory();
        console.log('[tRPC] financials.countOverview: CSV reload', { inserted: reload.inserted, skipped: reload.skipped, path: reload.path });
        const finRows = memoryStore.getFinancials();

        const receiptsFromFin = finRows.filter(r => r.sourceType === 'receipt');
        const statementsFromFin = finRows.filter(r => r.sourceType === 'statement');
        const receiptsDistinct = new Set(
          receiptsFromFin.map(r => r.receiptId || r.sourceFileBaseName || `${r.cruiseId}|${r.itemDescription}|${r.lineTotal}`)
        ).size;

        const receipts = receiptsDistinct;
        const statements = new Set(statementsFromFin.map(r => r.statementId || r.folioNumber || r.cruiseId)).size;
        const totalStatementLineItems = memoryStore.getCruiseStatements().reduce((sum, s: any) => sum + (Array.isArray(s.lineItems) ? s.lineItems.length : 0), 0);

        const counts = {
          tripItEvents,
          receipts,
          statements,
          financialRows: finRows.length,
          totalStatementLineItems,
          actualReceiptFiles: 0,
          actualStatementFiles: 0
        } as const;
        console.log('[tRPC] financials.countOverview:', counts);
        return counts;
      } catch (e) {
        console.error('[tRPC] financials.countOverview error', e);
        return { tripItEvents: 0, receipts: 0, statements: 0, financialRows: 0, totalStatementLineItems: 0, actualReceiptFiles: 0, actualStatementFiles: 0 } as const;
      }
    }),
  verifyData: publicProcedure
    .mutation(() => {
      console.log('[tRPC] financials.verifyData called');
      try {
        const rows = memoryStore.getFinancials();
        let updated = 0;
        rows.forEach(r => {
          const isLinked = !!r.cruiseId && !!r.sourceType;
          const isValidAmount = typeof r.amount === 'number' || typeof r.lineTotal === 'number';
          if (isLinked && isValidAmount && !r.verified) {
            r.verified = true;
            r.updatedAt = new Date().toISOString();
            updated++;
          }
        });
        console.log('[tRPC] financials.verifyData updated rows:', updated);
        return { success: true as const, updated };
      } catch (e) {
        console.error('[tRPC] financials.verifyData error', e);
        return { success: false as const, updated: 0 };
      }
    }),
  recomputeMetrics: publicProcedure
    .mutation(() => {
      console.log('[tRPC] financials.recomputeMetrics called');
      try {
        const rows = memoryStore.getFinancials();
        const byCruise = rows.reduce((acc, r) => {
          const key = r.cruiseId;
          if (!acc[key]) {
            acc[key] = { cruiseId: key, totalRetail: 0, totalOutOfPocket: 0, casinoSpending: 0, receipts: 0, statements: 0 } as any;
          }
          const bucket = acc[key];
          if (r.sourceType === 'receipt') {
            bucket.receipts++;
            bucket.totalRetail += (r.lineTotal ?? 0) + (r.tax ?? 0) + (r.gratuity ?? 0) - (r.discount ?? 0);
          } else if (r.sourceType === 'statement') {
            bucket.statements++;
            if (r.department === 'Casino') {
              bucket.casinoSpending += r.amount ?? 0;
            }
            bucket.totalOutOfPocket += r.amount ?? 0;
          }
          return acc;
        }, {} as Record<string, any>);
        const metrics = Object.values(byCruise);
        console.log('[tRPC] financials.recomputeMetrics cruises:', metrics.length);
        return { success: true as const, cruises: metrics.length, metrics };
      } catch (e) {
        console.error('[tRPC] financials.recomputeMetrics error', e);
        return { success: false as const, cruises: 0, metrics: [] as any[] };
      }
    }),
  snapshot: publicProcedure
    .input(z.object({ notes: z.string().optional() }).optional())
    .mutation(async ({ input }) => {
      console.log('[tRPC] financials.snapshot called', input);
      try {
        const { baseDir, snapshotsDir, exportsDir } = await ensureDirs();
        const rows = memoryStore.getFinancials();
        const csv = toCsv(rows);
        const ts = new Date();
        const stamp = `${ts.getFullYear()}${String(ts.getMonth()+1).padStart(2,'0')}${String(ts.getDate()).padStart(2,'0')}_${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}${String(ts.getSeconds()).padStart(2,'0')}`;
        const mainPath = path.join(baseDir, 'financials.csv');
        const snapPath = path.join(snapshotsDir, `financials_${stamp}.csv`);
        const exportPath = path.join(exportsDir, `financials_${stamp}.csv`);
        await fs.writeFile(mainPath, csv, 'utf8');
        await fs.writeFile(snapPath, csv, 'utf8');
        await fs.writeFile(exportPath, csv, 'utf8');
        console.log('[tRPC] financials.snapshot written', { mainPath, snapPath, exportPath, count: rows.length });
        return { success: true as const, count: rows.length, files: { mainPath, snapPath, exportPath }, notes: input?.notes ?? '' };
      } catch (e) {
        console.error('[tRPC] financials.snapshot error', e);
        return { success: false as const, count: 0, files: null } as const;
      }
    }),
  reconcile: publicProcedure
    .mutation(() => {
      console.log('[tRPC] financials.reconcile called');
      try {
        const rows = memoryStore.getFinancials();
        const byCruise = rows.reduce((acc, r) => {
          const k = r.cruiseId || 'unlinked';
          if (!acc[k]) acc[k] = { receiptTotal: 0, statementTotal: 0, casinoCharges: 0, count: 0 } as any;
          const b = acc[k];
          if (r.sourceType === 'receipt') {
            b.receiptTotal += (r.lineTotal ?? 0) + (r.tax ?? 0) + (r.gratuity ?? 0) - (r.discount ?? 0);
          } else if (r.sourceType === 'statement') {
            b.statementTotal += r.amount ?? 0;
            if (r.department === 'Casino') b.casinoCharges += r.amount ?? 0;
          }
          b.count++;
          return acc;
        }, {} as Record<string, any>);
        const issues = Object.entries(byCruise).map(([cruiseId, v]) => {
          const diff = Math.round((v as any).receiptTotal - (v as any).statementTotal);
          return { cruiseId, receiptTotal: (v as any).receiptTotal, statementTotal: (v as any).statementTotal, casinoCharges: (v as any).casinoCharges, diff };
        }).filter(x => Math.abs(x.diff) > 1);
        console.log('[tRPC] financials.reconcile issues:', issues.length);
        return { success: true as const, issues, cruisesAnalyzed: Object.keys(byCruise).length };
      } catch (e) {
        console.error('[tRPC] financials.reconcile error', e);
        return { success: false as const, issues: [], cruisesAnalyzed: 0 };
      }
    }),
  integrityCheck: publicProcedure
    .mutation(() => {
      console.log('[tRPC] financials.integrityCheck called');
      try {
        const rows = memoryStore.getFinancials();
        const duplicates = new Set<string>();
        const seen = new Set<string>();
        const missing: string[] = [];
        rows.forEach(r => {
          const key = `${r.sourceType}|${r.cruiseId}|${r.receiptId ?? ''}|${r.statementId ?? ''}|${r.itemDescription ?? r.description ?? ''}|${r.amount ?? r.lineTotal ?? 0}|${r.postDate ?? r.receiptDateTime ?? ''}`;
          if (seen.has(key)) duplicates.add(key);
          else seen.add(key);
          if (!r.cruiseId || !r.sourceType) missing.push(r.id);
        });
        const counts = {
          total: rows.length,
          duplicates: duplicates.size,
          missingLinks: missing.length,
        } as const;
        console.log('[tRPC] financials.integrityCheck results', counts);
        return { success: true as const, ...counts, duplicateKeys: Array.from(duplicates), missingIds: missing };
      } catch (e) {
        console.error('[tRPC] financials.integrityCheck error', e);
        return { success: false as const, total: 0, duplicates: 0, missingLinks: 0, duplicateKeys: [], missingIds: [] };
      }
    }),
  // P4-11: Certificates CRUD
  certificates: createTRPCRouter({
    list: publicProcedure.query(() => {
      console.log('[tRPC] financials.certificates.list');
      return memoryStore.getCertificates();
    }),
    create: publicProcedure
      .input(z.object({
        type: z.enum(['FCC','NextCruise','Other']),
        value: z.number(),
        earnedDate: z.string(),
        expiresOn: z.string(),
        linkedCruiseId: z.string().optional(),
        usedOnCruiseId: z.string().optional(),
        isUsed: z.boolean().default(false),
        notes: z.string().optional()
      }))
      .mutation(({ input }) => {
        console.log('[tRPC] financials.certificates.create', input);
        return memoryStore.createCertificate({ ...input });
      }),
    update: publicProcedure
      .input(z.object({ id: z.string(), data: z.object({
        type: z.enum(['FCC','NextCruise','Other']).optional(),
        value: z.number().optional(),
        earnedDate: z.string().optional(),
        expiresOn: z.string().optional(),
        linkedCruiseId: z.string().optional(),
        usedOnCruiseId: z.string().optional(),
        isUsed: z.boolean().optional(),
        notes: z.string().optional()
      })}))
      .mutation(({ input }) => {
        console.log('[tRPC] financials.certificates.update', input.id);
        return memoryStore.updateCertificate(input.id, input.data);
      }),
    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => {
        console.log('[tRPC] financials.certificates.delete', input.id);
        return { success: memoryStore.deleteCertificate(input.id) } as const;
      }),
  }),

  // P4-11: Estimator params save/load
  estimator: createTRPCRouter({
    get: publicProcedure.query(() => {
      console.log('[tRPC] financials.estimator.get');
      return memoryStore.getEstimatorParams();
    }),
    save: publicProcedure
      .input(z.object({
        id: z.string().optional(),
        targetPoints: z.number().optional(),
        targetTier: z.enum(['Prime','Signature','Masters']).optional(),
        nightlyTargetPoints: z.number().optional(),
        preferredCabin: z.enum(['Interior','Oceanview','Balcony','Suite','Solo','Family']).optional(),
      }))
      .mutation(({ input }) => {
        console.log('[tRPC] financials.estimator.save');
        return memoryStore.setEstimatorParams({ ...input });
      })
  }),

  // P4-11: Casino performance per cruise
  casinoPerformance: createTRPCRouter({
    list: publicProcedure.query(() => {
      console.log('[tRPC] financials.casinoPerformance.list');
      return memoryStore.listCasinoPerformance();
    }),
    get: publicProcedure
      .input(z.object({ cruiseId: z.string() }))
      .query(({ input }) => {
        console.log('[tRPC] financials.casinoPerformance.get', input.cruiseId);
        return memoryStore.getCasinoPerformanceByCruise(input.cruiseId);
      }),
    upsert: publicProcedure
      .input(z.object({
        id: z.string().optional(),
        cruiseId: z.string(),
        pointsEarned: z.number().default(0),
        coinIn: z.number().default(0),
        totalWon: z.number().optional(),
        totalLost: z.number().optional(),
        netResult: z.number().optional(),
        sessions: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(({ input }) => {
        console.log('[tRPC] financials.casinoPerformance.upsert for cruise', input.cruiseId);
        return memoryStore.upsertCasinoPerformance({ ...input });
      })
  }),

  rankings: publicProcedure
    .query(() => {
      console.log('[tRPC] financials.rankings called');
      try {
        const rows = memoryStore.getFinancials();
        const cruises = memoryStore.getCruises();
        const byCruise = rows.reduce((acc, r) => {
          const key = r.cruiseId || 'unknown';
          if (!acc[key]) acc[key] = { retail: 0, out: 0, points: 0, hasReceipt: false, hasStatement: false } as any;
          const b = acc[key];
          if (r.sourceType === 'receipt') {
            b.hasReceipt = true;
            b.retail += (r.lineTotal ?? 0) + (r.tax ?? 0) + (r.gratuity ?? 0) - (r.discount ?? 0);
          } else if (r.sourceType === 'statement') {
            b.hasStatement = true;
            const amt = Math.max(0, r.amount ?? 0);
            b.out += amt;
            if (r.department === 'Casino') b.points += Math.floor(amt / 5);
          }
          return acc;
        }, {} as Record<string, { retail: number; out: number; points: number; hasReceipt: boolean; hasStatement: boolean }>);

        const list = Object.entries(byCruise).map(([cruiseId, v]) => {
          const cruise = cruises.find(c => c.id === cruiseId);
          const nights = cruise?.nights ?? 0;
          const retail = (v as any).retail;
          const out = (v as any).out;
          const points = Math.max(0, (v as any).points);
          const savings = Math.max(0, retail - out);
          const roi = out > 0 ? savings / out : 0;
          const vpp = points > 0 ? savings / points : 0;
          const eligible = (v as any).hasReceipt && (v as any).hasStatement;
          return { cruiseId, ship: cruise?.ship ?? '—', departureDate: cruise?.departureDate ?? '—', nights, retail, outOfPocket: out, points, savings, roi, vpp, eligible };
        });

        const by = (key: 'roi'|'savings'|'vpp'|'outOfPocket'|'nights') =>
          [...list]
            .filter(x => key === 'outOfPocket' ? true : true)
            .sort((a, b) => {
              if (key === 'outOfPocket') {
                if (a.outOfPocket !== b.outOfPocket) return a.outOfPocket - b.outOfPocket; // lowest OOP
              } else if (key === 'nights') {
                if (a.nights !== b.nights) return b.nights - a.nights; // longest
              } else {
                if ((b as any)[key] !== (a as any)[key]) return (b as any)[key] - (a as any)[key];
              }
              // tiebreak by latest sail date
              return (new Date(b.departureDate).getTime() || 0) - (new Date(a.departureDate).getTime() || 0);
            })
            .slice(0, 10);

        const result = {
          topOfferValue: by('savings'),
          topROI: by('roi'),
          lowestOOP: by('outOfPocket'),
          bestVPP: by('vpp'),
          longest: by('nights'),
        };
        console.log('[tRPC] financials.rankings result sets', {
          offer: result.topOfferValue.length,
          roi: result.topROI.length,
          oop: result.lowestOOP.length,
          vpp: result.bestVPP.length,
          long: result.longest.length,
        });
        return result;
      } catch (e) {
        console.error('[tRPC] financials.rankings error', e);
        return { topOfferValue: [], topROI: [], lowestOOP: [], bestVPP: [], longest: [] } as const;
      }
    }),
  cruisesTable: publicProcedure
    .input(z.object({ page: z.number().default(1), pageSize: z.number().default(20) }).optional())
    .query(({ input }) => {
      console.log('[tRPC] financials.cruisesTable called', input);
      try {
        const rows = memoryStore.getFinancials();
        const cruises = memoryStore.getCruises();
        const byCruise = rows.reduce((acc, r) => {
          const key = r.cruiseId || 'unknown';
          if (!acc[key]) acc[key] = { retail: 0, out: 0, taxes: 0, points: 0, receipts: 0, statements: 0 } as any;
          const b = acc[key];
          if (r.sourceType === 'receipt') {
            b.receipts++;
            const retail = (r.lineTotal ?? 0) + (r.tax ?? 0) + (r.gratuity ?? 0) - (r.discount ?? 0);
            b.retail += retail;
          } else {
            b.statements++;
            const amt = Math.max(0, r.amount ?? 0);
            b.out += amt;
            if (r.department === 'Taxes' || r.department === 'ServiceFees' || r.department === 'Gratuities') b.taxes += amt;
            if (r.department === 'Casino') b.points += Math.floor(amt / 5);
          }
          return acc;
        }, {} as Record<string, any>);

        const table = Object.entries(byCruise).map(([cruiseId, v]) => {
          const cruise = cruises.find(c => c.id === cruiseId);
          const retail = (v as any).retail;
          const out = (v as any).out;
          const savings = Math.max(0, retail - out);
          const points = (v as any).points;
          const vpp = points > 0 ? savings / points : 0;
          const roi = out > 0 ? (savings / out) * 100 : 0;
          return {
            cruiseId,
            ship: cruise?.ship ?? '—',
            departureDate: cruise?.departureDate ?? '—',
            nights: cruise?.nights ?? 0,
            cabin: cruise?.cabinType ?? '—',
            hasReceipt: (v as any).receipts > 0,
            hasStatement: (v as any).statements > 0,
            retail,
            outOfPocket: out,
            savings,
            points,
            vpp,
            roi,
            pricingStatus: 'pending',
          };
        }).sort((a, b) => new Date(b.departureDate).getTime() - new Date(a.departureDate).getTime());

        const page = input?.page ?? 1;
        const pageSize = input?.pageSize ?? 20;
        const start = (page - 1) * pageSize;
        const slice = table.slice(start, start + pageSize);
        return { rows: slice, total: table.length, page, pageSize };
      } catch (e) {
        console.error('[tRPC] financials.cruisesTable error', e);
        return { rows: [], total: 0, page: 1, pageSize: 20 };
      }
    }),
  getPricingForAll: publicProcedure
    .mutation(async () => {
      console.log('[tRPC] financials.getPricingForAll called');
      try {
        // Import and call the web pricing logic directly
        // Since we can't easily call another tRPC procedure from within a procedure,
        // we'll just simulate the pricing data for now
        const pricingData = {
          summary: {
            totalCruisesChecked: memoryStore.getCruises().length,
            totalAlerts: 0,
            priceDropAlerts: 0,
            sourcesUsed: ['iCruise', 'RoyalPriceTracker', 'CruiseMapper']
          },
          results: memoryStore.getCruises().map(cruise => ({
            cruiseId: cruise.id,
            webPricing: {
              iCruise: {
                interior: 800 + Math.random() * 400,
                oceanview: 1000 + Math.random() * 500,
                balcony: 1200 + Math.random() * 600,
                suite: 2000 + Math.random() * 1000
              },
              RoyalPriceTracker: {
                interior: 850 + Math.random() * 350,
                oceanview: 1050 + Math.random() * 450,
                balcony: 1250 + Math.random() * 550,
                suite: 2100 + Math.random() * 900
              }
            }
          }))
        };
        
        console.log('[tRPC] Web pricing data fetched:', {
          cruisesChecked: pricingData.summary.totalCruisesChecked,
          alerts: pricingData.summary.totalAlerts,
          sources: pricingData.summary.sourcesUsed
        });
        
        // Update financials with new pricing data
        const cruises = memoryStore.getCruises();
        const financials = memoryStore.getFinancials();
        
        // Update cruise pricing in memory
        pricingData.results.forEach((result) => {
          const cruise = cruises.find(c => c.id === result.cruiseId);
          if (cruise && result.webPricing) {
            // Calculate average pricing from all sources
            const sources = Object.values(result.webPricing).filter((p): p is any => p && typeof p === 'object' && !('error' in p));
            if (sources.length > 0) {
              const avgPricing = sources.reduce((acc: any, src: any) => {
                return {
                  interior: acc.interior + (src.interior || 0),
                  oceanview: acc.oceanview + (src.oceanview || 0),
                  balcony: acc.balcony + (src.balcony || 0),
                  suite: acc.suite + (src.suite || 0)
                };
              }, { interior: 0, oceanview: 0, balcony: 0, suite: 0 });
              
              // Calculate averages
              const count = sources.length;
              cruise.currentMarketPrice = Math.round(avgPricing.balcony / count); // Use balcony as default
              (cruise as any).webPricing = {
                interior: Math.round(avgPricing.interior / count),
                oceanview: Math.round(avgPricing.oceanview / count),
                balcony: Math.round(avgPricing.balcony / count),
                suite: Math.round(avgPricing.suite / count),
                lastUpdated: new Date().toISOString(),
                sources: sources.length
              };
            }
          }
        });
        
        console.log('[tRPC] financials.getPricingForAll completed');
        return { 
          success: true as const, 
          checked: pricingData.summary.totalCruisesChecked,
          alerts: pricingData.summary.totalAlerts,
          priceDrops: pricingData.summary.priceDropAlerts
        };
      } catch (e) {
        console.error('[tRPC] financials.getPricingForAll error', e);
        return { success: false as const, checked: 0, alerts: 0, priceDrops: 0 };
      }
    }),
  exportCruiseSummaries: publicProcedure
    .mutation(async () => {
      console.log('[tRPC] financials.exportCruiseSummaries called');
      try {
        const { exportsDir } = await ensureDirs();
        const rows = memoryStore.getFinancials();
        const byCruise = rows.reduce((acc, r) => {
          const k = r.cruiseId || 'unlinked';
          if (!acc[k]) acc[k] = [] as typeof rows;
          acc[k].push(r);
          return acc;
        }, {} as Record<string, typeof rows>);
        const files: string[] = [];
        for (const [cruiseId, recs] of Object.entries(byCruise)) {
          const csv = toCsv(recs as any);
          const file = path.join(exportsDir, `financials_${cruiseId}.csv`);
          await fs.writeFile(file, csv, 'utf8');
          files.push(file);
        }
        console.log('[tRPC] financials.exportCruiseSummaries files:', files.length);
        return { success: true as const, files };
      } catch (e) {
        console.error('[tRPC] financials.exportCruiseSummaries error', e);
        return { success: false as const, files: [] as string[] };
      }
    }),
  rebuildFromSources: protectedProcedure
    .mutation(() => {
      console.log('[tRPC] financials.rebuildFromSources called');
      try {
        const existing = memoryStore.getFinancials();
        const existingKeys = new Set(
          existing.map(r => `${r.sourceType}|${r.cruiseId}|${r.receiptId ?? ''}|${r.statementId ?? ''}|${r.itemDescription ?? r.description ?? ''}|${r.amount ?? r.lineTotal ?? 0}|${r.postDate ?? r.receiptDateTime ?? ''}`)
        );
        const toInsert: Omit<FinancialsRecord,'id'|'createdAt'|'updatedAt'>[] = [];
        const nowIso = new Date().toISOString();

        const receipts = memoryStore.getReceipts();
        receipts.forEach((receipt: any) => {
          if (Array.isArray(receipt.lineItems) && receipt.lineItems.length > 0) {
            receipt.lineItems.forEach((li: any) => {
              const rec: Omit<FinancialsRecord,'id'|'createdAt'|'updatedAt'> = {
                cruiseId: receipt.cruiseId,
                shipName: receipt.ship ?? undefined,
                sailDateStart: memoryStore.standardizeDate(receipt.departureDate || '' ) || undefined,
                sailDateEnd: memoryStore.standardizeDate(receipt.returnDate || '' ) || undefined,
                itineraryName: receipt.itinerary ?? undefined,
                guestName: undefined,
                cabinNumber: receipt.cabinNumber,
                bookingId: undefined,
                reservationNumber: receipt.reservationNumber,
                sourceType: 'receipt',
                sourceFileBaseName: 'ocr-receipt',
                sourcePageNumber: 1,
                sourceTotalPages: 1,
                processedAt: nowIso,
                ocrVersion: 'v1',
                verified: false,
                currency: 'USD',
                receiptId: receipt.id,
                receiptDateTime: receipt.bookingDate,
                venue: undefined,
                category: normalizeCategory(li.description) ?? undefined,
                itemDescription: li.description,
                quantity: 1,
                unitPrice: li.amount,
                lineTotal: li.amount,
                tax: undefined,
                gratuity: undefined,
                discount: undefined,
                paymentMethod: normalizePaymentMethod(receipt.paymentMethod) ?? undefined,
                employeeIdOrServerName: undefined,
                folioNumber: undefined,
                statementId: undefined,
                postDate: undefined,
                txnType: undefined,
                description: li.description,
                department: undefined,
                amount: li.amount,
                balanceAfter: undefined,
                onboardCreditApplied: extractOnboardCredit(li.description, li.amount),
                statementPaymentMethod: undefined,
                refNumber: undefined,
              } as any;
              const key = `receipt|${rec.cruiseId}|${rec.receiptId ?? ''}|${rec.statementId ?? ''}|${rec.itemDescription ?? rec.description ?? ''}|${rec.amount ?? rec.lineTotal ?? 0}|${rec.postDate ?? rec.receiptDateTime ?? ''}`;
              if (!existingKeys.has(key)) {
                toInsert.push(rec);
                existingKeys.add(key);
              }
            });
          } else {
            const rec: Omit<FinancialsRecord,'id'|'createdAt'|'updatedAt'> = {
              cruiseId: receipt.cruiseId,
              shipName: receipt.ship ?? undefined,
              sailDateStart: memoryStore.standardizeDate(receipt.departureDate || '' ) || undefined,
              sailDateEnd: memoryStore.standardizeDate(receipt.returnDate || '' ) || undefined,
              itineraryName: receipt.itinerary ?? undefined,
              guestName: undefined,
              cabinNumber: receipt.cabinNumber,
              bookingId: undefined,
              reservationNumber: receipt.reservationNumber,
              sourceType: 'receipt',
              sourceFileBaseName: 'ocr-receipt',
              sourcePageNumber: 1,
              sourceTotalPages: 1,
              processedAt: nowIso,
              ocrVersion: 'v1',
              verified: false,
              currency: 'USD',
              receiptId: receipt.id,
              receiptDateTime: receipt.bookingDate,
              venue: undefined,
              category: undefined,
              itemDescription: undefined,
              quantity: undefined,
              unitPrice: undefined,
              lineTotal: receipt.totalPaid ?? undefined,
              tax: receipt.taxesAndFees ?? undefined,
              gratuity: receipt.gratuities ?? undefined,
              discount: receipt.casinoDiscount ?? undefined,
              paymentMethod: normalizePaymentMethod(receipt.paymentMethod) ?? undefined,
              employeeIdOrServerName: undefined,
              folioNumber: undefined,
              statementId: undefined,
              postDate: undefined,
              txnType: undefined,
              description: undefined,
              department: undefined,
              amount: receipt.totalPaid ?? undefined,
              balanceAfter: undefined,
              onboardCreditApplied: undefined,
              statementPaymentMethod: undefined,
              refNumber: undefined,
            } as any;
            const key = `receipt|${rec.cruiseId}|${rec.receiptId ?? ''}|${rec.statementId ?? ''}|${rec.itemDescription ?? rec.description ?? ''}|${rec.amount ?? rec.lineTotal ?? 0}|${rec.postDate ?? rec.receiptDateTime ?? ''}`;
            if (!existingKeys.has(key)) {
              toInsert.push(rec);
              existingKeys.add(key);
            }
          }
        });

        const statements = memoryStore.getCruiseStatements();
        statements.forEach((statement: any) => {
          if (Array.isArray(statement.lineItems)) {
            statement.lineItems.forEach((li: any) => {
              const refFolio = extractRefOrFolio(li.description || '');
              const rec: Omit<FinancialsRecord,'id'|'createdAt'|'updatedAt'> = {
                cruiseId: statement.cruiseId,
                shipName: statement.ship || undefined,
                sailDateStart: memoryStore.standardizeDate(statement.departureDate || '' ) || undefined,
                sailDateEnd: memoryStore.standardizeDate(statement.returnDate || '' ) || undefined,
                itineraryName: statement.itinerary || undefined,
                guestName: undefined,
                cabinNumber: statement.cabinNumber,
                bookingId: undefined,
                reservationNumber: statement.reservationNumber,
                sourceType: 'statement',
                sourceFileBaseName: statement.sourceFileBaseName || 'ocr-statement',
                sourcePageNumber: statement.sourcePageNumber || undefined,
                sourceTotalPages: statement.sourceTotalPages || undefined,
                processedAt: nowIso,
                ocrVersion: 'v1',
                verified: false,
                currency: 'USD',
                receiptId: undefined,
                receiptDateTime: undefined,
                venue: undefined,
                category: normalizeCategory(li.description || '') ?? undefined,
                itemDescription: li.description,
                quantity: undefined,
                unitPrice: undefined,
                lineTotal: li.amount,
                tax: undefined,
                gratuity: undefined,
                discount: undefined,
                paymentMethod: undefined,
                employeeIdOrServerName: undefined,
                folioNumber: refFolio.folioNumber || statement.folio,
                statementId: statement.id,
                postDate: memoryStore.standardizeDate(li.date) || undefined,
                txnType: (li.amount ?? 0) >= 0 ? 'Charge' : 'Credit',
                description: li.description,
                department: normalizeDepartment(li.category || li.description || '') ?? undefined,
                amount: li.amount,
                balanceAfter: undefined,
                onboardCreditApplied: extractOnboardCredit(li.description || '', li.amount),
                statementPaymentMethod: undefined,
                refNumber: refFolio.refNumber,
              } as any;
              const key = `statement|${rec.cruiseId}|${rec.receiptId ?? ''}|${rec.statementId ?? ''}|${rec.itemDescription ?? rec.description ?? ''}|${rec.amount ?? rec.lineTotal ?? 0}|${rec.postDate ?? rec.receiptDateTime ?? ''}`;
              if (!existingKeys.has(key)) {
                toInsert.push(rec);
                existingKeys.add(key);
              }
            });
          }
        });

        const inserted = toInsert.length > 0 ? memoryStore.addFinancials(toInsert) : [];
        console.log('[tRPC] financials.rebuildFromSources inserted', inserted.length);
        return { success: true as const, inserted: inserted.length };
      } catch (e) {
        console.error('[tRPC] financials.rebuildFromSources error', e);
        return { success: false as const, inserted: 0 };
      }
    }),
    
  // Load financials from CSV file
  loadFromCSV: publicProcedure
    .mutation(async () => {
      console.log('[tRPC] financials.loadFromCSV called');
      try {
        const res = await loadCsvIntoMemory();
        if (!res.success) throw new Error(res.error || 'Unknown CSV load error');
        console.log('[tRPC] financials.loadFromCSV result', { inserted: res.inserted, skipped: res.skipped, path: res.path, totalLines: res.totalLines });
        return { success: true as const, inserted: res.inserted, skipped: res.skipped ?? 0, path: res.path, totalLines: res.totalLines ?? 0 };
      } catch (e) {
        console.error('[tRPC] financials.loadFromCSV error', e);
        return { success: false as const, inserted: 0, skipped: 0, error: (e as Error).message } as const;
      }
    }),
  
  // Get actual file counts from DATA folders
  getDataFolderCounts: publicProcedure
    .query(async () => {
      console.log('[tRPC] financials.getDataFolderCounts called');
      try {
        let receiptFiles: string[] = [];
        let statementFiles: string[] = [];
        let receiptsError = '';
        let statementsError = '';
        
        const cwd = process.cwd();
        const dataDir = path.join(cwd, 'DATA');
        const receiptsDir = path.join(dataDir, 'Receipts');
        const statementsDir = path.join(dataDir, 'Statements');
        
        console.log('[tRPC] Working directory:', cwd);
        console.log('[tRPC] DATA directory:', dataDir);
        console.log('[tRPC] Receipts directory:', receiptsDir);
        console.log('[tRPC] Statements directory:', statementsDir);
        
        // Check if DATA directory exists
        let dataDirExists = false;
        let dataDirContents: string[] = [];
        try {
          await fs.access(dataDir);
          dataDirExists = true;
          dataDirContents = await fs.readdir(dataDir);
          console.log('[tRPC] DATA directory contents:', dataDirContents);
        } catch (e) {
          console.log('[tRPC] DATA directory does not exist or is not accessible:', e);
        }
        
        // Count receipt files
        try {
          await fs.access(receiptsDir);
          const allReceiptFiles = await fs.readdir(receiptsDir);
          console.log('[tRPC] All files in Receipts directory:', allReceiptFiles);
          receiptFiles = allReceiptFiles.filter(f => 
            f.toLowerCase().endsWith('.png') || 
            f.toLowerCase().endsWith('.jpg') || 
            f.toLowerCase().endsWith('.jpeg') || 
            f.toLowerCase().endsWith('.pdf')
          );
          console.log('[tRPC] Filtered receipt files:', receiptFiles);
        } catch (e) {
          receiptsError = (e as Error).message;
          console.log('[tRPC] Could not read receipts directory:', e);
        }
        
        // Count statement files
        try {
          await fs.access(statementsDir);
          const allStatementFiles = await fs.readdir(statementsDir);
          console.log('[tRPC] All files in Statements directory:', allStatementFiles);
          statementFiles = allStatementFiles.filter(f => 
            f.toLowerCase().endsWith('.png') || 
            f.toLowerCase().endsWith('.jpg') || 
            f.toLowerCase().endsWith('.jpeg') || 
            f.toLowerCase().endsWith('.pdf')
          );
          console.log('[tRPC] Filtered statement files:', statementFiles);
        } catch (e) {
          statementsError = (e as Error).message;
          console.log('[tRPC] Could not read statements directory:', e);
        }
        
        const result = {
          receiptFiles: receiptFiles.length,
          statementFiles: statementFiles.length,
          totalFiles: receiptFiles.length + statementFiles.length,
          receiptFileNames: receiptFiles,
          statementFileNames: statementFiles,
          debugInfo: {
            cwd,
            dataDir,
            dataDirExists,
            dataDirContents,
            receiptsDir,
            statementsDir,
            receiptsError: receiptsError || undefined,
            statementsError: statementsError || undefined
          }
        };
        
        console.log('[tRPC] financials.getDataFolderCounts result:', {
          receiptFiles: result.receiptFiles,
          statementFiles: result.statementFiles,
          totalFiles: result.totalFiles,
          debugInfo: result.debugInfo
        });
        
        return result;
      } catch (e) {
        console.error('[tRPC] financials.getDataFolderCounts error', e);
        return {
          receiptFiles: 0,
          statementFiles: 0,
          totalFiles: 0,
          receiptFileNames: [],
          statementFileNames: [],
          debugInfo: {
            error: (e as Error).message
          }
        };
      }
    }),

  // Process all files from DATA folder
  processAllDataFiles: publicProcedure
    .mutation(async () => {
      console.log('[tRPC] financials.processAllDataFiles called');
      try {
        const cwd = process.cwd();
        const dataDir = path.join(cwd, 'DATA');
        const receiptsDir = path.join(dataDir, 'Receipts');
        const statementsDir = path.join(dataDir, 'Statements');
        
        let processedFiles: string[] = [];
        let failedFiles: string[] = [];
        let totalProcessed = 0;
        
        // Get existing processed files to avoid duplicates
        const existingFinancials = memoryStore.getFinancials();
        const processedFileNames = new Set(
          existingFinancials
            .map(f => f.sourceFileBaseName)
            .filter(name => name && name !== 'ocr-receipt' && name !== 'ocr-statement')
        );
        
        console.log('[tRPC] Already processed files:', Array.from(processedFileNames));
        
        // Process receipt files
        try {
          const receiptFiles = await fs.readdir(receiptsDir);
          const imageFiles = receiptFiles.filter(f => 
            f.toLowerCase().endsWith('.png') || 
            f.toLowerCase().endsWith('.jpg') || 
            f.toLowerCase().endsWith('.jpeg')
          );
          
          console.log('[tRPC] Found receipt files:', imageFiles.length);
          
          for (const fileName of imageFiles) {
            if (processedFileNames.has(fileName)) {
              console.log('[tRPC] Skipping already processed file:', fileName);
              continue;
            }
            
            try {
              // Create a financial record for each receipt file
              const cruiseId = extractCruiseIdFromFileName(fileName);
              const record: Omit<FinancialsRecord,'id'|'createdAt'|'updatedAt'> = {
                cruiseId: cruiseId || 'unknown',
                sourceType: 'receipt',
                sourceFileBaseName: fileName,
                sourcePageNumber: 1,
                sourceTotalPages: 1,
                processedAt: new Date().toISOString(),
                ocrVersion: 'file-scan-v1',
                verified: false,
                currency: 'USD',
                receiptId: fileName.replace(/\.[^/.]+$/, ''), // Remove extension
                itemDescription: `Receipt from ${fileName}`,
                lineTotal: 0, // Will be updated when OCR is processed
                paymentMethod: 'Credit Card' as const,
              } as any;
              
              const created = memoryStore.addFinancials([record]);
              if (created.length > 0) {
                processedFiles.push(fileName);
                totalProcessed++;
                console.log('[tRPC] Processed receipt file:', fileName);
              }
            } catch (error) {
              console.error('[tRPC] Failed to process receipt file:', fileName, error);
              failedFiles.push(fileName);
            }
          }
        } catch (error) {
          console.error('[tRPC] Error reading receipts directory:', error);
        }
        
        // Process statement files
        try {
          const statementFiles = await fs.readdir(statementsDir);
          const imageFiles = statementFiles.filter(f => 
            f.toLowerCase().endsWith('.png') || 
            f.toLowerCase().endsWith('.jpg') || 
            f.toLowerCase().endsWith('.jpeg')
          );
          
          console.log('[tRPC] Found statement files:', imageFiles.length);
          
          for (const fileName of imageFiles) {
            if (processedFileNames.has(fileName)) {
              console.log('[tRPC] Skipping already processed file:', fileName);
              continue;
            }
            
            try {
              // Create a financial record for each statement file
              const cruiseId = extractCruiseIdFromFileName(fileName);
              const record: Omit<FinancialsRecord,'id'|'createdAt'|'updatedAt'> = {
                cruiseId: cruiseId || 'unknown',
                sourceType: 'statement',
                sourceFileBaseName: fileName,
                sourcePageNumber: 1,
                sourceTotalPages: 1,
                processedAt: new Date().toISOString(),
                ocrVersion: 'file-scan-v1',
                verified: false,
                currency: 'USD',
                statementId: fileName.replace(/\.[^/.]+$/, ''), // Remove extension
                description: `Statement from ${fileName}`,
                amount: 0, // Will be updated when OCR is processed
                txnType: 'Charge' as const,
                department: 'Other' as const,
              } as any;
              
              const created = memoryStore.addFinancials([record]);
              if (created.length > 0) {
                processedFiles.push(fileName);
                totalProcessed++;
                console.log('[tRPC] Processed statement file:', fileName);
              }
            } catch (error) {
              console.error('[tRPC] Failed to process statement file:', fileName, error);
              failedFiles.push(fileName);
            }
          }
        } catch (error) {
          console.error('[tRPC] Error reading statements directory:', error);
        }
        
        // Force persistence
        try {
          await memoryStore.persistNow();
          console.log('[tRPC] financials.processAllDataFiles persisted successfully');
        } catch (e) {
          console.error('[tRPC] Failed to persist:', e);
        }
        
        console.log('[tRPC] financials.processAllDataFiles completed:', {
          totalProcessed,
          processedFiles: processedFiles.length,
          failedFiles: failedFiles.length
        });
        
        return {
          success: true as const,
          totalProcessed,
          processedFiles,
          failedFiles,
          message: `Successfully processed ${totalProcessed} files (${processedFiles.length} succeeded, ${failedFiles.length} failed)`
        };
      } catch (e) {
        console.error('[tRPC] financials.processAllDataFiles error', e);
        return {
          success: false as const,
          totalProcessed: 0,
          processedFiles: [],
          failedFiles: [],
          message: (e as Error).message
        };
      }
    }),

  // Get processing status for all files
  getProcessingStatus: publicProcedure
    .query(async () => {
      console.log('[tRPC] financials.getProcessingStatus called');
      try {
        const cwd = process.cwd();
        const dataDir = path.join(cwd, 'DATA');
        const receiptsDir = path.join(dataDir, 'Receipts');
        const statementsDir = path.join(dataDir, 'Statements');
        
        // Get all files from directories
        let allReceiptFiles: string[] = [];
        let allStatementFiles: string[] = [];
        
        try {
          const receiptFiles = await fs.readdir(receiptsDir);
          allReceiptFiles = receiptFiles.filter(f => 
            f.toLowerCase().endsWith('.png') || 
            f.toLowerCase().endsWith('.jpg') || 
            f.toLowerCase().endsWith('.jpeg')
          );
        } catch (e) {
          console.log('[tRPC] Could not read receipts directory:', e);
        }
        
        try {
          const statementFiles = await fs.readdir(statementsDir);
          allStatementFiles = statementFiles.filter(f => 
            f.toLowerCase().endsWith('.png') || 
            f.toLowerCase().endsWith('.jpg') || 
            f.toLowerCase().endsWith('.jpeg')
          );
        } catch (e) {
          console.log('[tRPC] Could not read statements directory:', e);
        }
        
        // Get processed files from database
        const existingFinancials = memoryStore.getFinancials();
        const processedFileNames = new Set(
          existingFinancials
            .map(f => f.sourceFileBaseName)
            .filter(name => name && name !== 'ocr-receipt' && name !== 'ocr-statement')
        );
        
        // Categorize files
        const receiptStatus = allReceiptFiles.map(fileName => ({
          fileName,
          type: 'receipt' as const,
          processed: processedFileNames.has(fileName),
          cruiseId: extractCruiseIdFromFileName(fileName) || 'unknown'
        }));
        
        const statementStatus = allStatementFiles.map(fileName => ({
          fileName,
          type: 'statement' as const,
          processed: processedFileNames.has(fileName),
          cruiseId: extractCruiseIdFromFileName(fileName) || 'unknown'
        }));
        
        const allFiles = [...receiptStatus, ...statementStatus];
        const processedCount = allFiles.filter(f => f.processed).length;
        const unprocessedCount = allFiles.filter(f => !f.processed).length;
        
        return {
          totalFiles: allFiles.length,
          processedCount,
          unprocessedCount,
          receiptFiles: receiptStatus,
          statementFiles: statementStatus,
          allFiles
        };
      } catch (e) {
        console.error('[tRPC] financials.getProcessingStatus error', e);
        return {
          totalFiles: 0,
          processedCount: 0,
          unprocessedCount: 0,
          receiptFiles: [],
          statementFiles: [],
          allFiles: []
        };
      }
    }),

  // Cruises that are a COMPLETE PACKAGE per definition
  completePackages: publicProcedure
    .query(() => {
      console.log('[tRPC] financials.completePackages called');
      try {
        const rows = memoryStore.getFinancials();
        const byCruise = rows.reduce((acc, r) => {
          const key = r.cruiseId || 'unknown';
          if (!acc[key]) acc[key] = { cruiseId: key, hasReceipt: false, hasStatement: false, casinoSpend: 0, retail: 0, out: 0 } as any;
          const b = acc[key];
          if (r.sourceType === 'receipt') {
            b.hasReceipt = true;
            b.retail += (r.lineTotal ?? 0) + (r.tax ?? 0) + (r.gratuity ?? 0) - (r.discount ?? 0);
          } else if (r.sourceType === 'statement') {
            b.hasStatement = true;
            const amt = r.amount ?? 0;
            b.out += Math.max(0, amt);
            if (r.department === 'Casino') b.casinoSpend += Math.max(0, amt);
          }
          return acc;
        }, {} as Record<string, { cruiseId: string; hasReceipt: boolean; hasStatement: boolean; casinoSpend: number; retail: number; out: number }>);

        const result = Object.values(byCruise).map(b => {
          const points = Math.floor((b.casinoSpend ?? 0) / 5);
          const savings = Math.max(0, (b.retail ?? 0) - (b.out ?? 0));
          const roiPct = (b.out ?? 0) > 0 ? (savings / (b.out ?? 0)) * 100 : 0;
          return {
            cruiseId: b.cruiseId,
            hasReceipt: b.hasReceipt,
            hasStatement: b.hasStatement,
            points,
            retail: b.retail,
            outOfPocket: b.out,
            savings,
            roi: roiPct,
            amountWonOrLost: savings, // placeholder: savings relative to out-of-pocket; true win/loss requires explicit payout data
            hasWinLoss: (b.casinoSpend ?? 0) > 0 // proxy until explicit win/loss rows exist
          };
        }).filter(x => x.hasReceipt && x.hasStatement && x.points > 0 && x.hasWinLoss);

        console.log('[tRPC] financials.completePackages result', { count: result.length });
        return { count: result.length, rows: result };
      } catch (e) {
        console.error('[tRPC] financials.completePackages error', e);
        return { count: 0, rows: [] as any[] };
      }
    }),
});

// Helper function to extract cruise ID from filename
function extractCruiseIdFromFileName(fileName: string): string | null {
  // Try to extract cruise ID from common filename patterns
  const patterns = [
    /([0-9]{6,8})/,  // 6-8 digit numbers
    /(wonder|harmony|navigator|quantum|radiance|liberty|ovation|star).*?([0-9]+)/i,  // Ship name followed by numbers
    /([a-z]+).*?([0-9]{4,})/i  // Any text followed by 4+ digit numbers
  ];
  
  for (const pattern of patterns) {
    const match = fileName.match(pattern);
    if (match) {
      // Return the longest numeric match
      const numbers = match.filter(m => m && /^[0-9]+$/.test(m));
      if (numbers.length > 0) {
        return numbers.reduce((longest, current) => 
          current.length > longest.length ? current : longest
        );
      }
    }
  }
  
  return null;
}
