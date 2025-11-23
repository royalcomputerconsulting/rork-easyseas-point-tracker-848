# Intelligence Features Implementation Progress

## Overview
This document tracks the implementation of 10 intelligence features for the cruise analytics app.

## ✅ Completed Features

### 1. Offer Expiration Alerts & Auto-Matching (PARTIAL)
**Status**: Backend complete, needs frontend  
**Location**: `backend/trpc/routes/analytics/alerts/route.ts`  
**API**: `trpc.analytics.alerts.useQuery()`

**What's Done**:
- ✅ Tracks offers expiring in 30/15/7/3 days
- ✅ Severity levels (high/medium/low)
- ✅ Urgency scoring (0-100)
- ✅ Actionable alerts with navigation links

**What's Missing**:
- Auto-matching offers to cruise dates
- Booking urgency calculation based on points + offer value
- Push notifications

**Response Structure**:
```typescript
{
  success: boolean;
  alerts: Array<{
    id: string;
    type: 'offer-expiring' | 'high-value-match' | 'tier-opportunity';
    severity: 'high' | 'medium' | 'low';
    title: string;
    message: string;
    actionable: boolean;
    actionLabel?: string;
    actionTarget?: string;
    metadata: {
      offerId?: string;
      daysUntilExpiration?: number;
      urgencyScore?: number;
    };
    expiresAt?: string;
  }>;
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
}
```

**Frontend Usage Example**:
```typescript
const alertsQuery = trpc.analytics.alerts.useQuery();

{alertsQuery.data?.alerts.map(alert => (
  <TouchableOpacity 
    key={alert.id}
    onPress={() => router.push(alert.actionTarget)}
    style={[
      styles.alert,
      alert.severity === 'high' && styles.alertHigh,
      alert.severity === 'medium' && styles.alertMedium
    ]}
  >
    <Text style={styles.alertTitle}>{alert.title}</Text>
    <Text style={styles.alertMessage}>{alert.message}</Text>
    <Text style={styles.alertDays}>
      {alert.metadata.daysUntilExpiration} days remaining
    </Text>
  </TouchableOpacity>
))}
```

---

## 🔄 In Progress Features

### 2. Smart Booking Window Predictor
**Status**: Needs implementation  
**Priority**: High

**Approach**:
- Create `backend/trpc/routes/analytics/booking-window/route.ts`
- Analyze historical pricing data from `cruises` collection
- Track price drops and patterns
- Calculate optimal booking windows

**Required Data**:
- Cruise pricing history (current in `Cruise.pricing` and `Cruise.pricingCurrent`)
- Historical low prices (`Cruise.pricingLowest`)
- Booking dates vs departure dates

### 3. Personal Casino Strategy Coach
**Status**: Needs implementation  
**Priority**: High

**Approach**:
- Create `backend/trpc/routes/analytics/strategy-coach/route.ts`
- Analyze play patterns from statements
- Calculate break-even points per cruise
- Suggest optimal coin-in for tier thresholds

**Data Sources**:
- `CruiseStatementData` - casino spending patterns
- `UserProfile` - current tier and points
- `CasinoPayTable` - tier requirements

### 4. Cruise Value Score (0-100)
**Status**: Needs implementation  
**Priority**: High

**Algorithm Outline**:
```typescript
function calculateCruiseValueScore(cruise, userProfile, offers) {
  let score = 0;
  
  // ROI Potential (30 points)
  const roiScore = Math.min(30, (estimatedROI / 100) * 30);
  
  // Offer Value (25 points)
  const offerScore = calculateOfferValue(cruise, offers);
  
  // Ship Profitability (20 points)
  const shipScore = getHistoricalShipROI(cruise.ship);
  
  // Schedule Fit (15 points)
  const scheduleScore = checkScheduleConflicts(cruise, bookedCruises);
  
  // Departure Port (10 points)
  const portScore = calculatePortProximity(cruise.departurePort, 'Phoenix');
  
  return score / 100 * 100; // Normalize to 0-100
}
```

### 5. Multi-Cruise Portfolio Optimizer
**Status**: Needs implementation  
**Priority**: Medium

**Features**:
- Suggest optimal cruise combinations to reach tier goals
- Balance high-value vs quick point earners
- Optimize certificate usage before expiration
- Consider calendar availability

---

## 📋 Pending Features (Not Started)

### 6. Predictive Cash Flow Planner
**Status**: Not started  
**Priority**: Medium

### 7. Ship Class Performance Analytics
**Status**: Not started  
**Priority**: Medium  
**Note**: Some analysis already exists in `getHistoricalAnalytics` procedure

### 8. Competitive Benchmarking
**Status**: Not started  
**Priority**: Low  
**Note**: Requires anonymous user data aggregation

### 9. Natural Language Cruise Assistant
**Status**: Foundation exists  
**Priority**: High  
**Note**: Can leverage `@rork/toolkit-sdk` AI capabilities

**Implementation Approach**:
```typescript
import { useRorkAgent, createRorkTool } from '@rork-ai/toolkit-sdk';

const { messages, sendMessage } = useRorkAgent({
  tools: {
    findCruises: createRorkTool({
      description: 'Find cruises matching criteria',
      zodSchema: z.object({
        maxPrice: z.number().optional(),
        minNights: z.number().optional(),
        ship: z.string().optional(),
      }),
      execute(input) {
        return searchCruises(input);
      }
    }),
    compareROI: createRorkTool({
      description: 'Compare ROI between ships',
      zodSchema: z.object({
        ship1: z.string(),
        ship2: z.string(),
      }),
      execute(input) {
        return compareShipROI(input.ship1, input.ship2);
      }
    }),
  }
});
```

### 10. Smart Calendar Integration
**Status**: Partial foundation exists  
**Priority**: Medium  
**Note**: Calendar import already exists in `backend/trpc/routes/calendar/import-calendar/route.ts`

**Needed Features**:
- Auto-detect blackout dates
- Suggest cruises that fit schedule gaps
- Sync with TripIt
- Conflict detection

---

## Implementation Priority

### Phase 1 (Immediate) - High Value, Quick Wins
1. ✅ Offer Expiration Alerts (DONE)
2. 🔄 Auto-match offers to cruises (IN PROGRESS)
3. Cruise Value Score algorithm
4. Personal Casino Strategy Coach

### Phase 2 (Short-term) - Core Intelligence
5. Smart Booking Window Predictor
6. Multi-Cruise Portfolio Optimizer
7. Natural Language Assistant

### Phase 3 (Medium-term) - Enhanced Features
8. Predictive Cash Flow Planner
9. Ship Class Performance Analytics
10. Smart Calendar Integration

### Phase 4 (Long-term) - Advanced Features
11. Competitive Benchmarking

---

## Frontend Integration Needed

### Intelligence Dashboard Page
**Location**: Create new page at `app/intelligence-hub.tsx`

**Sections**:
1. **Alerts Feed** - Show expiring offers and opportunities
2. **Value Scores** - Display cruise scores with visual indicators
3. **Strategy Coach** - Personalized casino play recommendations
4. **Portfolio Optimizer** - Suggested cruise combinations
5. **AI Assistant** - Chat interface for questions

**Sample Layout**:
```typescript
export default function IntelligenceHub() {
  const alertsQuery = trpc.analytics.alerts.useQuery();
  const strategyQuery = trpc.analytics.strategyCoach.useQuery();
  
  return (
    <ScrollView>
      {/* Urgent Alerts */}
      <Section title="🚨 Urgent Actions">
        {alertsQuery.data?.alerts
          .filter(a => a.severity === 'high')
          .map(alert => <AlertCard key={alert.id} alert={alert} />)
        }
      </Section>
      
      {/* Value Opportunities */}
      <Section title="💎 Top Value Cruises">
        <CruiseValueList />
      </Section>
      
      {/* Strategy Recommendations */}
      <Section title="🎯 Strategy Coach">
        <StrategyCard recommendations={strategyQuery.data} />
      </Section>
      
      {/* AI Assistant */}
      <Section title="🤖 Ask Anything">
        <AIAssistant />
      </Section>
    </ScrollView>
  );
}
```

---

## Database Schema Additions

### For Competitive Benchmarking
```typescript
interface BenchmarkData {
  id: string;
  anonymousUserId: string;
  tier: string;
  totalPoints: number;
  totalCruises: number;
  averageROI: number;
  createdAt: string;
}
```

### For Booking History
```typescript
interface BookingHistory {
  cruiseId: string;
  bookingDate: string;
  purchasePrice: number;
  marketPriceAtBooking: number;
  daysBeforeSailing: number;
  savings: number;
}
```

---

## API Endpoints Summary

### Completed
- ✅ `trpc.analytics.alerts.useQuery()` - Get all alerts

### To Implement
- `trpc.analytics.offerMatching.useQuery()` - Auto-match offers to cruises
- `trpc.analytics.bookingWindow.useQuery({ cruiseId })` - Optimal booking timing
- `trpc.analytics.strategyCoach.useQuery()` - Personal casino strategy
- `trpc.analytics.cruiseValueScore.useQuery({ cruiseId })` - Calculate value score
- `trpc.analytics.portfolioOptimizer.useQuery({ targetTier, targetDate })` - Optimize cruise portfolio
- `trpc.analytics.cashFlowPlanner.useQuery({ months })` - Project cash flow
- `trpc.analytics.shipPerformance.useQuery({ shipClass })` - Ship class analytics
- `trpc.analytics.benchmark.useQuery()` - Competitive benchmarking
- `trpc.analytics.calendarOptimizer.useQuery()` - Smart calendar suggestions

---

## Next Steps

1. **Complete Auto-Matching System** (IN PROGRESS)
   - Match offers to available cruise dates
   - Calculate booking urgency scores
   - Suggest best offer + cruise combinations

2. **Implement Cruise Value Score**
   - Create scoring algorithm
   - Add backend API
   - Display scores in cruise cards

3. **Build Strategy Coach**
   - Analyze historical play patterns
   - Calculate break-even points
   - Suggest optimal coin-in per cruise

4. **Create Intelligence Dashboard**
   - Design unified intelligence hub page
   - Integrate all intelligence features
   - Add AI assistant chat interface

---

## Testing Checklist

- [ ] Alerts load and display correctly
- [ ] Severity levels show appropriate styling
- [ ] Alert actions navigate to correct pages
- [ ] Value scores calculate accurately
- [ ] Strategy recommendations are personalized
- [ ] Portfolio optimizer respects constraints
- [ ] AI assistant responds to queries
- [ ] Calendar integration syncs properly
- [ ] Benchmarking data is anonymized
- [ ] Cash flow projections are realistic

---

## Performance Considerations

1. **Caching**: All intelligence queries should be cached with React Query
2. **Background Jobs**: Complex calculations (benchmarking, predictions) should run in background
3. **Incremental Updates**: Only recalculate when data changes
4. **Pagination**: Alerts and recommendations should be paginated
5. **Debouncing**: AI assistant queries should be debounced

---

## Documentation

Each new feature should include:
- JSDoc comments in code
- Example usage in frontend
- Test cases
- Performance benchmarks
- User-facing help text
