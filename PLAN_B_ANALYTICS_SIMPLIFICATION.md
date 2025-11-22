# PLAN B: Analytics Simplification & Implementation

## Overview
Rebuild the entire analytics pathway to use only the `DATA/financials.database.csv` file as the single source of truth. Remove all complex processing routes and simplify the system.

## Current State Analysis
- We have 278 financial records in `DATA/financials.database.csv`
- Multiple complex processing routes that are no longer needed
- Analytics showing empty data despite having records
- Need to connect analytics directly to CSV data

## User-Specified Rule Set (2025-09-21)
- Data source: Only use `DATA/financials.database.csv` as the single source of truth. Treat “Financial.database.csv” references as the same file path.
- ID mapping: Use `CruiseID` from CSV as both BookingID# and Reservation# throughout the app.
- Points total correction: Total points must equal 12,149 across cruises. Reference breakdown: 976 (Navigator 9/15), 817 (Navigator 9/12), 4,581 (Star), 2,030 (Ovation), ~1,000 (Harmony), and the remaining balance on Wonder. Update CSV rows to reflect these values.
- Missing statement heuristic: If a cruise has a receipt but no statement and points/winnings are unknown, assume $0 win/loss; estimate points as 600–1000 for a 4-night cruise, and ~1,500 for 7+ nights. Mark these as "estimated" for transparency.
- Out-of-pocket definition: Out-of-pocket = actual amount paid for the cruise + internet charges + gratuities. Value captured = retail cruise fare − out-of-pocket. Do not automatically treat Club Royale Entertainment Charges as losses; balance them with actual recorded winnings/losings.
- Value add-ins: SPA purchases and specialty restaurants comped via casino are counted toward value captured.
- Portfolio window: Portfolio performance and cost-per-point calculations include only cruises from April 1, 2025 onward. Use the corrected total points (12,149) for this window to compute cost per point.
- Save behavior bug: On cruise detail page, "Winnings brought home" and "Points earned" must persist after clicking the Save (disk) button. Implement backend mutation to update the corresponding CSV row, with optimistic UI and error handling.

## Phase 1: Data Source Consolidation

### 1.1 Remove Unnecessary Routes
- [ ] Remove/disable receipt processing routes
- [ ] Remove/disable statement processing routes  
- [ ] Remove/disable complex financial data processing
- [ ] Keep only CSV-based data loading

#### Pages to Remove (CSV-only approach):
- [ ] app/process-financials.tsx
- [ ] app/process-receipts.tsx  
- [ ] app/process-statements.tsx
- [ ] app/receipts-admin.tsx
- [ ] app/ocr.tsx
- [ ] app/process-data-folder.tsx

#### Backend Routes to Remove:
- [ ] backend/trpc/routes/ocr/* (all OCR processing)
- [ ] Individual file processing endpoints
- [ ] Receipt/statement scanning routes

### 1.2 Simplify Backend Analytics
- [ ] Update comprehensive analytics route to read directly from CSV
- [ ] Remove dependency on processed receipts/statements
- [ ] Implement direct CSV parsing and aggregation
- [ ] Add proper error handling for CSV data

### 1.3 Update Data Models
- [ ] Ensure types match CSV structure exactly
- [ ] Remove unused financial processing types
- [ ] Streamline cruise-financial matching logic

## Phase 2: Core Analytics Implementation

### 2.1 Basic Dashboard Population
- [ ] Replace empty analytics page with populated dashboard
- [ ] Show all cruises with financial data from CSV
- [ ] Create cruise cards with: ROI %, retail price, casino discount, amount paid, FreePlay, points earned
- [ ] Add overall summary section with totals across all records
- [ ] Implement Royal Caribbean blue/gold color scheme

### 2.2 Individual Cruise Details
- [ ] Create comprehensive cruise detail pages
- [ ] Retail cabin price vs amount paid comparison
- [ ] Club Royale charges breakdown by category
- [ ] Winnings vs losses with risk analysis
- [ ] Interactive charts for spending patterns
- [ ] ROI color coding (green/red/yellow)

### 2.3 Top 10 Leaderboards
- [ ] Best ROI cruises ranked by percentage return
- [ ] Highest value per point achievements
- [ ] Lowest out-of-pocket cost cruises
- [ ] Biggest casino wins and total value received
- [ ] Most points earned per cruise
- [ ] Longest cruises with best value ratios

## Phase 3: Advanced Features

### 3.1 Filtering & Sorting
- [ ] Sortable cruise table with all financial metrics
- [ ] Filter by date range, ship, ROI performance, points earned
- [ ] Search functionality across cruise names, ships, dates

### 3.2 AI-Powered Analytics
- [ ] Individual cruise AI narratives analyzing:
  - Casino coin-in vs actual cash risk assessment
  - Spending pattern analysis across categories
  - ROI optimization recommendations
  - Club Royale tier progression insights
- [ ] Overall portfolio AI analysis identifying:
  - Best performing cruise types/lengths
  - Optimal spending strategies
  - Tier advancement recommendations
  - Risk management insights

### 3.3 Status Management
- [ ] Mark cruises with past sailing dates as "completed"
- [ ] Add cruise status indicators
- [ ] Implement proper date-based filtering

## Phase 4: Performance & Polish

### 4.1 Performance Optimization
- [ ] Implement analytics caching for 278+ records
- [ ] Optimize CSV parsing and data aggregation
- [ ] Add loading states and error boundaries

### 4.2 UI/UX Enhancement
- [ ] Royal Caribbean branding consistency
- [ ] Mobile-responsive design
- [ ] Smooth animations and transitions
- [ ] Comprehensive error handling

## Implementation Strategy
1. **Small Steps**: Implement each phase in small, testable increments
2. **CSV-First**: All data operations read directly from `financials.database.csv`
3. **No Complex Processing**: Remove all receipt/statement processing complexity
4. **Direct Analytics**: Calculate all metrics directly from CSV data
5. **Incremental Testing**: Test each component before moving to next phase

## Success Criteria
- [ ] Analytics dashboard shows populated data from all 278 records
- [ ] All cruise cards display correct financial metrics
- [ ] Individual cruise pages show comprehensive breakdowns
- [ ] Leaderboards rank cruises correctly
- [ ] AI narratives generate meaningful insights
- [ ] System performs well with large dataset
- [ ] All features work consistently

## Files to Modify/Create
- Backend analytics routes (simplify to CSV-only)
- Frontend analytics components (populate with real data)
- Data models and types (align with CSV structure)
- Individual cruise detail pages
- Leaderboard components
- AI integration for narratives
- Filtering and search components

## Next Steps
1. Start with Phase 1.1 - Remove unnecessary routes
2. Implement direct CSV reading in analytics
3. Populate basic dashboard with real data
4. Build individual cruise detail pages
5. Add leaderboards and advanced features
6. Integrate AI analytics
7. Polish and optimize

This plan ensures we build a robust, simplified analytics system that leverages all available financial data effectively.