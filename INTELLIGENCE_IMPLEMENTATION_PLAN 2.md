# Cruise Intelligence Platform - Implementation Plan

## Overview
This plan implements a sophisticated intelligence layer on top of the existing cruise management system, adding context awareness, self-healing data, predictive analytics, pattern recognition, and conversational AI.

---

## Phase 1 — Context Awareness Foundations (Priority: 1)

### Goals
- Establish Player/Cruise/Offer context models
- Wire data contracts between backend and frontend
- Surface basic context cards in UI

### Technical Scope

#### 1.1 Context Schema Definition
**Files to Create:**
- `types/context.ts` - TypeScript interfaces for context models
- `backend/trpc/routes/context/router.ts` - Context API router

**Context Models:**
```typescript
// Player Context
interface PlayerContext {
  tier: 'Diamond' | 'Diamond Plus' | 'Pinnacle';
  pace: 'slow' | 'moderate' | 'aggressive';
  avgSpendPerNight: number;
  avgPointsPerNight: number;
  preferredShips: string[];
  preferredRoutes: string[];
  seasonalPatterns: SeasonalPattern[];
}

// Ship Context
interface ShipContext {
  ship: string;
  profitabilityScore: number; // 0-100
  avgROI: number;
  bestSeasons: string[];
  casinoQuality: 'standard' | 'premium' | 'elite';
}

// Offer Context
interface OfferContext {
  offerId: string;
  roiSignal: 'strong' | 'moderate' | 'weak';
  historicalRedemption: number;
  valueScore: number; // 0-100
  expirationUrgency: 'low' | 'medium' | 'high';
}
```

#### 1.2 Backend Implementation
**Files to Create:**
- `backend/trpc/routes/context/player/route.ts`
- `backend/trpc/routes/context/ship/route.ts`
- `backend/trpc/routes/context/offer/route.ts`

**Key Endpoints:**
- `context.player.get` - Get player context with caching
- `context.ship.analyze` - Analyze ship profitability
- `context.offer.evaluate` - Evaluate offer ROI signals

#### 1.3 Frontend Integration
**Files to Create:**
- `lib/context.ts` - React Query hooks for context
- `components/intelligence/PlayerContextCard.tsx`
- `components/intelligence/ShipContextCard.tsx`
- `components/intelligence/OfferContextCard.tsx`

**Integration Points:**
- Overview screen: Player context card
- Cruise detail screen: Ship context card
- Offer detail screen: Offer context card

### Success Metrics
- ✅ Cards load with correct values from seed data
- ✅ <200ms p95 resolver latency (local)
- ✅ All context types properly typed with strict TypeScript

### Dependencies
- Existing analytics utilities (`lib/analytics.ts`)
- Current data loaders (`state/AppStateProvider.tsx`)
- Financial data (`state/FinancialsProvider.tsx`)

---

## Phase 2 — Self-Healing Data Fabric MVP (Priority: 8)

### Goals
- Prevent bad data from entering the system
- Auto-detect and correct common issues
- Provide safe rollback mechanisms

### Technical Scope

#### 2.1 Data Normalizers
**Files to Create:**
- `backend/trpc/routes/data-quality/normalizers.ts`
- `backend/trpc/routes/data-quality/validators.ts`

**Normalizer Functions:**
```typescript
// Cabin normalizers
normalizeCabinType(cabin: string): CabinType
normalizeCabinNumber(cabin: string): string

// Date normalizers
normalizeDateFormat(date: string): string
validateDateRange(start: string, end: string): boolean

// Amount normalizers
normalizeAmount(amount: string | number): number
detectCurrency(amount: string): Currency
```

#### 2.2 Validation Pipeline
**Files to Create:**
- `backend/trpc/routes/data-quality/validate/route.ts`
- `backend/trpc/routes/data-quality/repair/route.ts`

**Validation Rules:**
- Missing required fields (ship, dates, cabin)
- Invalid date ranges (end before start)
- Suspicious amounts (negative, too large)
- OCR confidence thresholds
- Duplicate detection

#### 2.3 Repair Actions
**Files to Create:**
- `backend/trpc/routes/data-quality/fix/route.ts`
- `backend/trpc/routes/data-quality/rollback/route.ts`

**Repair Operations:**
- Rebuild year tags from dates
- Deduplicate cruises by key fields
- Fix cabin type inconsistencies
- Correct date format issues
- Snapshot before fixes
- Reversible fix application

#### 2.4 Admin UI
**Files to Create:**
- `app/data-quality.tsx` - Data quality dashboard
- `components/data-quality/ValidationReport.tsx`
- `components/data-quality/FixReview.tsx`
- `components/data-quality/RollbackPanel.tsx`

**UI Features:**
- Validation report with issue counts
- Fix preview with before/after diff
- Approve/undo buttons
- Audit log viewer
- Rollback to snapshot

### Success Metrics
- ✅ 95% of known data issues auto-fixed
- ✅ Zero regressions after rollback
- ✅ Complete audit log for each fix
- ✅ <1s validation time for 1000 records

### Dependencies
- Existing backup system (`backend/trpc/routes/backup/`)
- Current data models (`types/models.ts`)

---

## Phase 3 — Predictive What-If Engine MVP (Priority: 2)

### Goals
- Provide actionable forecasts beyond simple averages
- Enable scenario planning and simulation

### Technical Scope

#### 3.1 Forecasting Models
**Files to Create:**
- `backend/trpc/routes/forecast/tier/route.ts`
- `backend/trpc/routes/forecast/roi/route.ts`
- `backend/trpc/routes/forecast/risk/route.ts`
- `lib/forecasting.ts` - Forecasting utilities

**Forecast Types:**
```typescript
// Tier Forecasting
interface TierForecast {
  currentTier: string;
  nextTier: string;
  pointsNeeded: number;
  cruisesNeeded: number;
  estimatedDate: string;
  confidence: number;
}

// ROI Forecasting
interface ROIForecast {
  cruiseId: string;
  predictedROI: number;
  confidenceInterval: [number, number];
  factors: ROIFactor[];
}

// Risk Analysis
interface RiskCurve {
  scenario: 'pessimistic' | 'expected' | 'optimistic';
  freePlay: number;
  totalValue: number;
  probability: number;
}
```

#### 3.2 Prediction Algorithms
**Implementation:**
- Linear regression for ROI based on route/ship/season
- Time-series analysis for tier progression
- Monte Carlo simulation for risk curves (1000 iterations)
- Caching layer for expensive computations

#### 3.3 What-If UI
**Files to Create:**
- `app/what-if.tsx` - What-If simulator screen
- `components/forecast/TierForecast.tsx`
- `components/forecast/ROIForecast.tsx`
- `components/forecast/RiskCurve.tsx`
- `components/forecast/WhatIfSliders.tsx`

**UI Features:**
- Slider controls for parameters (nights, spend, etc.)
- Real-time forecast updates
- Comparison view (current vs. simulated)
- CSV export of scenarios
- Confidence bands visualization

### Success Metrics
- ✅ Forecasts compute <500ms p95 (cached)
- ✅ User can simulate at least 3 parameters
- ✅ Delta calculations show impact clearly
- ✅ 80% forecast accuracy on test data

### Dependencies
- Historical cruise data
- Financial analytics (`lib/analytics.ts`)
- Points system (`lib/loyalty.ts`)

---

## Phase 4 — Pattern Recognition & Alerts (Priority: 5)

### Goals
- Detect drift and anomalies automatically
- Surface clear, actionable alerts

### Technical Scope

#### 4.1 Anomaly Detection Engine
**Files to Create:**
- `backend/trpc/routes/alerts/detect/route.ts`
- `backend/trpc/routes/alerts/rules/route.ts`
- `lib/anomaly-detection.ts`

**Detection Rules:**
```typescript
// ROI Anomalies
detectROISpike(cruise: Cruise, baseline: number): Alert | null
detectROIDrop(cruise: Cruise, baseline: number): Alert | null

// Offer Anomalies
detectOfferMismatch(offer: Offer, history: Offer[]): Alert | null
detectUnusualValue(offer: Offer): Alert | null

// Pace Anomalies
detectPaceDrift(player: PlayerContext, baseline: number): Alert | null

// Data Quality
detectCabinInconsistency(cruise: Cruise): Alert | null
```

#### 4.2 Baseline Calculation
**Implementation:**
- Per-user baselines (rolling 12-month average)
- Per-ship baselines (all-time average)
- Per-season baselines (seasonal patterns)
- Sensitivity controls (1σ, 2σ, 3σ)
- False-positive guardrails

#### 4.3 Alerts UI
**Files to Create:**
- `app/alerts.tsx` - Alerts center (already exists, enhance)
- `components/alerts/AlertCard.tsx`
- `components/alerts/AlertBadge.tsx`
- `components/alerts/AlertDetail.tsx`

**UI Features:**
- Alert center with filtering
- Inline badges on cruise/offer cards
- Snooze/acknowledge actions
- Detail drill-down with context
- Weekly digest report

### Success Metrics
- ✅ <5% false positives in test set
- ✅ Alert-to-action flow under 3 taps
- ✅ 90% of real issues detected
- ✅ <100ms alert check latency

### Dependencies
- Context awareness (Phase 1)
- Historical data patterns
- User preferences

---

## Phase 5 — Conversational Agent X + Luxury Intelligence Theme (Priority: 4, 10)

### Goals
- Natural-language analytics interface
- Premium, consistent UI theme

### Technical Scope

#### 5.1 Agent Tools
**Files to Create:**
- `backend/trpc/routes/agent/tools.ts`
- `app/agent-chat.tsx` - Chat interface

**Tool Definitions:**
```typescript
// Query Tools
queryTopCruises(filters: CruiseFilters): Cruise[]
queryOffersByValue(minValue: number): Offer[]
queryUpcomingCruises(months: number): Cruise[]

// Simulation Tools
simulateUpgrade(cruiseId: string, newCabin: string): ROIComparison
simulateTierProgress(additionalCruises: number): TierForecast

// Forecast Tools
getForecast(type: 'tier' | 'roi' | 'risk', params: any): Forecast

// Summary Tools
summarizeOffers(offerId?: string): OfferSummary
summarizeCruiseHistory(): CruiseHistorySummary
```

#### 5.2 Agent Implementation
**Integration:**
- Use `@rork/toolkit-sdk` for agent functionality
- Tool execution with validation
- Context-aware prompts
- Transcript logging for improvements
- Rate limiting and guardrails

#### 5.3 Luxury Theme System
**Files to Create:**
- `constants/luxuryTheme.ts` - Theme tokens
- `components/ui/LuxuryCard.tsx`
- `components/ui/OceanicGradient.tsx`
- `components/ui/GlowAccent.tsx`

**Theme Tokens:**
```typescript
const luxuryTheme = {
  colors: {
    primary: {
      navy: '#0A1929',
      deepBlue: '#1A2F4A',
      ocean: '#2A4F6A',
    },
    accent: {
      aqua: '#00D9FF',
      aquaGlow: '#00D9FF40',
      gold: '#FFD700',
    },
    surface: {
      card: '#1E3A5F',
      elevated: '#2A4F6A',
    },
  },
  gradients: {
    oceanic: 'linear-gradient(135deg, #0A1929 0%, #1A2F4A 50%, #2A4F6A 100%)',
    aquaGlow: 'linear-gradient(90deg, #00D9FF20 0%, #00D9FF00 100%)',
  },
  borderRadius: {
    card: 16,
    button: 12,
    input: 8,
  },
  shadows: {
    glow: '0 0 20px rgba(0, 217, 255, 0.3)',
    elevated: '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
};
```

#### 5.4 Progressive Theme Rollout
**Screens to Update (Priority Order):**
1. Overview screen - Hero section with gradient
2. Cruise detail - Luxury card design
3. Offers screen - Glow accents on high-value offers
4. Analytics screens - Consistent theme
5. Settings - Theme toggle (light/dark/luxury)

### Success Metrics
- ✅ >80% of common queries resolvable via Agent
- ✅ No UI regressions after theme application
- ✅ Theme passes WCAG AA contrast requirements
- ✅ <2s response time for agent queries

### Dependencies
- All previous phases for agent tools
- Existing UI components for theming

---

## Execution Strategy

### Development Cadence
- **Week 1-2:** Phase 1 (Context Awareness)
- **Week 3-4:** Phase 3 (Predictive Engine) - Higher priority
- **Week 5-6:** Phase 5 (Agent + Theme) - User-facing value
- **Week 7-8:** Phase 4 (Alerts) - Build on context
- **Week 9-10:** Phase 2 (Self-Healing) - Infrastructure

### Technical Standards
- ✅ Strict TypeScript with explicit types
- ✅ React Query object API for all data fetching
- ✅ testId on all interactive elements
- ✅ Extensive console.log for debugging
- ✅ Web compatibility (no native-only APIs)
- ✅ Animated API over Reanimated unless critical
- ✅ Feature flags for progressive rollout

### Testing Strategy
- Unit tests for forecasting algorithms
- Integration tests for agent tools
- Visual regression tests for theme
- Performance benchmarks for all APIs
- User acceptance testing per phase

### Rollout Plan
- Feature flags per phase
- Beta testing with seed data
- Gradual rollout to production
- Usage metrics per feature
- Feedback collection and iteration

---

## Risk Mitigation

### Technical Risks
1. **Performance:** Cache aggressively, lazy load components
2. **Data Quality:** Validate inputs, provide fallbacks
3. **Agent Accuracy:** Log failures, improve prompts iteratively
4. **Theme Consistency:** Use design tokens, automated checks

### User Experience Risks
1. **Complexity:** Progressive disclosure, clear onboarding
2. **Information Overload:** Prioritize insights, hide details
3. **Trust:** Show confidence levels, explain predictions
4. **Accessibility:** WCAG compliance, keyboard navigation

---

## Success Criteria

### Phase 1
- [ ] Context cards render on 3+ screens
- [ ] <200ms p95 latency for context APIs
- [ ] 100% type coverage for context models

### Phase 2
- [ ] 95% auto-fix rate for known issues
- [ ] Zero data loss on rollback
- [ ] Complete audit trail

### Phase 3
- [ ] <500ms p95 for cached forecasts
- [ ] 3+ simulatable parameters
- [ ] 80% forecast accuracy

### Phase 4
- [ ] <5% false positive rate
- [ ] <3 taps to action
- [ ] 90% issue detection rate

### Phase 5
- [ ] 80% query resolution via agent
- [ ] WCAG AA compliance
- [ ] No UI regressions

---

## Next Steps

1. **Immediate:** Create Phase 1 context schema files
2. **Week 1:** Implement player context backend
3. **Week 1:** Build first context card UI
4. **Week 2:** Complete Phase 1, begin Phase 3
5. **Ongoing:** Document learnings, iterate on feedback
