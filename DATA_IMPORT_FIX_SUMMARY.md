# Data Import Fix Summary

## Issues Fixed

### 1. Booking ID Assignment
**Problem**: Booked cruises were not showing their reservation numbers on cruise detail cards because the `bookingId` field was not being set correctly.

**Solution**: Modified `backend/trpc/routes/import/startup.ts` to:
- Set a flag `_needsBookingId` on booked cruises during data loading
- After creating each cruise in the memory store, check if it has this flag and a reservation number
- If yes, set `bookingId = cruise.id` to mark it as booked

### 2. Main Issue: DATA Folder Not Found
**Problem**: The backend is reporting 0 cruises because the DATA folder files are not being found or read.

**Root Cause**: The DATA folder needs to be accessible to the backend server, but the path resolution is failing.

## How to Fix the "0 Cruises" Issue

### Option 1: Use the Import Screen (Recommended)
1. Go to the **Import** screen in the app
2. Upload your Excel files:
   - `cruises.xlsx`
   - `booked.xlsx`
   - `offers.xlsx`
3. The data will be imported directly into the backend memory store
4. This bypasses the need for the DATA folder on the server

### Option 2: Fix DATA Folder Path
The backend is looking for the DATA folder in these locations (in order):
1. `process.cwd()/DATA`
2. `process.cwd()/../DATA`
3. `/DATA`
4. `./DATA`

**To fix**:
1. Check where your backend is running: `console.log(process.cwd())`
2. Place the DATA folder in one of the searched locations
3. Ensure the files exist:
   - `DATA/cruises.xlsx`
   - `DATA/booked.xlsx`
   - `DATA/offers.xlsx`
   - `DATA/calendar.ics` (optional)
   - `DATA/tripit.ics` (optional)

### Option 3: Set Environment Variable
Set the `DATA_DIR` environment variable to point to your DATA folder:
```bash
export DATA_DIR=/path/to/your/DATA
```

## Testing the Fix

### Test Button in Settings
The TEST button in Settings checks for "Liberty of the Seas 10/16/25". After importing data:

1. Press "Force Reload" to reload from DATA folder (if using Option 2/3)
2. OR use the Import screen to upload files (Option 1)
3. Press the TEST button
4. It should find the Liberty cruise and show success

### Expected Behavior After Fix
1. **Overview Page**: Should show correct cruise count (not 0)
2. **Cruise Detail Cards**: Should show "Booking ID: [number]" instead of "Available" for booked cruises
3. **TEST Button**: Should find Liberty of the Seas 10/16/25 cruise

## Files Modified
- `backend/trpc/routes/import/startup.ts` - Fixed booking ID assignment logic

## Next Steps
1. Choose one of the three options above to import your data
2. Verify the data is loaded by checking the Overview page
3. Test the booking ID display on cruise detail cards
4. Run the TEST button to verify Liberty cruise is found
