# Quick Fix Guide - Get Your Data Loading

## 🚀 Quick Start (3 Steps)

### Step 1: Import Your Data
1. Open the app
2. Tap **Settings** tab (bottom right)
3. Scroll down and tap **"Process DATA Folder"**
4. Tap the blue **"Scan DATA"** button
5. Wait for the scan to complete
6. You should see counts like:
   - ✅ Cruises: 50+ rows
   - ✅ Booked: 10+ rows
   - ✅ Offers: 11 rows
   - ✅ Calendar: 200+ events
7. Tap **"Persist Locally"** button
8. Wait for success message

### Step 2: Verify Data Loaded
1. Go to **Cruises** tab
2. You should see your cruises listed
3. Go to **Scheduling** tab
4. You should see available cruises

### Step 3: Done!
Your data is now loaded and will persist across app restarts.

---

## ❌ If You See "0 rows" or Errors

### Quick Diagnosis
1. Go to Settings → Process DATA Folder
2. Tap **"Debug: Verify Data Sources"**
3. Look at the results:

**Good Result:**
```
=== LOCAL API TEST ===
cruises.xlsx: 200 OK ✅
booked.xlsx: 200 OK ✅
offers.xlsx: 200 OK ✅
```

**Bad Result:**
```
=== LOCAL API TEST ===
cruises.xlsx: 404 ERROR ❌
```

### Fix for 404 Errors
The DATA folder is not found. Make sure you have:
```
your-project/
  ├── DATA/
  │   ├── cruises.xlsx
  │   ├── booked.xlsx
  │   ├── offers.xlsx
  │   ├── calendar.ics
  │   └── tripit.ics
  ├── app/
  └── ...
```

### Fix for GitHub 403 Errors
This is normal! The app now uses local files first. As long as the LOCAL API TEST shows 200 OK, you're good.

---

## 🔍 Understanding the Data Flow

```
┌─────────────────┐
│  DATA Folder    │
│  (Excel/ICS)    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Local API      │
│  /api/data/     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Scan DATA      │
│  (Parse Files)  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Persist Locally │
│ (Save to Store) │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  App Startup    │
│  (Sync to UI)   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Display Data   │
│  (All Tabs)     │
└─────────────────┘
```

---

## 📊 Expected Data Counts

Based on your DATA files, you should see approximately:

| File | Expected Count |
|------|----------------|
| Cruises | 50+ rows |
| Booked | 10-21 rows |
| Offers | 11 rows |
| Calendar | 200+ events |
| TripIt | 85+ events |

If you see significantly different numbers, check your Excel files.

---

## 🐛 Common Issues

### Issue 1: "Scan Warning - No data found"
**Cause**: DATA files not accessible
**Fix**: 
1. Check DATA folder exists
2. Run debug button
3. Look for 404 errors

### Issue 2: Data imports but doesn't show in tabs
**Cause**: App needs to sync
**Fix**: 
1. Close and reopen the app
2. Or go to Settings and tap "Refresh Data"

### Issue 3: Some files load, others don't
**Cause**: File format or permissions issue
**Fix**: 
1. Check file names match exactly:
   - `cruises.xlsx` (not `Cruises.xlsx`)
   - `booked.xlsx` (not `Booked.xlsx`)
2. Check files aren't corrupted
3. Try re-downloading from source

---

## ✅ Success Checklist

- [ ] DATA folder exists in project root
- [ ] All 5 files present (cruises.xlsx, booked.xlsx, offers.xlsx, calendar.ics, tripit.ics)
- [ ] Scan DATA shows row counts
- [ ] Persist Locally succeeds
- [ ] Cruises tab shows cruises
- [ ] Scheduling tab shows available cruises
- [ ] Booked tab shows booked cruises

---

## 🆘 Still Having Issues?

1. **Check Console Logs**
   - Look for errors starting with `[ProcessDataFolder]` or `[AppState]`

2. **Try Manual Import**
   - Go to Settings → Import Data
   - Upload files one by one

3. **Verify File Format**
   - Open Excel files and check column names match expected format
   - See COMPLETE_FIX_SUMMARY.md for required columns

4. **Check Backend Status**
   - Go to Settings → Backend Test
   - Verify backend is running

---

## 💡 Pro Tips

1. **Use Debug Button**: Always run "Debug: Verify Data Sources" first when troubleshooting
2. **Check Logs**: Console logs show exactly what's happening
3. **Local First**: The app now prioritizes local files over GitHub
4. **Offline Works**: Once imported, data works offline via AsyncStorage

---

## 📝 What Changed?

### Before:
- ❌ GitHub URLs failing with 403/404
- ❌ No fallback to local files
- ❌ TypeScript errors preventing imports
- ❌ Data not persisting

### After:
- ✅ Local API serves files directly
- ✅ GitHub as fallback (not primary)
- ✅ All TypeScript errors fixed
- ✅ Data persists reliably
- ✅ Better error messages
- ✅ Debug tools included

---

## 🎯 Bottom Line

**The fix ensures your data loads reliably from local files, with GitHub as a backup.**

Just follow the 3 steps at the top, and you're done! 🎉
