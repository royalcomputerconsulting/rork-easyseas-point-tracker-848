# Process Data Folder Fix Summary

## Issue
The "Scan DATA Folder" button was not finding the cruise files (cruises.xlsx, booked.xlsx, offers.xlsx) even though they exist in the DATA folder.

## Root Cause
The `readDataFiles()` function in `backend/trpc/routes/import/startup.ts` was searching for the DATA folder in incorrect locations. The path resolution wasn't accounting for the correct directory structure.

## Fix Applied
Added an additional path candidate to the search list:
```typescript
const baseDirCandidates = [
  path.resolve(process.cwd(), 'DATA'),
  path.resolve(__dirname, '../../../../..', 'DATA'),  // NEW: Added this path
  path.resolve(__dirname, '../../../..', 'DATA'),
  path.resolve('/', 'DATA'),
  '/DATA',
  './DATA',
];
```

## How It Works Now
1. User clicks "Scan DATA Folder" button on the import screen
2. Backend searches multiple possible locations for the DATA folder
3. When found, it reads cruises.xlsx, booked.xlsx, and offers.xlsx
4. Returns the parsed data to the frontend
5. User can then click "Save Locally (Offline)" to import the data

## Testing
To test the fix:
1. Go to the Import screen
2. Click "Scan DATA Folder"
3. You should see an alert showing:
   - Number of cruises found
   - Number of booked cruises found
   - Number of casino offers found
4. Click "Save Locally (Offline)" to import the data

## Files Modified
- `backend/trpc/routes/import/startup.ts` - Added additional path candidate for DATA folder search

## Next Steps
If the scan still doesn't find files:
1. Check the console logs to see which paths are being checked
2. Verify the DATA folder location relative to the backend
3. Check file permissions on the DATA folder
4. Ensure files are named exactly: cruises.xlsx, booked.xlsx, offers.xlsx (case-sensitive on some systems)
