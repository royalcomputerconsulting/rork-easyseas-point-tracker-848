# User Account System Migration Plan

## Overview
Migrate from single-user app to multi-user system where each user has their own data isolated by Crown & Anchor number.

## User Account Structure

### User Profile
```typescript
interface UserAccount {
  id: string; // UUID
  name: string; // "SCOTT MERLIS"
  crownAnchorNumber: string; // "305812247"
  email?: string; // Optional
  createdAt: string;
  lastLogin: string;
}
```

### Data Isolation
All existing data types will be scoped to user accounts:
- Cruises (available cruises - shared across users)
- Booked Cruises (user-specific)
- Casino Offers (user-specific)
- Calendar Events (user-specific)
- Club Royale Profile (user-specific)
- Receipts & Statements (user-specific)
- Financials (user-specific)
- Certificates (user-specific)
- Points History (user-specific)

## Migration Steps

### Phase 1: Create User Account System
1. **Create User Account Types** (`types/user.ts`)
   - UserAccount interface
   - UserSession interface
   - Authentication types

2. **Create User Backend Routes** (`backend/trpc/routes/users/`)
   - `create-account/route.ts` - Create new user account
   - `login/route.ts` - Login with Crown & Anchor #
   - `get-profile/route.ts` - Get user profile
   - `update-profile/route.ts` - Update user info
   - `router.ts` - User router

3. **Update Memory Store** (`backend/trpc/routes/_stores/memory.ts`)
   - Add user accounts storage
   - Add current user context
   - Scope all data queries by userId
   - Add user switching capability

### Phase 2: Migrate Existing Data
1. **Create Default User Account**
   ```typescript
   const SCOTT_MERLIS_ACCOUNT = {
     id: 'user-scott-merlis',
     name: 'SCOTT MERLIS',
     crownAnchorNumber: '305812247',
     createdAt: new Date().toISOString(),
     lastLogin: new Date().toISOString()
   };
   ```

2. **Associate All Existing Data**
   - Tag all booked cruises with userId
   - Tag all casino offers with userId
   - Tag all calendar events with userId
   - Tag all receipts/statements with userId
   - Tag all financials with userId
   - Tag Club Royale profile with userId

3. **Preserve Data Integrity**
   - Keep all existing data intact
   - Add userId field to all records
   - Maintain all relationships
   - Keep all snapshots working

### Phase 3: Update Frontend
1. **Create Login Screen** (`app/login.tsx`)
   - Simple form with Name and Crown & Anchor #
   - No password required (as requested)
   - Auto-login for returning users

2. **Create User Context** (`state/UserProvider.tsx`)
   - Current user state
   - Login/logout functions
   - User switching capability

3. **Update App Layout** (`app/_layout.tsx`)
   - Check for logged-in user
   - Redirect to login if no user
   - Show user info in header

4. **Add User Switcher** (Settings page)
   - List all user accounts
   - Switch between accounts
   - Create new account option

### Phase 4: Data Persistence
1. **AsyncStorage for User Session**
   - Store current userId
   - Auto-login on app start
   - Remember last logged-in user

2. **Backend Data Persistence**
   - All user data persists in memory store
   - Snapshots include user data
   - Backup/restore includes all users

## Implementation Details

### Simple Authentication (No Password)
```typescript
// Login flow
async function login(name: string, crownAnchorNumber: string) {
  // Find or create user account
  let user = await trpc.users.findByCrownAnchor.query({ crownAnchorNumber });
  
  if (!user) {
    // Create new account
    user = await trpc.users.create.mutate({ name, crownAnchorNumber });
  }
  
  // Set as current user
  await AsyncStorage.setItem('currentUserId', user.id);
  return user;
}
```

### Data Scoping
```typescript
// All queries automatically scoped to current user
const bookedCruises = trpc.bookedCruises.list.useQuery();
// Backend filters by currentUserId

// Cruises are shared (not user-specific)
const allCruises = trpc.cruises.list.useQuery();
// Returns all cruises for all users to browse
```

### User Switching
```typescript
// Switch to different user account
async function switchUser(userId: string) {
  await AsyncStorage.setItem('currentUserId', userId);
  // Reload app data for new user
  await refetchAllQueries();
}
```

## Data Migration Script

### Migrate Scott Merlis Data
```typescript
// Run once to migrate existing data
async function migrateExistingData() {
  const scottUserId = 'user-scott-merlis';
  
  // Create Scott's account
  await memoryStore.createUser({
    id: scottUserId,
    name: 'SCOTT MERLIS',
    crownAnchorNumber: '305812247',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString()
  });
  
  // Tag all existing data with Scott's userId
  const bookedCruises = memoryStore.getBookedCruises();
  bookedCruises.forEach(cruise => {
    cruise.userId = scottUserId;
  });
  
  const casinoOffers = memoryStore.getCasinoOffers();
  casinoOffers.forEach(offer => {
    offer.userId = scottUserId;
  });
  
  const calendarEvents = memoryStore.getCalendarEvents();
  calendarEvents.forEach(event => {
    event.userId = scottUserId;
  });
  
  // Update Club Royale profile
  const profile = memoryStore.getClubRoyaleProfile();
  if (profile) {
    profile.userId = scottUserId;
  }
  
  console.log('✅ Migration complete - all data tagged with Scott Merlis account');
}
```

## Testing Plan

### Test Scenarios
1. **Single User (Scott)**
   - Login as Scott Merlis
   - Verify all existing data visible
   - Verify all features work
   - Verify snapshots work

2. **Multiple Users**
   - Create second test user
   - Verify data isolation
   - Switch between users
   - Verify no data leakage

3. **New User**
   - Create new account
   - Verify empty state
   - Add test data
   - Verify data persists

## Rollout Strategy

### Step 1: Backend Changes (Non-Breaking)
- Add user account system
- Add userId fields (optional)
- Keep existing queries working
- Test with Scott's data

### Step 2: Data Migration
- Run migration script
- Tag all data with Scott's userId
- Verify data integrity
- Create backup snapshot

### Step 3: Frontend Changes
- Add login screen
- Add user context
- Update queries to use userId
- Test thoroughly

### Step 4: Enable Multi-User
- Enable user switching
- Test with multiple accounts
- Document for users

## Benefits

### For Scott (Primary User)
- All existing data preserved
- No disruption to workflow
- Can create test accounts
- Can share app with others

### For New Users
- Clean slate to start
- Own data isolated
- Same powerful features
- No setup complexity

### For App
- Scalable architecture
- Data isolation
- Easy to add features per user
- Professional multi-tenant design

## Timeline

### Immediate (Today)
- ✅ Web pricing fixed and tested
- ✅ Migration plan documented

### Next Steps (Small Increments)
1. Create user account types (15 min)
2. Create user backend routes (30 min)
3. Update memory store for users (30 min)
4. Create login screen (20 min)
5. Create user context (20 min)
6. Run data migration (10 min)
7. Test with Scott's account (15 min)
8. Test with second account (15 min)

**Total Estimated Time: ~2.5 hours**

## Notes

- No passwords required (as requested)
- Simple name + Crown & Anchor # login
- All data persists across sessions
- Snapshots continue to work
- Backup/restore includes all users
- Web pricing works for all users
- Each user sees only their data
