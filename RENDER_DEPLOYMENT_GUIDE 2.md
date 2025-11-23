# Render Deployment Guide - Persistent Data Storage

## Overview
Your cruise app has been configured to use Render's persistent disk storage, ensuring all data persists across deployments and restarts.

## What Was Implemented

### 1. Persistent Disk Configuration (`render.yaml`)
- **Mount Point**: `/data` - Render persistent disk mounted here
- **DATA Directory**: `/data/DATA` - Your application data stored here  
- **Size**: 1GB persistent disk
- **Environment Variable**: `DATA_DIR=/data/DATA`

### 2. Storage Abstraction Layer (`lib/storage.ts`)
A unified storage interface that:
- Automatically detects Render vs local environment
- Provides consistent API for file operations
- Handles directory creation automatically
- Works identically in both environments

### 3. Backend Integration
- `backend/hono.ts` - Initialized storage on startup
- `backend/trpc/routes/import/startup.ts` - Uses persistent disk for DATA folder operations
- File read/write operations automatically use correct paths

## How It Works

### Environment Detection
```typescript
// Automatically detects Render environment
const IS_RENDER = process.env.RENDER === 'true' || process.env.PERSISTENT_STORAGE === 'enabled';

// Uses appropriate path
const dataDir = IS_RENDER ? '/data/DATA' : './DATA';
```

### Data Persistence Flow
1. **On Render**: All DATA files stored in `/data/DATA` (persistent disk)
2. **Locally**: All DATA files stored in `./DATA` (project folder)
3. **On Deploy**: Persistent disk content preserved across redeploys
4. **On Restart**: Data automatically reloaded from persistent disk

## Deployment Steps

### Step 1: Connect to Render
1. Go to [render.com](https://render.com)
2. Connect your GitHub repository
3. Choose "Web Service"

### Step 2: Configure Service
Render will automatically use the `render.yaml` configuration:
- Build Command: `bun install && bun run build`
- Start Command: `bun run start`
- Environment: Node
- Plan: Starter (or higher for more disk space)

### Step 3: Upload Initial DATA Files
**After first deploy, you have two options:**

#### Option A: Upload via Render Dashboard
1. Go to your service → Shell tab
2. Navigate to `/data/DATA`
3. Upload files:
   ```bash
   cd /data/DATA
   # Use file upload feature or curl/wget to download files
   ```

#### Option B: Upload via API (Recommended)
Use the built-in API endpoint to upload files:

```bash
# Upload cruises.xlsx
curl -X PUT https://your-app.onrender.com/api/data/cruises.xlsx \
  --data-binary @DATA/cruises.xlsx \
  -H "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

# Upload booked.xlsx
curl -X PUT https://your-app.onrender.com/api/data/booked.xlsx \
  --data-binary @DATA/booked.xlsx \
  -H "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

# Upload offers.xlsx
curl -X PUT https://your-app.onrender.com/api/data/offers.xlsx \
  --data-binary @DATA/offers.xlsx \
  -H "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

# Upload calendar.ics
curl -X PUT https://your-app.onrender.com/api/data/calendar.ics \
  --data-binary @DATA/calendar.ics \
  -H "Content-Type: text/calendar"

# Upload tripit.ics
curl -X PUT https://your-app.onrender.com/api/data/tripit.ics \
  --data-binary @DATA/tripit.ics \
  -H "Content-Type: text/calendar"
```

### Step 4: Verify Deployment
1. Check logs for storage initialization:
   ```
   [Hono] Storage initialized:
   [Hono]   Environment: Render (persistent disk)
   [Hono]   DATA directory: /data/DATA
   ```

2. Verify data loaded:
   ```
   [Startup] 🎯 UNIFIED SYSTEM COMPLETE:
   [Startup]   📊 Total Cruises: XX
   [Startup]   ✅ Booked Cruises: XX
   [Startup]   🚢 Available Cruises: XX
   ```

## File Operations

### Reading DATA Files
Files are automatically read from the persistent disk location:
- GET `/api/data/cruises.xlsx`
- GET `/api/data/booked.xlsx`  
- GET `/api/data/offers.xlsx`
- GET `/api/data/calendar.ics`
- GET `/api/data/tripit.ics`

### Writing DATA Files  
Files are automatically saved to the persistent disk:
- PUT `/api/data/cruises.xlsx`
- PUT `/api/data/booked.xlsx`
- PUT `/api/data/offers.xlsx`
- PUT `/api/data/calendar.ics`
- PUT `/api/data/tripit.ics`

### Importing New Data
When you import data through the app (via OCR, Excel upload, etc.), it's automatically saved to persistent disk and will survive restarts/redeploys.

## Persistent Disk Benefits

✅ **Data survives** app restarts  
✅ **Data survives** code redeploys  
✅ **Data survives** scale-up/scale-down  
✅ **Automatic backups** (Render handles this)  
✅ **Fast access** (local to your instance)

## Disk Space Management

### Check Current Usage
```bash
# In Render Shell
df -h /data
```

### Upgrade Disk Size
1. Go to service Settings → Disks
2. Increase size as needed (costs more)
3. Common sizes: 1GB (free tier), 10GB, 100GB

### Clean Up Old Data
```bash
# In Render Shell
cd /data/DATA
ls -lh  # See file sizes
rm old-file.xlsx  # Remove if needed
```

## Troubleshooting

### Issue: "No DATA files found"
**Solution**: Upload your DATA files to `/data/DATA` using one of the methods above

### Issue: "Permission denied" when writing
**Solution**: Render should handle permissions automatically. If issues persist, check:
```bash
# In Render Shell  
ls -la /data
# Should show your app has write access
```

### Issue: Data not persisting
**Solution**:
1. Verify `render.yaml` has disk configuration
2. Check environment variable `DATA_DIR` is set to `/data/DATA`
3. Restart service after configuration changes

### Issue: "Out of disk space"
**Solution**: Upgrade disk size in Render dashboard or clean up old files

## Environment Variables

These are set automatically by `render.yaml`:

```yaml
DATA_DIR=/data/DATA          # Points to persistent disk
PERSISTENT_STORAGE=enabled   # Signals app to use persistent storage
NODE_ENV=production         # Production mode
```

## Local Development

Everything works the same locally - no changes needed:
- LOCAL: DATA files stored in `./DATA`  
- RENDER: DATA files stored in `/data/DATA`

The storage layer handles the difference automatically.

## Backup Strategy

### Render's Built-in Backups
Render automatically backs up persistent disks. Recovery options in dashboard.

### Manual Export
Download DATA files for safekeeping:
```bash
curl https://your-app.onrender.com/api/data/cruises.xlsx > backup-cruises.xlsx
curl https://your-app.onrender.com/api/data/booked.xlsx > backup-booked.xlsx
curl https://your-app.onrender.com/api/data/offers.xlsx > backup-offers.xlsx
```

### Automated Backups
Consider setting up a cron job to periodically download files to your local machine or cloud storage.

## Cost Considerations

- **1GB disk**: Included in free tier
- **10GB disk**: ~$0.25/GB/month
- **100GB disk**: ~$0.25/GB/month

See [Render Pricing](https://render.com/pricing) for current rates.

## Next Steps

1. ✅ Deploy to Render
2. ✅ Upload your DATA files
3. ✅ Verify data persistence
4. ⏭️ Optional: Set up automated backups
5. ⏭️ Optional: Monitor disk usage

## Support

If you encounter issues:
1. Check Render logs for error messages
2. Verify `/data/DATA` directory exists and is writable
3. Confirm environment variables are set correctly
4. Contact Render support for platform-specific issues

---

**Your app is now ready for production deployment with full data persistence! 🚀**
