# Scheduling Page Data Loading Fix

## Issues Fixed

### 1. TypeScript Errors in Memory Store
**Problem**: The data import functions in `backend/trpc/routes/_stores/memory.ts` were missing required fields when creating cruise and offer objects, causing TypeScript compilation errors.

**Solution**: Updated the data mapping logic to:
- Calculate `returnDate` from `departureDate + nights` when not provided
- Calculate `endDate` for booked cruises using the same logic
- Properly map offer expiration dates from multiple possible field names (`OFFER EXPIRE DATE`, `Expires`, etc.)
- Ensure all required fields are populated with sensible defaults

### 2. Data Format Compatibility
**Problem**: The Cruises.xlsx format uses specific column names that weren't being properly mapped.

**Solution**: Enhanced field mapping to handle:
```
Sailing Date → departureDate
Ship Name → ship
Itinerary → itineraryName
Nights → nights (with calculation of returnDate)
Cabin Type → cabinType + stateroomTypes
CASINO OVERVIEW OFFER TYPE → offerType
Offer Name → offerName
Offer Code → offerCode
OFFER EXPIRE DATE → expires
```

## Changes Made

### File: `backend/trpc/routes/_stores/memory.ts`

1. **Cruise Import (lines 200-222)**:
   - Extract `departureDate` and `nights` first
   - Calculate `returnDate` using `calculateReturnDate()` if not provided
   - Ensure all required fields are present before creating cruise objects

2. **Booked Cruise Import (lines 229-254)**:
   - Calculate `endDate` from `startDate + nights` when missing
   - Properly calculate `daysToGo` for upcoming cruises
   - Ensure all required fields have values

3. **Casino Offers Import (lines 261-274)**:
   - Handle multiple field name variations for offer data
   - Map `OFFER EXPIRE DATE` to `expires` field
   - Ensure `name`, `offerName`, and other required fields are populated

## How It Works

The scheduling page now properly loads data through this flow:

1. **Backend Initialization**:
   - `MemoryStore` constructor calls `loadInitialData()`
   - Checks if `persist.json` exists and has data
   - If no persisted data, loads from `DATA/cruises.xlsx`, `DATA/booked.xlsx`, `DATA/offers.xlsx`

2. **Data Transformation**:
   - Excel data is parsed and mapped to proper TypeScript types
   - Missing dates are calculated (returnDate = departureDate + nights)
   - All required fields are populated with defaults if missing

3. **Frontend Display**:
   - Scheduling page uses `localData.cruises` from AppStateProvider
   - Filters cruises based on availability (no conflicts with booked cruises)
   - Shows proper cruise information with all required fields

## Testing

To verify the fix:

1. **Check TypeScript compilation**: No errors should appear
2. **Load scheduling page**: Should show cruises from DATA/cruises.xlsx
3. **Verify data**: Each cruise should have:
   - Ship name
   - Departure date
   - Return date (calculated if not in Excel)
   - Nights
   - Itinerary name
   - Offer information (if applicable)

## Data Format Example

Your `cruises.xlsx` format:
```
Sailing Date | Ship Name | Departure Port | Itinerary | Nights | Cabin Type | CASINO OVERVIEW OFFER TYPE | Offer Name | Offer Code | OFFER EXPIRE DATE
10-09-2025 | Mariner of the Seas | Galveston | 4 NIGHT WESTERN CARIBBEAN CRUISE | 4 | Interior | $250 Off Your Choice of Room | 2025 October Instant Rewards | 2510C08 | 11-03-2025
```

Is now properly mapped to:
```typescript
{
  ship: "Mariner of the Seas",
  departureDate: "2025-10-09",
  returnDate: "2025-10-13", // Calculated: 10-09 + 4 nights
  nights: 4,
  itineraryName: "4 NIGHT WESTERN CARIBBEAN CRUISE",
  departurePort: "Galveston",
  cabinType: "Interior",
  stateroomTypes: ["Interior"],
  status: "on_sale",
  offerName: "2025 October Instant Rewards",
  offerCode: "2510C08",
  offerExpirationDate: "2025-11-03"
}
```

## Next Steps

The scheduling page should now:
1. ✅ Load data from local DATA folder
2. ✅ Display cruises with proper dates
3. ✅ Filter available cruises (no conflicts with booked)
4. ✅ Show offer information when available

If you still see zero cruises, check:
- DATA/cruises.xlsx exists and has data
- Console logs show successful data loading
- No errors in browser console
