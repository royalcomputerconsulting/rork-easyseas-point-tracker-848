# Implementation Plan to Fix Analytics & Financial System Issues

## Current Issues Identified

### 1. Process Data Folder Issues
- Backend processing not working properly
- Files showing 0 receipts/statements after scan
- Data not linking to cruises correctly
- Financial database not populating

### 2. Analytics Page Not Populating
- Financial Overview showing empty
- Casino Analytics not calculating
- Top 10 Rankings showing "No data"
- AI Insights not generating
- Cruises Table empty or showing wrong data

### 3. Cruise Navigation Issues  
- Clicking cruises leads to "Cruise Not Found" error
- Wrong route being used (/cruises instead of /cruise/[id])
- Cruise IDs not matching between systems

### 4. Web Pricing Issues
- TypeScript errors with missing color properties
- Pricing not fetching for all cruises
- Progress bar not showing during scraping

### 5. Missing Analytics Calculations
- What the casino thinks (expected value, tier progression)
- Proper ROI calculations
- Value per point calculations
- Financial linkage between receipts/statements and cruises

## Implementation Steps

### Phase 1: Fix TypeScript Errors
1. Add missing color properties to theme
2. Fix route navigation issues
3. Fix type errors in web-pricing

### Phase 2: Fix Data Processing
1. Fix backend OCR processing
2. Ensure proper cruise linkage
3. Fix financial database population
4. Add progress tracking

### Phase 3: Fix Analytics Calculations
1. Implement proper financial overview
2. Add casino analytics calculations
3. Fix Top 10 rankings
4. Add AI insights generation

### Phase 4: Add Missing Features
1. Casino expected value calculations
2. Tier progression analytics
3. Historical pricing with progress
4. Itinerary data fetching

### Phase 5: Testing & Validation
1. Verify all data flows
2. Test cruise navigation
3. Validate analytics calculations
4. Ensure data persistence

## Files to Modify

1. `/constants/theme.ts` - Add missing colors
2. `/app/(tabs)/(analytics)/index.tsx` - Fix navigation route
3. `/app/web-pricing.tsx` - Fix TypeScript errors
4. `/backend/trpc/routes/financials/router.ts` - Fix query issues
5. `/app/process-data-folder.tsx` - Fix backend processing
6. `/backend/trpc/routes/ocr/router.ts` - Add proper OCR processing
7. `/backend/trpc/routes/cruises/web-pricing/route.ts` - Add pricing progress
8. `/app/cruise/[id].tsx` - Ensure proper cruise detail display

## Expected Outcomes

1. Process Data Folder will:
   - Properly scan and process all receipts/statements
   - Link financial data to correct cruises
   - Update financial database
   - Show processing progress

2. Analytics Page will:
   - Display all financial metrics
   - Show casino analytics with ROI
   - Populate Top 10 rankings with clickable cruises
   - Generate AI insights
   - Display cruises table with all data

3. Web Pricing will:
   - Fetch pricing for all 4614 cruises
   - Show progress bar during scraping
   - Store historical pricing data
   - Generate price alerts

4. Casino Analytics will show:
   - Expected value calculations
   - Tier progression analysis
   - Points to next tier
   - Optimal play recommendations
   - What the casino thinks metrics