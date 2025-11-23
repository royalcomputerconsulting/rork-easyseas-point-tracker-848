# COMPREHENSIVE DATA LOADING & PERSISTENCE FIX PLAN

## CURRENT STATUS

### ✅ COMPLETED
1. **TypeScript Compilation Errors Fixed** - Removed `as any` type assertions from data import logic in memory.ts
2. **Root Cause Analysis Complete** - Identified all critical issues preventing data flow

### 🔴 CRITICAL ISSUES IDENTIFIED

#### 1. Backend Data Loading (CRITICAL)
- **Problem**: Data files exist but aren't being loaded into memory store
- **Root Cause**: TypeScript errors were preventing successful data import
- **Status**: TypeScript errors fixed, but need to verify data actually loads
- **Files**: 
  - `backend/trpc/routes/_stores/memory.ts` (lines 198-296)
  - `backend/trpc/routes/_utils/dataLoader.ts`

#### 2. Frontend-Backend Sync (CRITICAL)
- **Problem**: Frontend shows 0 cruises even when backend has data
- **Root Cause**: AppStateProvider syncs with backend but receives empty arrays
- **Status**: Needs investigation and fix
- **Files**:
  - `state/AppStateProvider.tsx` (lines 116-212)
  - Frontend queries backend but gets no data

#### 3. Data Persistence (HIGH PRIORITY)
- **Problem**: User settings, points, thresholds don't persist across sessions
- **Root Cause**: No automatic persistence mechanism for all state
- **Status**: Partial implementation exists but incomplete
- **Missing**:
  - User points persistence
  - Loyalty levels persistence
  - Thresholds persistence
  - Filter preferences persistence

#### 4. Snapshots System (MEDIUM PRIORITY)
- **Problem**: Load/Save snapshots not connected to UI
- **Root Cause**: Backend has snapshot system but no UI integration
- **Status**: Backend complete, UI missing
- **Files**: `backend/trpc/routes/_stores/memory.ts` (lines 2144-2385)

## IMPLEMENTATION PLAN

### Phase 1: Verify Backend Data Loading ✅ IN PROGRESS

**Goal**: Ensure DATA folder files load into memory store on startup

**Tasks**:
1. ✅ Fix TypeScript errors in memory.ts (COMPLETED)
2. ⏳ Test data loading from DATA folder
3. ⏳ Verify persist.json is created with data
4. ⏳ Add comprehensive logging to track data flow

**Expected Outcome**: 
- Backend logs show successful data load
- persist.json file created with cruise/offer/calendar data
- Memory store contains data after startup

**Test Command**: Check backend logs for:
```
[MemoryStore] Loaded data from DATA folder: { cruises: X, booked: Y, offers: Z }
[MemoryStore] Successfully loaded and persisted data from DATA folder
```

---

### Phase 2: Fix Frontend-Backend Sync ⏳ PENDING

**Goal**: Frontend receives and displays backend data

**Tasks**:
1. Update AppStateProvider to properly handle backend responses
2. Add retry logic for backend connection failures
3. Ensure localData state updates when backend data loads
4. Add loading states and error handling
5. Test data flow from backend to frontend

**Files to Modify**:
- `state/AppStateProvider.tsx` (syncBackendData function)
- Add error boundaries for data loading failures

**Expected Outcome**:
- Frontend shows correct cruise count
- Scheduling page displays available cruises
- All 6 tabs populate with correct data

---

### Phase 3: Implement Complete Persistence ⏳ PENDING

**Goal**: All user state persists across app restarts

**Tasks**:
1. Persist user points to AsyncStorage and backend
2. Persist loyalty levels and Club Royale profile
3. Persist thresholds and alert settings
4. Persist filter preferences and UI state
5. Auto-save on all state changes with debouncing
6. Sync AsyncStorage with backend persist.json

**Data to Persist**:
- ✅ Cruises (already persisted)
- ✅ Booked cruises (already persisted)
- ✅ Casino offers (already persisted)
- ✅ Calendar events (already persisted)
- ❌ User points (NOT persisted)
- ❌ Loyalty points (NOT persisted)
- ❌ Club Royale profile (NOT persisted)
- ❌ Thresholds (NOT persisted)
- ❌ Filter preferences (NOT persisted)
- ❌ UI settings (NOT persisted)

**Implementation**:
```typescript
// In AppStateProvider.tsx
React.useEffect(() => {
  // Auto-save user points
  AsyncStorage.setItem(STORAGE_KEYS.USER_POINTS, String(userPoints));
}, [userPoints]);

React.useEffect(() => {
  // Auto-save loyalty points
  AsyncStorage.setItem(STORAGE_KEYS.LOYALTY_POINTS, String(loyaltyPoints));
}, [loyaltyPoints]);

React.useEffect(() => {
  // Auto-save Club Royale profile
  AsyncStorage.setItem(STORAGE_KEYS.CLUB_ROYALE_PROFILE, JSON.stringify(clubRoyaleProfile));
}, [clubRoyaleProfile]);
```

---

### Phase 4: Fix Snapshots System ⏳ PENDING

**Goal**: Users can create and restore data snapshots from UI

**Tasks**:
1. Create snapshot management UI page
2. Connect UI to backend snapshot APIs
3. Implement snapshot creation on user action
4. Implement snapshot restore functionality
5. Add snapshot list view with metadata
6. Test rollback scenarios

**New Files to Create**:
- `app/snapshots.tsx` - Snapshot management UI
- Add navigation link to snapshots page

**Backend APIs (Already Exist)**:
- `createDataSnapshot()` - Create new snapshot
- `getAvailableSnapshots()` - List all snapshots
- `rollbackToSnapshot()` - Restore snapshot
- `deleteSnapshot()` - Delete snapshot
- `clearAllSnapshots()` - Clear all snapshots

---

### Phase 5: Verify All Tabs ⏳ PENDING

**Goal**: All 6 tabs display correct data

**Tabs to Test**:
1. **Overview** - Summary stats, recent activity
2. **Cruises** - All available cruises
3. **Booked** - Booked cruises with receipts/statements
4. **Calendar** - Calendar events from .ics files
5. **Events/Offers** - Casino offers
6. **Analytics** - Analytics and insights

**Test Checklist**:
- [ ] Overview tab shows correct cruise count
- [ ] Cruises tab displays all cruises from cruises.xlsx
- [ ] Booked tab shows booked cruises from booked.xlsx
- [ ] Calendar tab displays events from calendar.ics and tripit.ics
- [ ] Events tab shows offers from offers.xlsx
- [ ] Analytics tab calculates correct metrics
- [ ] Scheduling tab shows available cruises (not conflicting with booked)

---

## DATA FLOW DIAGRAM

```
┌─────────────────┐
│  DATA Folder    │
│  - cruises.xlsx │
│  - booked.xlsx  │
│  - offers.xlsx  │
│  - calendar.ics │
│  - tripit.ics   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Backend Startup        │
│  (dataLoader.ts)        │
│  - Reads XLSX files     │
│  - Parses ICS files     │
│  - Returns raw data     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Memory Store           │
│  (memory.ts)            │
│  - Validates data       │
│  - Creates records      │
│  - Stores in memory     │
│  - Persists to disk     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  persist.json           │
│  - All data saved       │
│  - Loaded on restart    │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  tRPC API               │
│  - cruises.list         │
│  - bookedCruises.list   │
│  - casinoOffers.list    │
│  - calendar.events      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Frontend               │
│  (AppStateProvider)     ��
│  - Syncs with backend   │
│  - Updates localData    │
│  - Persists to AsyncStorage │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  UI Components          │
│  - Scheduling page      │
│  - Cruises tab          │
│  - Booked tab           │
│  - Calendar tab         │
│  - Analytics tab        │
└─────────────────────────┘
```

---

## MASTER DATA FILES

### 1. cruises.xlsx
**Format**: Excel spreadsheet
**Columns**:
- Sailing Date
- Ship Name
- Departure Port
- Itinerary
- Nights
- Cabin Type
- CASINO OVERVIEW OFFER TYPE
- Offer Name
- Offer Code
- OFFER EXPIRE DATE

**Example Row**:
```
10-09-2025 | Mariner of the Seas | Galveston | 4 NIGHT WESTERN CARIBBEAN CRUISE | 4 | Interior | $250 Off Your Choice of Room | 2025 October Instant Rewards | 2510C08 | 11-03-2025
```

### 2. booked.xlsx
**Format**: Excel spreadsheet
**Columns**:
- Ship Name
- Start Date
- End Date
- Nights
- Itinerary Name
- Departure Port
- Reservation Number
- Guests
- Days to Go
- Cabin Number
- Actual Fare
- Current Market Price
- Actual Savings

### 3. offers.xlsx
**Format**: Excel spreadsheet
**Columns**:
- NAME
- REWARD NUMBER
- OFFER NAME
- OFFER TYPE
- EXPIRES
- OFFER CODE
- TRADE IN VALUE

### 4. calendar.ics
**Format**: iCalendar format
**Contains**: Manual calendar events

### 5. tripit.ics
**Format**: iCalendar format
**Contains**: TripIt travel events

---

## ANALYTICS MASTER CRUISE DATABASE

**Location**: Derived from receipts and statements
**Count**: 8 cruises
**Purpose**: Source of truth for analytics calculations

**Cruises**:
1. Star of the Seas
2. Navigator of the Seas
3. Harmony of the Seas
4. Wonder of the Seas
5. Quantum of the Seas
6. Ovation of the Seas
7. Liberty of the Seas
8. Radiance of the Seas

---

## TESTING CHECKLIST

### Backend Tests
- [ ] DATA folder files are read successfully
- [ ] Data is parsed correctly (no TypeScript errors)
- [ ] Memory store contains data after startup
- [ ] persist.json is created with correct data
- [ ] tRPC APIs return data correctly

### Frontend Tests
- [ ] AppStateProvider syncs with backend
- [ ] localData state updates with backend data
- [ ] AsyncStorage persists data correctly
- [ ] UI components display data correctly
- [ ] All 6 tabs show correct data

### Persistence Tests
- [ ] User points persist across restarts
- [ ] Loyalty points persist across restarts
- [ ] Club Royale profile persists across restarts
- [ ] Thresholds persist across restarts
- [ ] Filter preferences persist across restarts
- [ ] Snapshots can be created and restored

---

## NEXT STEPS

1. **Immediate**: Test backend data loading with current fixes
2. **Next**: Fix frontend-backend sync if backend loads correctly
3. **Then**: Implement complete persistence for all state
4. **Finally**: Add snapshot management UI and test all tabs

---

## SUCCESS CRITERIA

✅ **Backend**:
- All 5 master files load successfully
- persist.json contains all data
- tRPC APIs return correct data

✅ **Frontend**:
- Scheduling page shows available cruises
- All 6 tabs display correct data
- No "0 cruises" errors

✅ **Persistence**:
- All user state persists across restarts
- Snapshots can be created and restored
- Data survives app crashes

✅ **User Experience**:
- App loads data on startup
- Data is always available
- No data loss
- Fast and responsive
