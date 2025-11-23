# PLAN Q: Offer Value Analytics Implementation

## PHASE 1: Backend Analytics Engine (Calculate Comp Values)

**Goal:** Build backend logic to calculate offer values based on cabin pricing and coverage rules

### Step 1.1: Create Offer Value Calculator
- Create `backend/trpc/routes/analytics/offer-value/route.ts`
- Implement cabin category normalization (Interior, Oceanview, Balcony, Suite)
- Build coverage fraction calculator (comped_shares / 2)
- Calculate base cabin price for two guests (2 × per_person_price)
- Compute Comp_Value (base_cabin_price_for_two × coverage_fraction)
- Special logic for Offer 2511A06 (1.5 shares = 75% coverage)

### Step 1.2: Create Offer Ranking Engine
- Group offers by Offer Code
- Calculate per offer:
  - num_sailings (count of applicable cruises)
  - total_comp_value (sum of all Comp_Values)
  - avg_comp_value_per_sailing (total ÷ num_sailings)
  - max_sailing_value (highest single cruise value)
- Generate two rankings:
  - Overall strength (by total_comp_value DESC)
  - Single-sailing "jackpot" (by max_sailing_value DESC)

### Step 1.3: Create tRPC Procedures
- `calculateOfferValue` - Calculate value for single offer+cruise combination
- `getOfferRankings` - Return both ranking lists (overall & jackpot)
- `getOfferDetails` - Get detailed breakdown for specific offer code

---

## PHASE 2: Enrich Data Models & UI Components

**Goal:** Add comp value fields to offers and display on cards

### Step 2.1: Update Type Definitions
Add to `CasinoOffer` type in `types/models.ts`:
```typescript
compValue?: number; // Calculated comp value
compedShares?: number; // How many shares covered (0-2)
coverageFraction?: number; // Percentage of cabin cost covered
baseCabinPrice?: number; // 2-person cabin retail price
```

### Step 2.2: Enrich Offers on Import
- Modify `lib/import.ts` `parseExcelOffers()`
- Calculate comp values during import for each offer row
- Store calculated values in CasinoOffer model
- Update memory store with enriched data

### Step 2.3: Update Offer Cards
- Modify `components/OfferCard.tsx`
- Display comp value prominently (e.g., "Value: $3,450")
- Show coverage type (e.g., "Room for Two", "1 Guest + 50% off")
- Add visual indicator for value tier (color-coded badges)

### Step 2.4: Update Cruise Detail Cards
- Modify `components/CruiseCard.tsx` or cruise detail page
- Show applicable offers sorted by comp value
- Display best offer value for this cruise
- Show how offer value compares to cabin retail price

---

## PHASE 3: Analytics Dashboard Rankings

**Goal:** Display offer rankings on Analytics page under Portfolio Performance

### Step 3.1: Create Rankings UI Component
- Create `components/OfferValueRankings.tsx`
- Two tabs:
  - Overall Strength (total value across all sailings)
  - Single-Sailing Jackpot (highest single cruise value)
- Display for each offer:
  - Offer Code & Name
  - Number of sailings
  - Total/avg/max comp value
  - Sample cruise details for max value
- Highlight Offer 2511A06 with explanation badge

### Step 3.2: Integrate into Analytics Page
- Add to `app/(tabs)/(analytics)/index.tsx`
- Place under "Portfolio Performance" section
- Add filtering: by date range, cabin type, ship
- Add sorting: by value, by sailing count, by average
- Export functionality (CSV/PDF of rankings)

### Step 3.3: Add Intelligence Insights
In Analytics Intelligence tab, show:
- "Top 5 Most Valuable Offers This Month"
- "Best Offer for Your Preferred Cabin Type"
- "Offers Expiring Soon with High Values"
- Comparison: "2511A06 vs. Full 'Room for Two' Offers"

---

## IMPLEMENTATION ORDER

1. **Phase 1** - Backend calculation engine (2-3 hours)
2. **Phase 2** - Enrich offers and update cards (2-3 hours)
3. **Phase 3** - Analytics dashboard rankings (2-3 hours)

**Total Estimated Time:** 6-9 hours

---

## KEY IMPLEMENTATION NOTES

- All pricing data already exists in parsed offers (from offers.csv)
- Room type parsing logic needed: "Interior", "Ocean View", "Balcony", "Suite"
- Coverage interpretation from offerTypeCategory field:
  - "Room for Two" → 2.0 shares (100%)
  - "2511A06" → 1.5 shares (75%)
  - Other patterns parsed from description
- Use memo/caching for expensive calculations
- Ensure all calculations handle missing/null pricing gracefully

---

## SPECIAL CASES

### Offer Code 2511A06
This is an Interior room where:
- Guest 1 is fully comped (1.0 share)
- Guest 2 pays only 50% (0.5 share)
- Total: `comped_shares = 1.5` (75% of full two-guest fare)
- This should rank lower than true "Room for Two" offers which cover 100%

### Room Type Normalization Rules
- **INTERIOR**: Contains "Interior" or "Inside"
- **OCEANVIEW**: Contains "Ocean View" or "Oceanview"
- **BALCONY**: Contains "Balcony"
- **SUITE**: Contains "Suite"
- Ignore "GTY" and similar suffixes

### Price Selection Logic
Based on normalized cabin category:
- INTERIOR → Use `Price Interior`
- OCEANVIEW → Use `Price Ocean View`
- BALCONY → Use `Price Balcony`
- SUITE → Use `Price Suite`

Skip rows where the relevant price is missing or zero.
