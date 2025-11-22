# Analytics Implementation Plan - Small Substeps

## Phase 1: Data Foundation (Steps 1-5)

### Step 1: Create Simple Data Provider ⏳
- [ ] Create `state/SimpleAnalyticsProvider.tsx` with hardcoded 7 cruise data
- [ ] Include: Wonder, Harmony, Ovation, Star, 3 Navigator sailings
- [ ] Basic structure: cruise info, financial metrics, points
- [ ] No complex calculations yet - just raw data

### Step 2: Create Basic Analytics Screen
- [ ] Replace current analytics tab with minimal version
- [ ] Show header with total cruises count (7)
- [ ] Display simple list of cruise cards
- [ ] Basic styling with Royal Caribbean colors

### Step 3: Add Summary Cards
- [ ] Total cruises, total points, total ROI
- [ ] Average metrics per cruise
- [ ] Simple calculations from hardcoded data
- [ ] No complex filtering yet

### Step 4: Implement Cruise Cards
- [ ] Ship name, sail dates, nights
- [ ] ROI percentage, points earned, out-of-pocket cost
- [ ] Color coding for ROI (green/red/yellow)
- [ ] Clickable to cruise detail page

### Step 5: Fix Cruise Detail Navigation
- [ ] Ensure cruise/[id].tsx works with new data
- [ ] Fix backend server error 500
- [ ] Simple cruise detail page with basic info

## Phase 2: Core Calculations (Steps 6-10)

### Step 6: Implement ROI Calculations
- [ ] ROI = (Total Value - Out of Pocket) / Out of Pocket * 100
- [ ] Total Value = Retail Price + Casino Comps + FreePlay
- [ ] Verify calculations match expected results

### Step 7: Add Points System
- [ ] Points earned per cruise (verified data)
- [ ] Total points across portfolio
- [ ] Points per dollar calculations
- [ ] Value per point metrics

### Step 8: Casino Strategy Metrics
- [ ] Coin-in calculations (points * $5)
- [ ] Actual cash risk vs perceived value
- [ ] Risk multipliers and inflation ratios
- [ ] House money mode indicators

### Step 9: Financial Breakdowns
- [ ] Retail costs, casino discounts, taxes/fees
- [ ] Amount paid vs retail price
- [ ] FreePlay received and used
- [ ] Onboard spending by category

### Step 10: Validation & Testing
- [ ] Verify all calculations match expected results
- [ ] Test with all 7 cruises
- [ ] Ensure no zero values where data exists
- [ ] Debug any calculation errors

## Phase 3: Rankings & Lists (Steps 11-15)

### Step 11: Top 10 ROI Cruises
- [ ] Sort cruises by ROI percentage
- [ ] Display top performers
- [ ] Show ROI, ship, dates, savings

### Step 12: Points Leaderboards
- [ ] Most points earned per cruise
- [ ] Best value per point
- [ ] Highest coin-in vs actual risk

### Step 13: Risk Analysis Rankings
- [ ] Lowest out-of-pocket cruises
- [ ] Best risk multipliers
- [ ] Highest total value received

### Step 14: Casino Performance Lists
- [ ] Biggest casino wins
- [ ] Best casino comp values
- [ ] Most efficient point earning

### Step 15: Cruise Length Analysis
- [ ] Best value per night
- [ ] Longest cruises with best ratios
- [ ] Short vs long cruise performance

## Phase 4: Enhanced Features (Steps 16-20)

### Step 16: Filtering & Sorting
- [ ] Filter by date range, ship, ROI performance
- [ ] Sort by various metrics
- [ ] Search functionality

### Step 17: Charts & Visualizations
- [ ] ROI trend over time
- [ ] Points accumulation chart
- [ ] Spending category breakdowns
- [ ] Risk vs reward scatter plot

### Step 18: Casino Strategy Insights
- [ ] Implement the casino perspective vs reality analysis
- [ ] Show coin-in inflation vs actual risk
- [ ] House money mode detection
- [ ] Strategic advantage calculations

### Step 19: AI-Powered Analytics
- [ ] Individual cruise AI narratives
- [ ] Portfolio optimization suggestions
- [ ] Risk management insights
- [ ] Tier advancement recommendations

### Step 20: Polish & Performance
- [ ] Optimize rendering performance
- [ ] Add loading states
- [ ] Error handling
- [ ] Mobile responsiveness

## Implementation Strategy

### Data Structure for 7 Cruises:
```typescript
interface SimpleCruise {
  id: string;
  ship: string;
  sailDate: string;
  nights: number;
  retailPrice: number;
  casinoComp: number;
  amountPaid: number;
  freePlay: number;
  pointsEarned: number;
  winnings: number;
  onboardSpend: number;
}
```

### Key Calculations:
- ROI = ((retailPrice + casinoComp + freePlay + winnings) - amountPaid) / amountPaid * 100
- Coin-in = pointsEarned * 5
- Value per point = (total savings) / pointsEarned
- Risk multiplier = coin-in / amountPaid

### Success Criteria:
- All 7 cruises display correctly
- No zero values where data exists
- ROI calculations match expected results
- Cruise detail pages work without errors
- Rankings and leaderboards populate correctly
- Performance is smooth and responsive

## Next Steps:
Start with Step 1 - Create Simple Data Provider with hardcoded data for the 7 cruises.