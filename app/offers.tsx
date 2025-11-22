import React from 'react';
import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { TicketPercent } from 'lucide-react-native';
import { useAppState } from '@/state/AppStateProvider';
import { OfferCard } from '@/components/OfferCard';
import { mapFromOffer, detectAndMapUnified } from '@/lib/unifiedCruise';
import { getCertificateByCode } from '@/types/models';
import type { UnifiedCruise } from '@/types/models';
import { STATIC_OFFERS } from '@/constants/offers';
import { matchCruisesToOffer } from '@/lib/offerMatching';
import { HeroHeaderCompact } from '@/components/HeroHeaderCompact';

interface OfferListItem {
  id: string;
  offerName: string;
  offerCode: string;
  expires?: string | Date;
  cruisesCount: number;
  associatedCruises: UnifiedCruise[];
  tradeInValue?: number | string;
  perks?: string[];
}

export default function OffersScreen() {
  const insets = useSafeAreaInsets();
  const { hasLocalData, localData } = useAppState();

  const items = React.useMemo<OfferListItem[]>(() => {
    try {
      if (!localData?.offers && !STATIC_OFFERS) return [];

      const sourceOffers = (Array.isArray(localData.offers) && localData.offers.length > 0) ? (localData.offers as any[]) : (STATIC_OFFERS as any[]);
      const cruisesArr = Array.isArray(localData.cruises) ? (localData.cruises as any[]) : [];

      const normalizeCode = (raw: unknown) => String(raw ?? '').trim().toUpperCase();
      const normalizeName = (raw: unknown) => String(raw ?? '').trim();

      // 1) Filter out expired offers
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const activeOffers = sourceOffers.filter((o: any) => {
        const exp = o?.expires || o?.EXPIRES || o?.Expires || o?.['Expiration Date'] || o?.offerExpireDate;
        if (!exp) return true;
        const d = new Date(String(exp));
        if (Number.isNaN(d.getTime())) return true;
        d.setHours(0, 0, 0, 0);
        return d.getTime() >= today.getTime();
      });

      // 2) Deduplicate by Offer Code, fallback to Name+Expires
      const byKey = new Map<string, any>();
      for (const o of activeOffers) {
        const code = normalizeCode(o?.offerCode || o?.['OFFER CODE'] || o?.['Offer Code'] || o?.Code || '');
        const name = normalizeName(o?.offerName || o?.['OFFER NAME'] || o?.['Offer Name'] || o?.Name || '');
        const exp = String(o?.expires || o?.EXPIRES || o?.Expires || o?.['Expiration Date'] || '');
        const key = code ? `code:${code}` : `name:${name}|exp:${exp}`;
        if (!byKey.has(key)) {
          byKey.set(key, o);
        } else {
          const prev = byKey.get(key);
          const prevExp = new Date(String(prev?.expires || prev?.EXPIRES || prev?.Expires || prev?.['Expiration Date'] || ''));
          const curExp = new Date(exp);
          if (!Number.isNaN(curExp.getTime()) && (Number.isNaN(prevExp.getTime()) || curExp > prevExp)) {
            byKey.set(key, o);
          }
        }
      }
      const offersArr = Array.from(byKey.values());

      // 3) Prepare cruises
      const unifiedCruises = cruisesArr.map((c) => detectAndMapUnified(c) as UnifiedCruise);

      // 4) Build list with date/ship matching
      return offersArr.map((o: any, idx: number) => {
        const unifiedOffer = mapFromOffer(o);
        const id = String(unifiedOffer.id ?? `offer-${idx}`);
        const offerNameRaw = unifiedOffer.offerName ?? o?.title ?? 'Unknown Offer';
        const offerCodeRaw = unifiedOffer.offerCode ?? o?.code ?? '';
        const offerName = normalizeName(offerNameRaw);
        const offerCode = normalizeCode(offerCodeRaw);
        const expires = unifiedOffer.offerExpireDate ?? o?.expires ?? undefined;

        const matched = matchCruisesToOffer(unifiedCruises as any[], {
          ships: Array.isArray((o as any).ships) ? (o as any).ships : undefined,
          offerStartDate: (o as any).offerStartDate || (o as any)['Offer Start Date'] || undefined,
          offerEndDate: (o as any).offerEndDate || (o as any)['Offer End Date'] || (o as any).expires || undefined,
          sailingDates: Array.isArray((o as any).sailingDates) ? (o as any).sailingDates : undefined,
          expires: (o as any).expires || (o as any)['EXPIRES'] || (o as any)['Expires'] || (o as any)['Expiration Date'] || undefined,
        } as any) as UnifiedCruise[];

        const tradeInValue: number | string | undefined = ((): number | string | undefined => {
          const t = o?.tradeInValue ?? o?.TradeInValue ?? o?.tradeIn ?? unifiedOffer?.value ?? undefined;
          return t;
        })();

        const perks: string[] | undefined = ((): string[] | undefined => {
          if (Array.isArray(o?.perks)) return o.perks as string[];
          const entry = getCertificateByCode(offerCode);
          const derived: string[] = [];
          if (entry?.reward) derived.push(entry.reward);
          if (entry?.nextCruiseBonus) derived.push(entry.nextCruiseBonus);
          return derived.length > 0 ? derived : undefined;
        })();

        return {
          id,
          offerName: String(offerName),
          offerCode: String(offerCode),
          expires: expires ?? undefined,
          cruisesCount: matched.length,
          associatedCruises: matched,
          tradeInValue,
          perks,
        } as OfferListItem;
      });
    } catch (e) {
      console.warn('[OffersScreen] items computation failed', e);
      return [];
    }
  }, [hasLocalData, localData]);

  if (!hasLocalData) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#6C5CE7" />
        <Text style={styles.loadingText}>Loading local data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={{ height: insets.top, backgroundColor: '#FFFFFF' }} testID="safe-top-spacer" />
      <HeroHeaderCompact totalCruises={items.length} />
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} testID="offers-screen">
      <Text style={styles.title}>Casino Offers</Text>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <TicketPercent size={48} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No offers loaded</Text>
          <Text style={styles.emptySubtitle}>Import offers from OCR or Settings to get started</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {items.map((it) => (
            <OfferCard
              key={it.id}
              id={it.id}
              offerName={it.offerName}
              offerCode={it.offerCode}
              expires={it.expires}
              cruisesCount={it.cruisesCount}
              associatedCruises={it.associatedCruises}
              tradeInValue={it.tradeInValue}
              perks={it.perks}
              onPress={() => router.push({ pathname: '/offer/[id]', params: { id: it.id, offerCode: it.offerCode, offerName: it.offerName } })}
              testID={`offer-item-${it.id}`}
            />
          ))}
        </View>
      )}
      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6B7280' },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12, textAlign: 'center' },
  list: { gap: 12 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827', marginRight: 8 },
  rowMid: { marginTop: 4 },
  code: { fontSize: 12, fontWeight: '600', color: '#4B5563' },
  rowBottom: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  expires: { fontSize: 12, color: '#6B7280' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9999, borderWidth: 1 },
  badgeActive: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  badgeEmpty: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextActive: { color: '#065F46' },
  badgeTextEmpty: { color: '#6B7280' },
  empty: { padding: 32, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#6B7280' },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF' },
  notice: { marginLeft: 8, fontSize: 12, color: '#EF4444', fontWeight: '600' },
});