import { createTRPCRouter, publicProcedure } from "../../create-context";
import { z } from "zod";

type FveLink = {
  cruise_id: string;
  ship?: string;
  itinerary?: string;
  nights?: number;
  seasonality?: string;
  shipClass?: string;
  points_earned: number;
  coin_in_usd: number;
  selected_cert_code?: string;
  selected_path?: 'A' | 'C';
  level?: string;
  instant_value_min_usd?: number;
  instant_value_max_usd?: number;
  instant_value_final_usd?: number;
  nextcruise_bonus_id?: string;
  nextcruise_value_usd?: number;
  fve_total_usd?: number;
  roi_vs_coinin?: number;
  override_reason?: string;
  updated_at: string;
  created_at: string;
};

type FveCertCatalogRow = {
  id: string;
  codePattern: string; // e.g., "2411(A|C)(VIP2|01-08)"
  path: 'A' | 'C';
  level: string; // VIP2 or 01-08
  minPoints: number;
  notes?: string;
  overrides?: { nights?: number; cabin?: string; min?: number; max?: number };
  updated_at: string;
  created_at: string;
};

type FveNextCruiseBonusRow = {
  id: string;
  min_points: number;
  free_play_usd?: number;
  credits_usd?: number;
  note?: string;
  updated_at: string;
  created_at: string;
};

type FvePricingModelRow = {
  id: string;
  shipClass: string;
  itineraryBucket: string;
  seasonality: string;
  nights: number;
  cabin: string;
  totalCabinPriceUsd: number;
  updated_at: string;
  created_at: string;
};

const nowIso = () => new Date().toISOString();

const store = {
  links: new Map<string, FveLink>(),
  catalog: new Map<string, FveCertCatalogRow>(),
  bonuses: new Map<string, FveNextCruiseBonusRow>(),
  pricing: new Map<string, FvePricingModelRow>(),
  seeded: false as boolean,
};

const linkInput = z.object({
  cruiseId: z.string(),
  ship: z.string().optional(),
  itinerary: z.string().optional(),
  nights: z.number().int().nonnegative().optional(),
  seasonality: z.string().optional(),
  shipClass: z.string().optional(),
  pointsEarned: z.number().int().nonnegative(),
});

function toCsvValue(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function seedIfNeeded() {
  if (store.seeded) return { ok: true, alreadySeeded: true } as const;
  try {
    const ts = nowIso();
    const ensure = <T extends { id: string }>(map: Map<string, T>, row: T) => {
      if (!map.has(row.id)) map.set(row.id, row);
    };

    // Seed Catalog examples (08, 03, VIP2)
    ensure(store.catalog, {
      id: 'cat_08_A',
      codePattern: 'YYMM(A)08',
      path: 'A',
      level: '08',
      minPoints: 800,
      notes: 'Baseline 7N balcony ≈ $5,000',
      overrides: { nights: 7, cabin: 'Balcony', min: 4500, max: 5500 },
      created_at: ts,
      updated_at: ts,
    });
    ensure(store.catalog, {
      id: 'cat_08_C',
      codePattern: 'YYMM(C)08',
      path: 'C',
      level: '08',
      minPoints: 800,
      notes: 'Path C variant',
      overrides: { nights: 7, cabin: 'Balcony', min: 4000, max: 5200 },
      created_at: ts,
      updated_at: ts,
    });
    ensure(store.catalog, {
      id: 'cat_03_A',
      codePattern: 'YYMM(A)03',
      path: 'A',
      level: '03',
      minPoints: 6500,
      notes: 'Balcony up to 16N, any ship/time',
      overrides: { nights: 16, cabin: 'Balcony', min: 9000, max: 14000 },
      created_at: ts,
      updated_at: ts,
    });
    ensure(store.catalog, {
      id: 'cat_VIP2_A',
      codePattern: 'YYMM(A)VIP2',
      path: 'A',
      level: 'VIP2',
      minPoints: 2500,
      notes: 'VIP2 perks baseline',
      created_at: ts,
      updated_at: ts,
    });

    // Seed NextCruise chart rows
    const bonusRows: Array<Omit<FveNextCruiseBonusRow, 'created_at'|'updated_at'>> = [
      { id: 'bonus_25000', min_points: 25000, free_play_usd: 2000, credits_usd: 0, note: 'GS + $2,000 FP' },
      { id: 'bonus_15000', min_points: 15000, free_play_usd: 1500, credits_usd: 0, note: 'JS + $1,500 FP' },
      { id: 'bonus_8000',  min_points: 8000,  free_play_usd: 1000, credits_usd: 0, note: 'JS + $1,000 FP' },
      { id: 'bonus_6500',  min_points: 6500,  free_play_usd: 750,  credits_usd: 0, note: 'Balcony + $750 FP' },
      { id: 'bonus_4800',  min_points: 4800,  free_play_usd: 500,  credits_usd: 0, note: '$500 FP' },
      { id: 'bonus_3600',  min_points: 3600,  free_play_usd: 150,  credits_usd: 0, note: 'OV + $150 FP + upgrade note' },
      { id: 'bonus_2500',  min_points: 2500,  free_play_usd: 150,  credits_usd: 0, note: 'Interior + $150 FP + upgrade note' },
      { id: 'bonus_2000',  min_points: 2000,  free_play_usd: 0,    credits_usd: 500, note: '$500 off / complimentary interior (select dates)' },
      { id: 'bonus_1600',  min_points: 1600,  free_play_usd: 0,    credits_usd: 400, note: '$400 off' },
      { id: 'bonus_1200',  min_points: 1200,  free_play_usd: 0,    credits_usd: 300, note: '$300 off' },
      { id: 'bonus_800',   min_points: 800,   free_play_usd: 0,    credits_usd: 200, note: '$200 off' },
      { id: 'bonus_400',   min_points: 400,   free_play_usd: 0,    credits_usd: 100, note: '$100 off / comp interior via $200 NC purchase' },
    ];
    bonusRows.forEach(b => ensure(store.bonuses, { ...b, created_at: ts, updated_at: ts }));

    // Minimal pricing seed for fallback modeling
    const pricingSeeds: Array<FvePricingModelRow> = [
      { id: 'p_oa_7_bal_low', shipClass: 'Oasis', itineraryBucket: 'Caribbean', seasonality: 'Low', nights: 7, cabin: 'Balcony', totalCabinPriceUsd: 5000, created_at: ts, updated_at: ts },
      { id: 'p_oa_16_bal_any', shipClass: 'Oasis', itineraryBucket: 'Any', seasonality: 'Any', nights: 16, cabin: 'Balcony', totalCabinPriceUsd: 12000, created_at: ts, updated_at: ts },
    ];
    pricingSeeds.forEach(p => ensure(store.pricing, p));

    store.seeded = true;
    return { ok: true, alreadySeeded: false } as const;
  } catch (e) {
    console.error('[FVE] Seed failed', e);
    return { ok: false, alreadySeeded: false } as const;
  }
}

export const fveRouter = createTRPCRouter({
  seed: publicProcedure
    .mutation(() => {
      const res = seedIfNeeded();
      return res;
    }),

  resolveByPoints: publicProcedure
    .input(z.object({ pointsEarned: z.number().int().nonnegative() }))
    .query(({ input }) => {
      seedIfNeeded();
      const pts = input.pointsEarned;
      const catalogRows = Array.from(store.catalog.values());
      if (catalogRows.length === 0) {
        return {
          suggested: null,
          options: [],
          bonus: null
        } as const;
      }

      const byPath = { A: [] as typeof catalogRows, C: [] as typeof catalogRows };
      catalogRows.forEach(r => {
        if (r.path === 'A') byPath.A.push(r);
        else if (r.path === 'C') byPath.C.push(r);
      });

      const bestFor = (path: 'A' | 'C') => {
        const rows = byPath[path].filter(r => r.minPoints <= pts);
        if (rows.length === 0) return null as typeof catalogRows[number] | null;
        return rows.sort((a, b) => b.minPoints - a.minPoints)[0];
      };

      const bestA = bestFor('A');
      const bestC = bestFor('C');
      const options = [bestA, bestC].filter(Boolean).map(r => ({
        path: r!.path,
        level: r!.level,
        minPoints: r!.minPoints,
        overrides: r!.overrides ?? null,
        notes: r!.notes ?? null,
      }));

      let suggested = null as null | {
        path: 'A' | 'C';
        level: string;
        codeSuggestion: string;
        instantMin?: number;
        instantMax?: number;
      };
      const pick = (bestA && bestC) ? (bestA.minPoints >= bestC.minPoints ? bestA : bestC) : (bestA || bestC);
      if (pick) {
        suggested = {
          path: pick.path,
          level: pick.level,
          codeSuggestion: `YYMM(${pick.path})${pick.level}`,
          instantMin: pick.overrides?.min,
          instantMax: pick.overrides?.max,
        };
      }

      const bonusRows = Array.from(store.bonuses.values()).sort((a, b) => b.min_points - a.min_points);
      const matchedBonus = bonusRows.find(b => pts >= b.min_points) ?? null;
      const bonus = matchedBonus ? {
        id: matchedBonus.id,
        min_points: matchedBonus.min_points,
        value: (matchedBonus.free_play_usd ?? 0) + (matchedBonus.credits_usd ?? 0),
        free_play_usd: matchedBonus.free_play_usd ?? 0,
        credits_usd: matchedBonus.credits_usd ?? 0,
        note: matchedBonus.note ?? null,
      } : null;

      return { suggested, options, bonus } as const;
    }),

  linkCruise: publicProcedure
    .input(linkInput)
    .mutation(({ input }) => {
      const coinIn = input.pointsEarned * 5;
      const id = input.cruiseId;
      const existing = store.links.get(id);
      const row: FveLink = {
        cruise_id: id,
        ship: input.ship ?? existing?.ship,
        itinerary: input.itinerary ?? existing?.itinerary,
        nights: input.nights ?? existing?.nights,
        seasonality: input.seasonality ?? existing?.seasonality,
        shipClass: input.shipClass ?? existing?.shipClass,
        points_earned: input.pointsEarned,
        coin_in_usd: coinIn,
        selected_cert_code: existing?.selected_cert_code,
        selected_path: existing?.selected_path,
        level: existing?.level,
        instant_value_min_usd: existing?.instant_value_min_usd,
        instant_value_max_usd: existing?.instant_value_max_usd,
        instant_value_final_usd: existing?.instant_value_final_usd,
        nextcruise_bonus_id: existing?.nextcruise_bonus_id,
        nextcruise_value_usd: existing?.nextcruise_value_usd,
        fve_total_usd: existing?.fve_total_usd ?? (existing?.instant_value_final_usd ?? 0) + (existing?.nextcruise_value_usd ?? 0),
        roi_vs_coinin: existing?.roi_vs_coinin ?? (coinIn > 0 ? (((existing?.instant_value_final_usd ?? 0) + (existing?.nextcruise_value_usd ?? 0)) / coinIn) : 0),
        override_reason: existing?.override_reason,
        created_at: existing?.created_at ?? nowIso(),
        updated_at: nowIso(),
      };
      store.links.set(id, row);
      return { ok: true, link: row };
    }),

  getLink: publicProcedure
    .input(z.object({ cruiseId: z.string() }))
    .query(({ input }) => {
      return store.links.get(input.cruiseId) ?? null;
    }),

  saveEvaluation: publicProcedure
    .input(z.object({
      cruiseId: z.string(),
      data: z.object({
        selected_cert_code: z.string().optional(),
        selected_path: z.enum(['A', 'C']).optional(),
        level: z.string().optional(),
        instant_value_min_usd: z.number().nonnegative().optional(),
        instant_value_max_usd: z.number().nonnegative().optional(),
        instant_value_final_usd: z.number().nonnegative().optional(),
        nextcruise_bonus_id: z.string().optional(),
        nextcruise_value_usd: z.number().nonnegative().optional(),
        override_reason: z.string().optional(),
      })
    }))
    .mutation(({ input }) => {
      seedIfNeeded();
      const existing = store.links.get(input.cruiseId);
      const ts = nowIso();
      const base: FveLink = existing ?? {
        cruise_id: input.cruiseId,
        points_earned: 0,
        coin_in_usd: 0,
        created_at: ts,
        updated_at: ts,
      };
      const updated: FveLink = {
        ...base,
        ...input.data,
        fve_total_usd: (input.data.instant_value_final_usd ?? base.instant_value_final_usd ?? 0) + (input.data.nextcruise_value_usd ?? base.nextcruise_value_usd ?? 0),
        roi_vs_coinin: (() => {
          const coin = base.coin_in_usd;
          const total = ((input.data.instant_value_final_usd ?? base.instant_value_final_usd ?? 0) + (input.data.nextcruise_value_usd ?? base.nextcruise_value_usd ?? 0));
          return coin > 0 ? total / coin : 0;
        })(),
        updated_at: nowIso(),
      };
      store.links.set(input.cruiseId, updated);
      return { ok: true, link: updated };
    }),

  exportCsv: publicProcedure
    .input(z.object({ cruiseId: z.string() }))
    .query(({ input }) => {
      seedIfNeeded();
      const row = store.links.get(input.cruiseId);
      if (!row) {
        return { filename: `fve_${input.cruiseId}.csv`, csv: 'cruise_id\n' + input.cruiseId };
      }
      const headers = [
        'cruise_id','ship','itinerary','nights','seasonality','shipClass','points_earned','coin_in_usd','selected_cert_code','selected_path','level','instant_value_min_usd','instant_value_max_usd','instant_value_final_usd','nextcruise_bonus_id','nextcruise_value_usd','fve_total_usd','roi_vs_coinin','override_reason','updated_at','created_at'
      ];
      const values = headers.map((h) => toCsvValue((row as any)[h]));
      const csv = headers.join(',') + '\n' + values.join(',');
      return { filename: `fve_${input.cruiseId}.csv`, csv };
    }),

  listCatalog: publicProcedure.query(() => {
    seedIfNeeded();
    return Array.from(store.catalog.values());
  }),
  upsertCatalog: publicProcedure
    .input(z.object({
      id: z.string().optional(),
      codePattern: z.string(),
      path: z.enum(['A', 'C']),
      level: z.string(),
      minPoints: z.number().int().nonnegative(),
      notes: z.string().optional(),
      overrides: z.object({ nights: z.number().optional(), cabin: z.string().optional(), min: z.number().optional(), max: z.number().optional() }).optional(),
    }))
    .mutation(({ input }) => {
      const id = input.id ?? `cat_${Date.now()}`;
      const existing = store.catalog.get(id);
      const row: FveCertCatalogRow = {
        id,
        codePattern: input.codePattern,
        path: input.path,
        level: input.level,
        minPoints: input.minPoints,
        notes: input.notes,
        overrides: input.overrides,
        created_at: existing?.created_at ?? nowIso(),
        updated_at: nowIso(),
      };
      store.catalog.set(id, row);
      return { ok: true, row };
    }),

  listBonuses: publicProcedure.query(() => {
    seedIfNeeded();
    return Array.from(store.bonuses.values());
  }),
  upsertBonus: publicProcedure
    .input(z.object({
      id: z.string().optional(),
      min_points: z.number().int().nonnegative(),
      free_play_usd: z.number().nonnegative().optional(),
      credits_usd: z.number().nonnegative().optional(),
      note: z.string().optional(),
    }))
    .mutation(({ input }) => {
      const id = input.id ?? `bonus_${Date.now()}`;
      const existing = store.bonuses.get(id);
      const row: FveNextCruiseBonusRow = {
        id,
        min_points: input.min_points,
        free_play_usd: input.free_play_usd,
        credits_usd: input.credits_usd,
        note: input.note,
        created_at: existing?.created_at ?? nowIso(),
        updated_at: nowIso(),
      };
      store.bonuses.set(id, row);
      return { ok: true, row };
    }),

  listPricing: publicProcedure.query(() => {
    seedIfNeeded();
    return Array.from(store.pricing.values());
  }),
  upsertPricing: publicProcedure
    .input(z.object({
      id: z.string().optional(),
      shipClass: z.string(),
      itineraryBucket: z.string(),
      seasonality: z.string(),
      nights: z.number().int().positive(),
      cabin: z.string(),
      totalCabinPriceUsd: z.number().nonnegative(),
    }))
    .mutation(({ input }) => {
      const id = input.id ?? `price_${Date.now()}`;
      const existing = store.pricing.get(id);
      const row: FvePricingModelRow = {
        id,
        shipClass: input.shipClass,
        itineraryBucket: input.itineraryBucket,
        seasonality: input.seasonality,
        nights: input.nights,
        cabin: input.cabin,
        totalCabinPriceUsd: input.totalCabinPriceUsd,
        created_at: existing?.created_at ?? nowIso(),
        updated_at: nowIso(),
      };
      store.pricing.set(id, row);
      return { ok: true, row };
    }),
});
