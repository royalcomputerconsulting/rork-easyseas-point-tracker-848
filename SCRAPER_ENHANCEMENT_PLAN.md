# Royal Caribbean Scraper Enhancement Plan
## Replicating Full Chrome Extension Functionality

---

## 🎯 **Goal**
Enhance the existing React Native WebView scraper to match ALL functionality of a professional Chrome extension for Royal Caribbean Club Royale data extraction.

---

## 📋 **Implementation Phases**

### ✅ Phase 1: Enhanced JavaScript Injection (IMPLEMENT NOW)
**Duration: 1-2 hours**

#### Features to Add:
1. **Auto-scroll Detection & Execution**
   ```javascript
   - Detect scrollable containers
   - Auto-scroll to load lazy-loaded content
   - Wait for new content to appear
   - Repeat until no new data
   ```

2. **Pagination Handling**
   ```javascript
   - Find "Next", "Load More" buttons
   - Click automatically
   - Wait for page transition
   - Continue capturing data
   ```

3. **Progress Tracking**
   ```javascript
   - Count offers found
   - Track scroll position
   - Report progress to React Native
   - Estimate completion time
   ```

4. **Enhanced Data Capture**
   ```javascript
   - Capture from window.__INITIAL_STATE__
   - Extract from React component props
   - Parse from script tags
   - Scrape visible DOM if APIs fail
   ```

#### Files to Update:
- `lib/scraper/injection.js` - Enhanced injection script
- `app/club-royale-scraper.tsx` - Progress UI
- `lib/scraper/extract.ts` - Handle new data sources

---

### ✅ Phase 2: Screenshot & Visual Verification (IMPLEMENT NEXT)
**Duration: 2-3 hours**

#### Features to Add:
1. **Screenshot Capture**
   - Capture offer grid overview
   - Capture each offer detail page
   - Save with meaningful filenames
   - Organize by date/session

2. **OCR Integration**
   - Use existing AI toolkit
   - Extract text from screenshots
   - Compare with API data
   - Flag mismatches

3. **Visual Archive**
   - Store in DATA/screenshots/
   - Generate index.html viewer
   - Enable manual review
   - Export as PDF report

#### Files to Create/Update:
- `lib/scraper/screenshot.ts` - Screenshot management
- `lib/scraper/ocr-verify.ts` - OCR verification
- `app/club-royale-scraper.tsx` - Screenshot UI

---

### ✅ Phase 3: Robust Error Handling (CRITICAL)
**Duration: 1-2 hours**

#### Features to Add:
1. **Network Error Detection**
   ```typescript
   - Detect failed requests
   - Retry with exponential backoff
   - Skip problematic offers
   - Continue with remaining data
   ```

2. **Authentication State**
   ```typescript
   - Detect logout/session expiry
   - Pause scraping
   - Show login prompt
   - Resume after re-authentication
   ```

3. **Anti-Bot Detection**
   ```typescript
   - Detect CAPTCHA challenges
   - Detect rate limiting
   - Add human-like delays
   - Randomize timing
   ```

#### Files to Update:
- `lib/scraper/injection.js` - Error detection
- `lib/scraper/error-handler.ts` - NEW FILE
- `app/club-royale-scraper.tsx` - Error UI

---

### ✅ Phase 4: Session Persistence (IMPORTANT)
**Duration: 1-2 hours**

#### Features to Add:
1. **Progress State**
   ```typescript
   - Save every N offers processed
   - Track which offers completed
   - Store partial results
   - Enable resume from checkpoint
   ```

2. **Crash Recovery**
   ```typescript
   - Auto-save on each page
   - Detect incomplete sessions
   - Prompt to resume or restart
   - Merge partial data
   ```

3. **Export Improvements**
   ```typescript
   - Auto-export on complete
   - Auto-save backups
   - Version control for exports
   - Compare with previous runs
   ```

#### Files to Create:
- `lib/scraper/session-manager.ts` - NEW FILE
- `lib/scraper/checkpoint.ts` - NEW FILE

---

### ✅ Phase 5: Advanced Automation (OPTIONAL)
**Duration: 3-4 hours**

#### Features to Add:
1. **Smart Navigation**
   ```typescript
   - Auto-click offer cards
   - Navigate to detail pages
   - Extract enhanced data
   - Return to list automatically
   ```

2. **Intelligent Filtering**
   ```typescript
   - Skip already-scraped offers
   - Detect changes in existing offers
   - Focus on new/updated data only
   - Reduce redundant work
   ```

3. **Scheduled Operation**
   ```typescript
   - Run on schedule (daily/weekly)
   - Background operation
   - Push notifications on complete
   - Email reports
   ```

#### Files to Create:
- `lib/scraper/navigator.ts` - NEW FILE
- `lib/scraper/scheduler.ts` - NEW FILE

---

## 🔨 **Implementation Details**

### Enhanced Injection Script Structure

```javascript
// lib/scraper/injection.js (Enhanced Version)

(function() {
  // === CORE SETUP ===
  window.__rn_scraper = {
    packets: [],
    progress: { current: 0, total: 0, status: 'idle' },
    config: { autoScroll: true, captureScreenshots: true },
    state: { isScrolling: false, isNavigating: false }
  };

  // === NETWORK INTERCEPTION ===
  // (Existing fetch/XHR hooks)
  
  // === AUTO-SCROLL FUNCTIONALITY ===
  async function autoScroll() {
    const container = findScrollableContainer();
    let lastHeight = 0;
    let stableCount = 0;
    
    while (stableCount < 3) {
      container.scrollTo(0, container.scrollHeight);
      await sleep(2000);
      
      if (container.scrollHeight === lastHeight) {
        stableCount++;
      } else {
        stableCount = 0;
        lastHeight = container.scrollHeight;
      }
      
      notifyProgress();
    }
  }
  
  // === PAGINATION HANDLING ===
  async function handlePagination() {
    let pageNum = 1;
    
    while (true) {
      const nextButton = findNextButton();
      if (!nextButton || nextButton.disabled) break;
      
      nextButton.click();
      await waitForLoad();
      pageNum++;
      
      notifyProgress();
    }
  }
  
  // === OFFER NAVIGATION ===
  async function visitAllOffers() {
    const offers = document.querySelectorAll('[data-offer-id]');
    
    for (let i = 0; i < offers.length; i++) {
      offers[i].click();
      await waitForLoad();
      
      captureCurrentPage();
      
      window.history.back();
      await waitForLoad();
      
      notifyProgress({ current: i + 1, total: offers.length });
    }
  }
  
  // === DATA CAPTURE ===
  function captureCurrentPage() {
    // Capture from multiple sources
    captureFromAPI();
    captureFromDOM();
    captureFromState();
  }
  
  function captureFromAPI() {
    // Existing network capture
  }
  
  function captureFromDOM() {
    // NEW: Scrape visible data as fallback
    const offerCards = document.querySelectorAll('.offer-card');
    // Extract offer details...
  }
  
  function captureFromState() {
    // NEW: Try to access React app state
    if (window.__INITIAL_STATE__) {
      window.__rn_scraper.packets.push({
        src: 'GLOBAL',
        url: 'window.__INITIAL_STATE__',
        data: window.__INITIAL_STATE__
      });
    }
  }
  
  // === ERROR HANDLING ===
  function detectAuthFailure() {
    // Check for login form
    // Check for session expired message
    // Notify React Native to pause
  }
  
  function detectRateLimit() {
    // Check for 429 status
    // Check for "too many requests" message
    // Add delays and retry
  }
  
  // === PROGRESS NOTIFICATIONS ===
  function notifyProgress(update) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'PROGRESS_UPDATE',
        ...update
      }));
    }
  }
  
  // === PUBLIC API ===
  window.__rn_scraper.start = async function(options) {
    try {
      notifyProgress({ status: 'starting' });
      
      if (options.autoScroll) {
        notifyProgress({ status: 'scrolling' });
        await autoScroll();
      }
      
      if (options.handlePagination) {
        notifyProgress({ status: 'paginating' });
        await handlePagination();
      }
      
      if (options.visitOffers) {
        notifyProgress({ status: 'visiting_offers' });
        await visitAllOffers();
      }
      
      notifyProgress({ status: 'complete' });
      
      return {
        success: true,
        packetsCount: window.__rn_scraper.packets.length
      };
    } catch (error) {
      notifyProgress({ status: 'error', error: error.message });
      return { success: false, error: error.message };
    }
  };
  
  window.__rn_scraper.scrape = function() {
    return JSON.stringify(window.__rn_scraper.packets);
  };
  
  // === UTILITIES ===
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  function findScrollableContainer() {
    // Find the main scrollable element
    return document.querySelector('[data-scroll-container]') 
      || document.querySelector('.offers-list')
      || document.body;
  }
  
  function findNextButton() {
    return document.querySelector('[data-next]')
      || document.querySelector('.pagination-next')
      || Array.from(document.querySelectorAll('button'))
          .find(btn => /next|load more/i.test(btn.textContent));
  }
  
  function waitForLoad() {
    return new Promise(resolve => {
      if (document.readyState === 'complete') {
        setTimeout(resolve, 1000);
      } else {
        window.addEventListener('load', () => {
          setTimeout(resolve, 1000);
        }, { once: true });
      }
    });
  }
  
  console.log('[RN Scraper] Enhanced hooks installed');
  notifyProgress({ status: 'ready' });
})();
```

---

## 📱 **Enhanced React Native UI**

### Updated Control Panel

```typescript
// app/club-royale-scraper.tsx (Enhanced Version)

interface ScraperConfig {
  autoScroll: boolean;
  handlePagination: boolean;
  visitOffers: boolean;
  captureScreenshots: boolean;
  maxOffers: number;
}

interface ProgressState {
  status: 'idle' | 'scrolling' | 'paginating' | 'visiting_offers' | 'complete' | 'error';
  current: number;
  total: number;
  message?: string;
}

// Enhanced UI with:
// - Configuration panel
// - Real-time progress bar
// - Step-by-step status
// - Estimated time remaining
// - Pause/resume controls
// - Session recovery option
```

---

## ✅ **Success Metrics**

| Feature | Before | After | Status |
|---------|--------|-------|--------|
| Data Capture | Manual scroll | Automatic | 🔨 Implement |
| Coverage | First page only | All pages | 🔨 Implement |
| Reliability | 60% success | 95% success | 🔨 Implement |
| Speed | 5-10 min | 2-3 min | 🔨 Implement |
| Data Quality | 80% complete | 99% complete | 🔨 Implement |
| Resume Capability | None | Full | 🔨 Implement |
| Error Recovery | Manual | Automatic | 🔨 Implement |
| Visual Proof | None | Screenshots | 🔨 Implement |

---

## 🚀 **Ready to Implement**

Let's start with **Phase 1: Enhanced JavaScript Injection**

This will give you:
- ✅ Auto-scroll to capture all offers
- ✅ Pagination handling
- ✅ Progress tracking
- ✅ Multiple data source capture

Would you like me to implement Phase 1 now?
