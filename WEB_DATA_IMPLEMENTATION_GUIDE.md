# Web Data Implementation Guide

## Current Status & Next Steps

Based on the project analysis and recent conversations, here's what needs to happen for the web to feed correct data with the rollback scheme already implemented.

## ✅ What's Already Implemented

### 1. **Comprehensive Rollback System**
- ✅ Automatic snapshots before web operations
- ✅ Rollback-enabled procedures for safe data updates
- ✅ Error recovery and data validation
- ✅ Batch processing with rollback protection
- ✅ Manual rollback management via tRPC procedures

### 2. **Web Scraping Infrastructure**
- ✅ Mock scrapers that simulate real web data feeding
- ✅ Multi-source data merging (CruiseTimetables, Gangwaze, CruiseDirect)
- ✅ Rate limiting and error handling
- ✅ Data validation and parsing
- ✅ Realistic cruise data generation based on ship patterns

### 3. **Data Processing & Validation**
- ✅ Date/duration calculation and correction
- ✅ Itinerary name cleaning and standardization
- ✅ Timezone handling for departure/return dates
- ✅ Comprehensive data validation functions

## 🔧 What Needs to Be Done Next

### **Phase 1: Replace Mock Scrapers with Real Web Scraping**

#### 1.1 CruiseTimetables.com Integration
```typescript
// Replace mock implementation in scrapeCruiseTimetables()
const response = await fetch(`${searchUrl}?${searchParams}`, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; CruiseBot/1.0)',
    'Accept': 'application/json'
  }
}).then(res => res.json());
```

**Implementation Steps:**
1. Research CruiseTimetables.com API endpoints
2. Implement proper authentication if required
3. Handle rate limiting (2-3 seconds between requests)
4. Parse HTML/JSON responses into our data format
5. Add error handling for network failures

#### 1.2 Gangwaze.com Integration
```typescript
// Replace mock implementation in scrapeGangwaze()
const response = await fetch(searchUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (compatible; CruiseBot/1.0)'
  },
  body: JSON.stringify(requestBody)
}).then(res => res.json());
```

**Implementation Steps:**
1. Research Gangwaze API for pricing data
2. Implement authentication/API keys if required
3. Handle different response formats
4. Add pricing validation and comparison logic

#### 1.3 CruiseDirect.com Integration
- Similar implementation for promotional pricing
- Focus on competitive pricing data
- Handle promotional offers and discounts

### **Phase 2: Fix Core Data Issues**

#### 2.1 Date/Duration Problems (Priority: HIGH)
**Issue:** Navigator 8/22 showing wrong dates (3 nights vs 7 nights)

**Solution Already Implemented:**
- `extractNightsFromItinerary()` - Extracts correct nights from itinerary names
- `calculateReturnDate()` - Calculates correct return dates
- `cleanItineraryName()` - Standardizes itinerary names
- `fixCruiseDatesAndDuration()` - Comprehensive data correction

**Next Steps:**
1. Run batch verification on all cruises: `trpc.cruises.batchVerify.mutate()`
2. Focus on Navigator of the Seas cruises specifically
3. Verify timezone handling for West Coast departures

#### 2.2 Timezone Issues
**Issue:** Departure dates showing incorrectly due to timezone differences

**Solution:**
```typescript
// Add timezone-aware date parsing
function parseDate(dateString: string, timezone: string = 'America/Los_Angeles'): Date {
  return new Date(new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(dateString)));
}
```

### **Phase 3: UI Integration**

#### 3.1 Analytics on Cruise Detail Cards
**Issue:** Analytics not appearing on cruise detail cards

**Solution:** Update cruise detail components to show:
- Current pricing vs. historical averages
- Savings potential based on casino offers
- Break-even point calculations
- Portfolio performance metrics

#### 3.2 Ship Name Corrections
**Issue:** Price alerts showing wrong ship names

**Solution:** Implement ship name standardization:
```typescript
function standardizeShipName(shipName: string): string {
  const corrections = {
    'Navigator': 'Navigator of the Seas',
    'Voyager': 'Voyager of the Seas',
    // Add more corrections as needed
  };
  
  return corrections[shipName] || shipName;
}
```

## 🚀 Implementation Plan

### **Week 1: Real Web Scraping**
1. **Day 1-2:** Research and implement CruiseTimetables.com scraping
2. **Day 3-4:** Implement Gangwaze.com pricing integration
3. **Day 5:** Test and validate real data vs. mock data
4. **Day 6-7:** Error handling and rate limiting refinement

### **Week 2: Data Correction & Validation**
1. **Day 1-2:** Run comprehensive batch verification on all cruises
2. **Day 3-4:** Fix Navigator of the Seas date/duration issues specifically
3. **Day 5:** Implement timezone-aware date handling
4. **Day 6-7:** Validate all cruise data corrections

### **Week 3: UI Integration & Testing**
1. **Day 1-2:** Add analytics to cruise detail cards
2. **Day 3-4:** Fix ship name standardization in price alerts
3. **Day 5:** Remove hardcoded "7 nights" from cruise cards
4. **Day 6-7:** End-to-end testing and validation

## 🔄 Using the Rollback System

### **Safe Web Data Updates**
```typescript
// Single cruise update with rollback protection
const result = await trpc.cruises.scrapeSingle.mutate({
  cruiseId: "cruise-123",
  sources: ["cruisetimetables", "gangwaze"]
});

// Batch update with rollback protection
const batchResult = await trpc.cruises.batchVerify.mutate({
  batchSize: 100,
  maxBatches: 8
});
```

### **Manual Rollback if Needed**
```typescript
// Get available snapshots
const snapshots = await trpc.cruises.getSnapshots.query();

// Rollback to a specific point
const rollback = await trpc.cruises.rollbackToSnapshot.mutate({
  snapshotId: snapshots.snapshots[0].id
});
```

## 📊 Expected Outcomes

### **After Phase 1 (Real Web Scraping):**
- ✅ Live pricing data from Gangwaze and CruiseDirect
- ✅ Accurate itineraries from CruiseTimetables
- ✅ Real-time cruise schedule updates
- ✅ Competitive pricing comparisons

### **After Phase 2 (Data Correction):**
- ✅ Correct dates for Navigator 8/22 and similar cruises
- ✅ Proper 3-night vs 7-night duration handling
- ✅ Timezone-corrected departure/return dates
- ✅ Clean, standardized itinerary names

### **After Phase 3 (UI Integration):**
- ✅ Analytics visible on all cruise detail cards
- ✅ Correct ship names in price alerts
- ✅ Dynamic duration display (no hardcoded "7 nights")
- ✅ Enhanced user experience with real-time data

## 🛡️ Safety & Reliability

### **Rollback Protection**
- Every web operation is automatically protected with snapshots
- Failed operations trigger automatic rollback
- Manual rollback available for any issues
- Data validation runs after every operation

### **Error Handling**
- Comprehensive error logging and recovery
- Rate limiting to avoid being blocked by websites
- Graceful degradation when web sources are unavailable
- Fallback to cached data when real-time data fails

### **Data Integrity**
- Multi-source validation and comparison
- Automatic data cleaning and standardization
- Comprehensive date/duration validation
- Ship name and itinerary standardization

## 🎯 Success Metrics

1. **Data Accuracy:** 95%+ of cruises have correct dates and durations
2. **Web Data Coverage:** 80%+ of cruises have fresh pricing data
3. **System Reliability:** 99%+ uptime with rollback protection
4. **User Experience:** Analytics visible on all cruise cards
5. **Data Freshness:** Pricing updated within 24 hours for upcoming cruises

## 🔧 Technical Implementation Details

### **Rate Limiting Strategy**
- 2-3 seconds between requests to avoid being blocked
- Exponential backoff for failed requests
- Respect robots.txt and website terms of service
- Use rotating user agents and headers

### **Data Validation Pipeline**
1. **Input Validation:** Verify ship names and dates
2. **Response Parsing:** Extract and validate scraped data
3. **Cross-Source Validation:** Compare data from multiple sources
4. **Data Cleaning:** Standardize formats and fix common issues
5. **Final Validation:** Ensure data integrity before storage

### **Monitoring & Alerting**
- Log all web scraping operations and results
- Alert on high failure rates or data inconsistencies
- Monitor rollback frequency and success rates
- Track data freshness and coverage metrics

This implementation guide provides a clear roadmap for enabling real web data feeding while maintaining the robust rollback system already in place. The phased approach ensures safe, incremental progress with the ability to rollback at any point if issues arise.