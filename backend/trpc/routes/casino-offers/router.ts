import { z } from 'zod';
import { publicProcedure, createTRPCRouter } from '../../create-context';
import { memoryStore } from '../_stores/memory';
import { calculateOfferValueProcedure } from './calculateOfferValue/route';
import { getOfferRankingsProcedure } from './getOfferRankings/route';
import { getOfferDetailsProcedure } from './getOfferDetails/route';

export const casinoOffersRouter = createTRPCRouter({
  list: publicProcedure.query(() => {
    console.log('[tRPC] Getting casino offers list');
    const allOffers = memoryStore.getCasinoOffers();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const norm = (v: unknown) => String(v ?? '').trim().toUpperCase();

    // Filter out expired offers first
    const activeOffers = allOffers.filter((offer) => {
      const rawExp = offer.expires as unknown as string;
      const expiryDate = new Date(rawExp);
      expiryDate.setHours(0, 0, 0, 0);
      const isActive = !Number.isNaN(expiryDate.getTime()) ? expiryDate >= today : true;
      if (!isActive) {
        console.log(`[tRPC] [FILTERED expired] ${offer.offerCode} expired on ${offer.expires}`);
      }
      return isActive;
    });

    // Deduplicate by offerCode (normalized). If multiple, keep the one with latest expiry
    const byCode = new Map<string, typeof activeOffers[number]>();
    for (const o of activeOffers) {
      const code = norm((o as any).offerCode);
      const key = code || `name:${norm((o as any).offerName)}|exp:${String((o as any).expires ?? '')}`;
      if (!byCode.has(key)) {
        byCode.set(key, o);
      } else {
        const prev = byCode.get(key)!;
        const prevExp = new Date(String((prev as any).expires ?? ''));
        const curExp = new Date(String((o as any).expires ?? ''));
        if (!Number.isNaN(curExp.getTime()) && (Number.isNaN(prevExp.getTime()) || curExp > prevExp)) {
          byCode.set(key, o);
        }
      }
    }

    const unique = Array.from(byCode.values());

    console.log(`[tRPC] Active unique offers: ${unique.length} (was ${allOffers.length} total, ${activeOffers.length} active)`);
    unique.forEach((offer, idx) => {
      console.log(`  ${idx + 1}. ${offer.offerCode} - ${offer.offerName} - expires: ${offer.expires}`);
    });

    return unique;
  }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      console.log('[tRPC] Getting casino offer:', input.id);
      const offer = memoryStore.getCasinoOffer(input.id);
      if (!offer) {
        throw new Error('Casino offer not found');
      }
      return offer;
    }),

  create: publicProcedure
    .input(z.object({
      name: z.string(),
      rewardNumber: z.string(),
      offerName: z.string(),
      offerType: z.string(),
      expires: z.string(),
      offerCode: z.string(),
      tradeInValue: z.string(),
    }))
    .mutation(({ input }) => {
      console.log('[tRPC] Creating casino offer:', input.offerName);
      return memoryStore.createCasinoOffer(input);
    }),

  replaceAll: publicProcedure
    .input(z.object({
      offers: z.array(z.object({
        name: z.string(),
        rewardNumber: z.string(),
        offerName: z.string(),
        offerType: z.string(),
        expires: z.string(),
        offerCode: z.string(),
        tradeInValue: z.string(),
      }))
    }))
    .mutation(({ input }) => {
      console.log('[tRPC] Replacing all casino offers with provided list:', input.offers.length);
      const snapshotId = memoryStore.createDataSnapshot('Before replacing casino offers', 'manual-fix');
      try {
        memoryStore.clearCasinoOffers();
        const created = memoryStore.bulkCreateCasinoOffers(input.offers);
        console.log('[tRPC] Replaced casino offers. Created count:', created.length, 'snapshot:', snapshotId);
        return { success: true, created: created.length, snapshotId };
      } catch (error) {
        console.error('[tRPC] Failed to replace casino offers. Rolling back.', error);
        const rollback = memoryStore.rollbackToSnapshot(snapshotId);
        return { success: false, error: error instanceof Error ? error.message : String(error), rollback };
      }
    }),

  validateCodes: publicProcedure.query(() => {
    console.log('[tRPC] Validating casino offer codes');
    const offers = memoryStore.getCasinoOffers();
    const offerCodeRegex = /^\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d{3}$/;
    
    const validationResults = offers.map(offer => ({
      id: offer.id,
      offerCode: offer.offerCode,
      isValid: offerCodeRegex.test(offer.offerCode),
      error: offerCodeRegex.test(offer.offerCode) ? null : 'Invalid offer code format'
    }));

    return {
      total: offers.length,
      valid: validationResults.filter(r => r.isValid).length,
      invalid: validationResults.filter(r => !r.isValid).length,
      results: validationResults
    };
  }),

  getOfferAnalysis: publicProcedure.query(() => {
    console.log('[tRPC] Getting detailed offer analysis');
    return memoryStore.getOfferAnalysis();
  }),

  getLinkedCruiseCounts: publicProcedure.query(() => {
    console.log('[tRPC] Getting linked cruise counts per offer');
    return memoryStore.getLinkedCruiseCounts();
  }),

  calculateOfferValue: calculateOfferValueProcedure,
  getOfferRankings: getOfferRankingsProcedure,
  getOfferDetails: getOfferDetailsProcedure,
});