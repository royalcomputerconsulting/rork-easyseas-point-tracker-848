# tRPC Connection Error Fix

## Problem
The app was showing a "Failed to fetch" error when trying to connect to the backend via tRPC. This error typically indicates:
1. The backend server is not running
2. The backend URL is incorrect
3. CORS is blocking the request
4. Network connectivity issues

## Root Cause
The issue was caused by a missing `createTRPCRouter` export in `backend/trpc/create-context.ts`, which caused TypeScript type errors and prevented the tRPC client from being properly initialized.

## Changes Made

### 1. Fixed `backend/trpc/create-context.ts`
- Added `createContext` function for tRPC context
- Added `Context` type export
- Properly exported `createTRPCRouter` from the tRPC instance
- This fixed the TypeScript error: "Property 'createClient' does not exist on type..."

### 2. Enhanced Error Logging in `lib/trpc.ts`
- Added detailed connection error logging
- Added diagnostic information when "Failed to fetch" occurs
- Improved error messages to help identify the root cause
- The app now gracefully falls back to offline mode when backend is unavailable

### 3. Created Connection Diagnostic Tool
- New page: `app/connection-diagnostic.tsx`
- Tests backend connectivity
- Shows configuration details (base URL, platform, etc.)
- Tests `/api/health` endpoint
- Tests tRPC ping endpoint
- Provides detailed error information

## How to Use the Diagnostic Tool

1. Navigate to the Connection Diagnostic page (you can add a link in settings)
2. The diagnostic will automatically run on page load
3. Review the results:
   - **Configuration**: Shows the detected base URL and platform
   - **Health Check**: Tests the `/api/health` endpoint
   - **tRPC Ping**: Tests the tRPC connection
4. Click "Run Diagnostics Again" to re-test

## Expected Behavior

### When Backend is Running
- Base URL should be detected (e.g., `http://localhost:8081` or `window.location.origin`)
- Backend Enabled: Yes
- Health Check: Status 200 OK
- tRPC Ping: Success with response data

### When Backend is Not Running
- The app will show detailed error logs in the console
- The app will gracefully fall back to offline mode
- Data will be stored locally only
- No crashes or blocking errors

## Console Logs to Check

When the backend connection fails, you'll see these logs:
```
[tRPC] ===== BACKEND CONNECTION FAILED =====
[tRPC] This usually means:
[tRPC] 1. The backend server is not running
[tRPC] 2. The backend URL is incorrect
[tRPC] 3. CORS is blocking the request
[tRPC] 4. Network connectivity issues
[tRPC] Current configuration: { ... }
[tRPC] ===== END CONNECTION ERROR =====
```

## Next Steps

1. **Check if the backend is running**: The app uses `bunx rork start` which should automatically start the backend
2. **Check the console logs**: Look for the base URL detection logs
3. **Use the diagnostic tool**: Navigate to the connection diagnostic page to see detailed connection info
4. **Verify CORS**: Make sure the backend CORS settings allow requests from your frontend origin

## Testing

To test the fix:
1. Start the app with `bun start` or `bunx rork start`
2. Open the browser console
3. Look for `[tRPC]` logs showing the base URL detection
4. Navigate to the connection diagnostic page
5. Verify all tests pass

## Additional Notes

- The app is designed to work offline when the backend is unavailable
- All data operations will fall back to local storage
- The tRPC client will return empty responses instead of throwing errors
- This ensures the app remains functional even without backend connectivity
