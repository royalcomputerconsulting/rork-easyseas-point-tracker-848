export const injectionScriptEnhanced = `
(function() {
  console.log('[RN Scraper Enhanced] Installing advanced hooks...');
  
  window.__rn_scraper = {
    packets: [],
    progress: { 
      current: 0, 
      total: 0, 
      status: 'idle',
      phase: 'initializing',
      offersFound: 0,
      pagesVisited: 0
    },
    config: { 
      autoScroll: true, 
      handlePagination: true,
      visitOffers: false,
      captureScreenshots: false,
      maxScrollAttempts: 10,
      scrollDelay: 2000,
      navigationDelay: 1500
    },
    state: { 
      isScrolling: false, 
      isNavigating: false,
      isPaused: false,
      errors: []
    },
    metadata: {
      startTime: Date.now(),
      domain: window.location.hostname,
      url: window.location.href
    }
  };

  const scraper = window.__rn_scraper;

  // === UTILITY FUNCTIONS ===
  
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  function randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return sleep(delay);
  }
  
  function notifyRN(message) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }
    console.log('[RN Scraper]', message.type, message);
  }
  
  function updateProgress(updates) {
    Object.assign(scraper.progress, updates);
    notifyRN({ 
      type: 'PROGRESS_UPDATE',
      progress: scraper.progress
    });
  }
  
  function logError(error, context) {
    const errorObj = {
      message: error.message || String(error),
      context,
      timestamp: Date.now(),
      url: window.location.href
    };
    scraper.state.errors.push(errorObj);
    notifyRN({ 
      type: 'ERROR',
      error: errorObj
    });
    console.error('[RN Scraper Error]', context, error);
  }

  // === NETWORK INTERCEPTION ===
  
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    return originalFetch.apply(this, args).then(response => {
      const cloned = response.clone();
      
      cloned.json().then(data => {
        const jsonStr = JSON.stringify(data);
        if (
          jsonStr.includes('campaignOffer') ||
          jsonStr.includes('campaignOffers') ||
          jsonStr.includes('offers') ||
          jsonStr.includes('sailings') ||
          jsonStr.includes('offerCode')
        ) {
          console.log('[RN Scraper] 📦 Captured fetch:', args[0]);
          scraper.packets.push({
            src: 'fetch',
            url: String(args[0]),
            data: data,
            timestamp: Date.now()
          });
          scraper.progress.offersFound++;
          updateProgress({ offersFound: scraper.progress.offersFound });
        }
      }).catch(() => {});
      
      return response;
    }).catch(error => {
      logError(error, 'fetch_request');
      throw error;
    });
  };
  
  const XHROpen = XMLHttpRequest.prototype.open;
  const XHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    this._method = method;
    return XHROpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() {
      try {
        const data = JSON.parse(this.responseText);
        const jsonStr = JSON.stringify(data);
        
        if (
          jsonStr.includes('campaignOffer') ||
          jsonStr.includes('campaignOffers') ||
          jsonStr.includes('offers') ||
          jsonStr.includes('sailings') ||
          jsonStr.includes('offerCode')
        ) {
          console.log('[RN Scraper] 📦 Captured XHR:', this._url);
          scraper.packets.push({
            src: 'xhr',
            url: this._url,
            data: data,
            timestamp: Date.now()
          });
          scraper.progress.offersFound++;
          updateProgress({ offersFound: scraper.progress.offersFound });
        }
      } catch (e) {
        if (this._url && this._url.includes('club-royale')) {
          logError(e, 'xhr_parse');
        }
      }
    });
    
    this.addEventListener('error', function() {
      logError(new Error('XHR request failed'), 'xhr_error: ' + this._url);
    });
    
    return XHRSend.apply(this, arguments);
  };

  // === AUTO-SCROLL FUNCTIONALITY ===
  
  function findScrollableContainer() {
    const selectors = [
      '[data-scroll-container]',
      '.offers-list',
      '.offer-grid',
      '.scrollable-content',
      'main',
      '#main-content',
      '[role="main"]'
    ];
    
    for (const selector of selectors) {
      const elem = document.querySelector(selector);
      if (elem && elem.scrollHeight > elem.clientHeight) {
        console.log('[RN Scraper] 📜 Found scrollable container:', selector);
        return elem;
      }
    }
    
    console.log('[RN Scraper] 📜 Using document.body for scrolling');
    return document.body;
  }
  
  async function autoScroll() {
    if (scraper.state.isScrolling) {
      console.log('[RN Scraper] ⚠️ Already scrolling, skipping');
      return;
    }
    
    scraper.state.isScrolling = true;
    updateProgress({ phase: 'scrolling', status: 'scrolling' });
    
    try {
      const container = findScrollableContainer();
      let lastHeight = 0;
      let stableCount = 0;
      let scrollAttempt = 0;
      const maxAttempts = scraper.config.maxScrollAttempts;
      
      console.log('[RN Scraper] 🔄 Starting auto-scroll...');
      
      while (stableCount < 3 && scrollAttempt < maxAttempts && !scraper.state.isPaused) {
        const currentHeight = container.scrollHeight;
        
        container.scrollTo({
          top: currentHeight,
          behavior: 'smooth'
        });
        
        scrollAttempt++;
        updateProgress({ current: scrollAttempt, total: maxAttempts });
        
        await sleep(scraper.config.scrollDelay);
        
        const newHeight = container.scrollHeight;
        
        if (newHeight === lastHeight) {
          stableCount++;
          console.log('[RN Scraper] 🔄 Height stable (${stableCount}/3)');
        } else {
          stableCount = 0;
          console.log('[RN Scraper] 📈 New content loaded (${lastHeight} -> ${newHeight})');
          
          const loadMoreButton = findLoadMoreButton();
          if (loadMoreButton && !loadMoreButton.disabled) {
            console.log('[RN Scraper] 🔘 Clicking load more button');
            loadMoreButton.click();
            await sleep(2000);
          }
        }
        
        lastHeight = newHeight;
      }
      
      if (scraper.state.isPaused) {
        console.log('[RN Scraper] ⏸️ Scroll paused by user');
        return { success: false, reason: 'paused' };
      }
      
      console.log('[RN Scraper] ✅ Auto-scroll complete after ${scrollAttempt} attempts');
      return { success: true, attempts: scrollAttempt };
      
    } catch (error) {
      logError(error, 'auto_scroll');
      return { success: false, error: error.message };
    } finally {
      scraper.state.isScrolling = false;
    }
  }

  // === PAGINATION HANDLING ===
  
  function findLoadMoreButton() {
    const selectors = [
      '[data-load-more]',
      '.load-more',
      '.show-more',
      'button[aria-label*="more"]',
      'button[aria-label*="next"]'
    ];
    
    for (const selector of selectors) {
      const elem = document.querySelector(selector);
      if (elem) return elem;
    }
    
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(btn => 
      /load\\s+more|show\\s+more|view\\s+more|see\\s+more/i.test(btn.textContent)
    );
  }
  
  function findNextButton() {
    const selectors = [
      '[data-next]',
      '.pagination-next',
      'button[aria-label*="next"]',
      'a[aria-label*="next"]'
    ];
    
    for (const selector of selectors) {
      const elem = document.querySelector(selector);
      if (elem && !elem.disabled) return elem;
    }
    
    const buttons = Array.from(document.querySelectorAll('button, a'));
    return buttons.find(btn => 
      /^next$/i.test(btn.textContent?.trim() || '') ||
      btn.querySelector('[class*="next"]') ||
      btn.querySelector('[class*="arrow-right"]')
    );
  }
  
  async function handlePagination() {
    if (scraper.state.isNavigating) {
      console.log('[RN Scraper] ⚠️ Already navigating, skipping pagination');
      return;
    }
    
    scraper.state.isNavigating = true;
    updateProgress({ phase: 'paginating', status: 'paginating' });
    
    try {
      let pageNum = 1;
      let pagesProcessed = 0;
      const maxPages = 20;
      
      console.log('[RN Scraper] 📄 Starting pagination handling...');
      
      while (pagesProcessed < maxPages && !scraper.state.isPaused) {
        const nextButton = findNextButton();
        
        if (!nextButton || nextButton.disabled || nextButton.getAttribute('aria-disabled') === 'true') {
          console.log('[RN Scraper] 📄 No more pages found');
          break;
        }
        
        console.log('[RN Scraper] 📄 Navigating to page ${pageNum + 1}');
        nextButton.click();
        
        await waitForLoad();
        await randomDelay(scraper.config.navigationDelay, scraper.config.navigationDelay + 1000);
        
        pagesProcessed++;
        pageNum++;
        scraper.progress.pagesVisited = pageNum;
        updateProgress({ pagesVisited: pageNum, current: pagesProcessed, total: maxPages });
        
        await autoScroll();
      }
      
      console.log('[RN Scraper] ✅ Pagination complete. Visited ${pageNum} pages');
      return { success: true, pagesVisited: pageNum };
      
    } catch (error) {
      logError(error, 'pagination');
      return { success: false, error: error.message };
    } finally {
      scraper.state.isNavigating = false;
    }
  }

  // === OFFER NAVIGATION ===
  
  function findOfferCards() {
    const selectors = [
      '[data-offer-id]',
      '[data-offer-code]',
      '.offer-card',
      '.campaign-offer',
      '[class*="offer"]'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log('[RN Scraper] 🎯 Found ${elements.length} offers using ${selector}');
        return Array.from(elements);
      }
    }
    
    return [];
  }
  
  async function visitAllOffers() {
    scraper.state.isNavigating = true;
    updateProgress({ phase: 'visiting_offers', status: 'visiting_offers' });
    
    try {
      const offers = findOfferCards();
      const total = offers.length;
      
      if (total === 0) {
        console.log('[RN Scraper] ⚠️ No offer cards found to visit');
        return { success: false, reason: 'no_offers_found' };
      }
      
      console.log('[RN Scraper] 🚀 Visiting ${total} offers...');
      updateProgress({ total });
      
      for (let i = 0; i < total && !scraper.state.isPaused; i++) {
        const offer = offers[i];
        const offerCode = offer.getAttribute('data-offer-code') || 
                         offer.getAttribute('data-offer-id') || 
                         'offer_' + (i + 1);
        
        console.log('[RN Scraper] 🔍 Visiting offer ${i + 1}/${total}: ${offerCode}');
        updateProgress({ current: i + 1 });
        
        offer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(500);
        
        offer.click();
        await waitForLoad();
        await randomDelay(1500, 2500);
        
        captureCurrentPage(offerCode);
        
        window.history.back();
        await waitForLoad();
        await randomDelay(1000, 2000);
      }
      
      console.log('[RN Scraper] ✅ Offer navigation complete');
      return { success: true, offersVisited: total };
      
    } catch (error) {
      logError(error, 'visit_offers');
      return { success: false, error: error.message };
    } finally {
      scraper.state.isNavigating = false;
    }
  }

  // === DATA CAPTURE ===
  
  function captureCurrentPage(context) {
    console.log('[RN Scraper] 💾 Capturing page data (${context})');
    
    captureFromGlobalState(context);
    captureFromDOM(context);
  }
  
  function captureFromGlobalState(context) {
    try {
      if (window.__INITIAL_STATE__) {
        scraper.packets.push({
          src: 'GLOBAL',
          url: 'window.__INITIAL_STATE__',
          data: window.__INITIAL_STATE__,
          context,
          timestamp: Date.now()
        });
        console.log('[RN Scraper] ✅ Captured global state');
      }
      
      if (window.__NEXT_DATA__) {
        scraper.packets.push({
          src: 'GLOBAL',
          url: 'window.__NEXT_DATA__',
          data: window.__NEXT_DATA__,
          context,
          timestamp: Date.now()
        });
        console.log('[RN Scraper] ✅ Captured Next.js data');
      }
      
      const scriptTags = document.querySelectorAll('script[type="application/json"]');
      scriptTags.forEach((script, idx) => {
        try {
          const data = JSON.parse(script.textContent || '');
          if (JSON.stringify(data).includes('offer') || JSON.stringify(data).includes('sailing')) {
            scraper.packets.push({
              src: 'SCRIPT_TAG',
              url: 'script_tag_' + idx,
              data,
              context,
              timestamp: Date.now()
            });
            console.log('[RN Scraper] ✅ Captured JSON from script tag ${idx}');
          }
        } catch (e) {}
      });
      
    } catch (error) {
      logError(error, 'capture_global_state');
    }
  }
  
  function captureFromDOM(context) {
    try {
      const offerCards = document.querySelectorAll('[data-offer-id], [data-offer-code], .offer-card');
      
      if (offerCards.length === 0) {
        console.log('[RN Scraper] ℹ️ No offer cards found in DOM');
        return;
      }
      
      const offersData = Array.from(offerCards).map((card, idx) => {
        const extractText = (selector) => {
          const elem = card.querySelector(selector);
          return elem ? elem.textContent?.trim() : null;
        };
        
        const extractAttr = (attr) => card.getAttribute(attr);
        
        return {
          index: idx,
          offerId: extractAttr('data-offer-id'),
          offerCode: extractAttr('data-offer-code') || extractAttr('data-code'),
          offerName: extractText('[data-offer-name]') || 
                    extractText('.offer-name') || 
                    extractText('.offer-title') ||
                    extractText('h2') ||
                    extractText('h3'),
          expirationDate: extractText('[data-expiration]') || 
                         extractText('.expiration') ||
                         extractText('.expire-date'),
          value: extractText('[data-value]') || 
                extractText('.value') ||
                extractText('.offer-value'),
          description: extractText('[data-description]') || 
                      extractText('.description') ||
                      extractText('p'),
          sailings: extractText('[data-sailings]') || 
                   extractText('.sailings-count') ||
                   extractText('.num-cruises'),
          html: card.outerHTML
        };
      });
      
      scraper.packets.push({
        src: 'DOM',
        url: 'dom_scrape',
        data: { offers: offersData },
        context,
        timestamp: Date.now()
      });
      
      console.log('[RN Scraper] ✅ Captured ${offersData.length} offers from DOM');
      
    } catch (error) {
      logError(error, 'capture_dom');
    }
  }

  // === ERROR DETECTION ===
  
  function detectAuthFailure() {
    const loginIndicators = [
      'input[type="password"]',
      '[data-login-form]',
      '.login-form',
      '[class*="signin"]',
      '[class*="sign-in"]'
    ];
    
    for (const selector of loginIndicators) {
      if (document.querySelector(selector)) {
        console.log('[RN Scraper] 🔐 Login form detected');
        notifyRN({ 
          type: 'AUTH_REQUIRED',
          message: 'Please log in to continue'
        });
        return true;
      }
    }
    
    const errorMessages = [
      'session expired',
      'please log in',
      'authentication required',
      'not authorized'
    ];
    
    const bodyText = document.body.textContent?.toLowerCase() || '';
    for (const msg of errorMessages) {
      if (bodyText.includes(msg)) {
        console.log('[RN Scraper] 🔐 Auth failure detected: ${msg}');
        notifyRN({ 
          type: 'AUTH_REQUIRED',
          message: 'Session expired. Please log in again.'
        });
        return true;
      }
    }
    
    return false;
  }
  
  function detectRateLimit() {
    const rateLimitIndicators = [
      'too many requests',
      'rate limit',
      'slow down',
      'please wait'
    ];
    
    const bodyText = document.body.textContent?.toLowerCase() || '';
    for (const msg of rateLimitIndicators) {
      if (bodyText.includes(msg)) {
        console.log('[RN Scraper] ⚠️ Rate limit detected: ${msg}');
        notifyRN({ 
          type: 'RATE_LIMIT',
          message: 'Rate limit detected. Slowing down...'
        });
        return true;
      }
    }
    
    return false;
  }

  // === UTILITIES ===
  
  function waitForLoad() {
    return new Promise(resolve => {
      if (document.readyState === 'complete') {
        setTimeout(resolve, 500);
      } else {
        window.addEventListener('load', () => {
          setTimeout(resolve, 500);
        }, { once: true });
      }
    });
  }

  // === PUBLIC API ===
  
  window.__rn_scraper.start = async function(options) {
    try {
      if (options) {
        Object.assign(scraper.config, options);
      }
      
      console.log('[RN Scraper] 🚀 Starting enhanced scraping...', scraper.config);
      updateProgress({ status: 'running', phase: 'starting' });
      
      if (detectAuthFailure()) {
        updateProgress({ status: 'auth_required' });
        return { success: false, reason: 'auth_required' };
      }
      
      if (scraper.config.autoScroll) {
        const scrollResult = await autoScroll();
        if (!scrollResult.success) {
          return scrollResult;
        }
        await sleep(1000);
      }
      
      if (scraper.config.handlePagination) {
        const paginationResult = await handlePagination();
        if (!paginationResult.success) {
          return paginationResult;
        }
        await sleep(1000);
      }
      
      if (scraper.config.visitOffers) {
        const visitResult = await visitAllOffers();
        if (!visitResult.success) {
          return visitResult;
        }
      }
      
      captureFromGlobalState('final_capture');
      captureFromDOM('final_capture');
      
      const duration = Date.now() - scraper.metadata.startTime;
      
      updateProgress({ status: 'complete', phase: 'complete' });
      
      console.log('[RN Scraper] 🎉 Scraping complete!');
      console.log('[RN Scraper] 📊 Packets: ${scraper.packets.length}');
      console.log('[RN Scraper] 📊 Offers: ${scraper.progress.offersFound}');
      console.log('[RN Scraper] ⏱️ Duration: ${(duration / 1000).toFixed(1)}s');
      
      notifyRN({
        type: 'COMPLETE',
        summary: {
          packetsCount: scraper.packets.length,
          offersFound: scraper.progress.offersFound,
          pagesVisited: scraper.progress.pagesVisited,
          duration: duration,
          errors: scraper.state.errors.length
        }
      });
      
      return {
        success: true,
        packetsCount: scraper.packets.length,
        offersFound: scraper.progress.offersFound,
        pagesVisited: scraper.progress.pagesVisited,
        duration: duration
      };
      
    } catch (error) {
      logError(error, 'scraper_start');
      updateProgress({ status: 'error' });
      return { success: false, error: error.message };
    }
  };
  
  window.__rn_scraper.pause = function() {
    scraper.state.isPaused = true;
    updateProgress({ status: 'paused' });
    console.log('[RN Scraper] ⏸️ Paused');
  };
  
  window.__rn_scraper.resume = function() {
    scraper.state.isPaused = false;
    updateProgress({ status: 'running' });
    console.log('[RN Scraper] ▶️ Resumed');
  };
  
  window.__rn_scraper.scrape = function() {
    return JSON.stringify(scraper.packets);
  };
  
  window.__rn_scraper.getProgress = function() {
    return scraper.progress;
  };
  
  window.__rn_scraper.getErrors = function() {
    return scraper.state.errors;
  };
  
  console.log('[RN Scraper Enhanced] ✅ Installation complete');
  notifyRN({ type: 'HOOK_READY', capabilities: Object.keys(window.__rn_scraper) });
  updateProgress({ status: 'ready' });
})();
`;
